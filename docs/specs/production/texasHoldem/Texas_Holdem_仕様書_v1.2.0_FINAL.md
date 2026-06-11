# Texas Hold'em 仕様書

**CPU対戦リングゲーム・疑似3D演出統合版 — v1.2.0 FINAL**

---

## 0. メタ情報 / 改訂方針

本ドキュメントは、CASINO HUB に組み込む Texas Hold'em の実装仕様の**確定版（単一の真実）**である。
Video Poker v1.2 の共通カジノ経済・レート・持ち込み・疑似3D演出方針を流用しつつ、Texas Hold'em 用にゲームフロー・ベット・ポット・CPU対戦・ショーダウン・演出を再設計する。

| 項目 | 内容 |
|---|---|
| バージョン | v1.2.0 FINAL |
| 形式 | Texas Hold'em（No Limit 簡略版） |
| スコープ | ゲームロジック、レート/持ち込み/経済、CPU対戦、ベット/ポット、疑似3D演出、テスト、受け入れ基準、**作業分担** |
| 想定読者 | **Codex（ロジック実装）/ Claude（UI・演出実装）**、本人（レビュー） |
| 実装方針 | React + TypeScript + Framer Motion + CSS疑似3D（v1では Three.js / R3F 不使用） |

### 0.1 v1.2.0 の変更点（v1.1.1 からの差分）

v1.1.1 FINAL の内容を維持したうえで、実装事故と継ぎ目バグを潰すため以下を上書き／追加する。

**ロジック修正**
- **ブラインド徴収を `placeToPot` 経由に統一**（§10.4）。SB/BB も `tableStack` 減算・`pot` 加算・`normalize` を必ず通す。直接代入を禁止。
- **初手の Dealer Button 決定を明文化**（§8.3）。`previousDealerButtonIndex` が無い初手の扱いを定義。
- **All-in の forbidden zone を明示**（§14）。`allInRaiseTo < currentBet` のケースも含め拒否条件を列挙。

**API 追加（Claude / Codex 境界に効く）**
- **`availableActions` を `useTexasHoldem` の返り値に追加**（§9.3 / §19.5）。各アクションの可否と理由をロジック側で確定し、UI はそれを見て disable + ツールチップを出すだけにする。
- **演出イベント契約（Animation Event Contract）を新設**（§26）。ロジックが離散演出イベントのキューを emit し、UI が再生 → 完了通知でロジックを進める疎結合方式を採用。

**UI / 演出の刷新**
- **モーション・トークンを定義**（§22）。全演出で共有する duration / easing を確定。
- **卓の色を緑（深いエメラルド〜フォレスト）に確定**し、質感を明記（§23）。
- 各演出に **duration / easing / 具体挙動** を付与し、シネマティックに刷新（§24）。

**運用**
- **Codex / Claude の作業分担を章として独立**（§33）。ファイル単位で責務を割る。

### 0.2 基本方針

1. 1人プレイ専用。Player 1人 + CPU 4人の5人卓。リングゲーム形式。トーナメントは扱わない。
2. レート表・持ち込みレンジは Video Poker と共通。`rate.betMin` を Small Blind と解釈し、Big Blind は `rate.betMin * 2`。
3. `UserProfile.chips` をチップの**真実値**とする。`tableStack` は着席中のみ保持するランタイム値。
4. 持ち込み時・REBUY時に `chips` は減算しない。ブラインド・Call・Bet・Raise・All-in 時のみ `chips` と `tableStack` を同額減算。ポット獲得時のみ同額加算。
5. `tableStack` 上限（`buyInMax`）は持ち込み・補充時のみ適用。勝利による増加にはクランプしない。
6. 役判定は共有 `shared/poker/handEvaluator.ts` を使用。Hold'em 用に7枚評価 `rankBestOfSeven` を追加。
7. サイドポットは v1 では未実装。`handContributionCap` で発生を防止する。
8. All-in は v1 では「残スタック全額投入」の場合のみ許可。`tableStack` が残る疑似All-in は禁止。
9. 操作関数は必ず `ActionResult` を返す。React state は**直接ミューテーションしない**。betting / pot / showdown は pure function / reducer ベースで実装。
10. 実装順は **ロジック → サンドボックス → テスト → UI → 演出**。ロジックが安定する前に Framer Motion を入れない。

---

## 1. 概要

プレイヤーは2枚の手札を配られ、最大5枚のコミュニティカードと組み合わせ、合計7枚から最強の5枚役を作る。

```
着席 → SB/BB 支払い → 手札2枚配布
→ Preflop ベット → Flop 3枚公開 → Flop ベット
→ Turn 1枚公開 → Turn ベット → River 1枚公開 → River ベット
→ Showdown → 勝者判定 → ポット配分 → 次ハンド
```

カジノ共通チップ `UserProfile.chips` を使用する。Video Poker 同様、旧式の「minBalance + betUnit」ではなく、台ごとの「持ち込みレンジ」＋「ブラインドレート」を採用する。

---

## 2. ゲーム形式

| 項目 | v1 |
|---|---|
| Player | 1人 |
| CPU | 4人 |
| 合計 | 5人卓（固定） |
| 種別 | リングゲーム（トーナメント / Sit & Go / オンラインは対象外） |

CPU数は将来 2〜8人へ拡張可能とするが、v1では5人卓固定で実装する。

**ハンド終了条件**（いずれか）
1. 1人を除く全員が Fold した。
2. River 後のベットラウンドが完了し Showdown に進んだ。
3. v1制限付き All-in により、全アクティブプレイヤーがこれ以上アクションできない状態になった。

---

## 3. 着席フロー

```
1. レート一覧を表示（LOW〜LEGEND）
2. 入場判定: chips >= rate.buyInMin（満たさないレートはグレーアウト）
3. 入場可能なレートを選択
4. 持ち込み額 buyInAmount を選択
   buyInAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
5. player.tableStack = buyInAmount
6. chips は減算しない
7. CPU4人を生成
8. CPUにも同レートに応じた tableStack を設定
9. Dealer Button / SB / BB を決定（初手の決定は §8.3 に従う）
10. waitingHand フェーズへ
```

### 3.1 CPUの初期スタック

```ts
cpuStack = randomBetween(rate.buyInMin, rate.buyInMax)
```

CPUのスタックはランタイム値であり永続化しない。

### 3.2 ハンド開始前の最低スタック条件

サイドポット未実装のため、ハンド開始時に極端なショートスタックを許可しない。

**人間プレイヤー**は次を満たす必要がある。
```
player.tableStack >= bigBlind
economy.chips     >= bigBlind
```
満たさない場合は `startHand()` を拒否し、REBUY / 退店 / Rescue 導線を表示する。

**CPU**は5人卓固定を維持するため、ハンド開始前に必ず補充する。
```ts
for (const cpu of cpuSeats) {
  if (cpu.tableStack < bigBlind) reseatOrRebuyCpu(cpu);
}
```
推奨実装：CPU名と style は維持し、`tableStack` だけ `[rate.buyInMin, rate.buyInMax]` で再抽選する。v1ではCPU破産演出は不要。`startHand` 時点でCPU4人全員が参加可能であることを保証する。

---

## 4. レート / 持ち込み仕様

Video Poker のレート表を共通利用する。

### 4.1 レート表

| ランク | 持ち込み可能額 | Small Blind | Big Blind | 目安 |
|---|---|---|---|---|
| LOW | 100〜500 | 1 | 2 | 最初の練習卓 |
| MIDDLE | 1,000〜5,000 | 10 | 20 | 普通に遊ぶ卓 |
| HIGH | 5,000〜25,000 | 50 | 100 | かなりヒリつく |
| VIP | 10,000〜50,000 | 100 | 200 | 上級者向け |
| ROYAL | 50,000〜250,000 | 500 | 1,000 | 大勝負卓 |
| LEGEND | 100,000〜500,000 | 1,000 | 2,000 | 最上位卓 |

### 4.2 レート解釈

```ts
smallBlind = rate.betMin;
bigBlind   = rate.betMin * 2;
minRaise   = bigBlind;
```

Video Poker の `MAX BET = betMin * 5` は Hold'em では**使用しない**。共通UIの都合で `betMax` を保持してもよいが、Hold'em の Bet / Raise 上限には使わない。Hold'em 画面では MAX BET 表示を隠すか「Video Poker用」と分かる表示にする。

### 4.3 型定義

```ts
export type RateId = "low" | "middle" | "high" | "vip" | "royal" | "legend";

export interface Rate {
  id: RateId;
  label: string;
  buyInMin: number;
  buyInMax: number;
  betMin: number;
  betMax: number;
  blurb: string;
}

export interface HoldemRateConfig {
  rate: Rate;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
}
```

### 4.4 入場資格

座れる条件は `chips >= rate.buyInMin` のみ。上限ゲートは設けない（資産が多くても下位卓に座れる）。

### 4.5 持ち込み buy-in

```
buyInAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
player.tableStack = buyInAmount;
```

持ち込み時点では `chips` から物理的に減算しない。理由：`chips` を真実値として一元管理する／リロードで持ち込み分が消える事故を防ぐ／`tableStack` は着席中のランタイム値として扱う。

---

## 5. tableStack 仕様

| 値 | 意味 |
|---|---|
| `chips` | 永続化された総資産（真実値） |
| `tableStack` | 現在の卓で使用可能なランタイム値（非永続） |

`tableStack` はリロード・離脱・退店時に破棄する。

### 5.1 不変条件

```
人間プレイヤー: player.tableStack <= economy.chips を常に維持

ブラインド/Call/Bet/Raise/All-in 時:
  economy.chips     >= amount
  player.tableStack >= amount

禁止状態: status = "active" かつ tableStack = 0
```

チップ投入後に `tableStack === 0` になった場合は必ず `status = "allIn"` に正規化する。

```ts
function normalizeSeatStatusAfterContribution(seat: HoldemSeat) {
  if (seat.status === "active" && seat.tableStack === 0) {
    seat.status = "allIn";
    seat.hasActed = true;
  }
}
```

### 5.2 ロックステップ更新

```ts
// 投入時
chips -= amount; tableStack -= amount; pot += amount;
// 獲得時
chips += wonAmount; tableStack += wonAmount; pot -= wonAmount;
```

### 5.3 勝利による増加

勝利で `tableStack` が `rate.buyInMax` を超えてもよい。`buyInMax` は持ち込み・補充時のみ適用し、勝利後はクランプしない。

### 5.4 退店 / リロード

退店時 `tableStack` は破棄。持ち込み時に `chips` を減算していないため、退店時に戻す処理は行わない。ゲーム中の勝敗による増減だけが `chips` に反映済みである。リロード/離脱時は進行中ハンドを破棄し、支払い済みチップは返却しない。再読み込み後は未着席状態に戻る。

---

## 6. REBUY 仕様

### 6.1 補充可能タイミング

許可：`waitingHand` / `result` / ハンド開始前。
不可：`preflop` / `flop` / `turn` / `river` / `showdown` / `settling`。

### 6.2 SET方式

```
rebuyAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
player.tableStack = rebuyAmount;
```
補充は `chips` を物理的に減算しない。

### 6.3 REBUY 導線

- `player.tableStack < bigBlind` → REBUY を促す。
- `player.tableStack < smallBlind` → REBUY / 退店 / Rescue 導線を表示する。

---

## 7. ゲームフェーズ

### 7.1 ロジックフェーズ

```ts
export type HoldemPhase =
  | "unseated" | "buyIn" | "waitingHand" | "postingBlinds"
  | "dealingHoleCards" | "preflop" | "dealingFlop" | "flop"
  | "dealingTurn" | "turn" | "dealingRiver" | "river"
  | "showdown" | "settling" | "result";
```

### 7.2 フェーズ遷移

```
unseated → buyIn → waitingHand → postingBlinds → dealingHoleCards
→ preflop → dealingFlop → flop → dealingTurn → turn → dealingRiver → river
→ showdown → settling → result → waitingHand ...
```

- Fold で1人以外が降りた場合は、現在ストリートに関係なく即 `settling` に進む。
- `preflop / flop / turn / river → settling → result`。

---

## 8. ハンド開始処理

### 8.1 startHand 前提条件

```
phase === "waitingHand" || phase === "result"
player.tableStack >= bigBlind
economy.chips     >= bigBlind
```
満たさない場合は `REBUY_REQUIRED` を返す。

### 8.2 新ハンド開始時の完全初期化

各 seat：
```ts
seat.holeCards = [];
seat.streetContribution = 0;
seat.totalContribution = 0;
seat.hasActed = false;
seat.lastAction = undefined;
seat.status = (seat.tableStack >= bigBlind) ? "active" : "sittingOut";
```

CPU補充：
```ts
for (const cpu of cpuSeats) {
  if (cpu.tableStack < bigBlind) {
    cpu.tableStack = randomBetween(rate.buyInMin, rate.buyInMax);
    cpu.status = "active";
  }
}
```

共通状態：
```ts
communityCards = [];
pot.amount = 0;
currentBet = 0;
currentTurnSeatIndex = null;
lastResult = null;
actionError = null;
```

前ハンドの状態を次ハンドに持ち越してはならない。

### 8.3 Dealer Button / SB / BB

5人卓固定。ハンドごとに Dealer Button を1席ずつ進める。

```ts
// 初手（previousDealerButtonIndex が null）の決定
//   v1では「ランダムな着席席を初期ボタンとする」
//   テスト容易性のため、deckProvider 指定時は seatIndex = 0 を初期ボタンに固定してよい
dealerButtonIndex = (previousDealerButtonIndex == null)
  ? pickInitialButton(seats, rng)        // 通常はランダム占有席
  : nextOccupiedSeat(previousDealerButtonIndex);

smallBlindIndex = nextOccupiedSeat(dealerButtonIndex);
bigBlindIndex   = nextOccupiedSeat(smallBlindIndex);
```

v1ではCPUをハンド開始前に補充するため、基本的に5席すべて参加可能である。

---

## 9. プレイヤー操作

### 9.1 基本アクション

`Fold` / `Check` / `Call` / `Bet` / `Raise` / `All-in`。UI上は状況に応じて表示を変える。

### 9.2 操作表示ルール（表示の目安）

| 状況 | 表示 |
|---|---|
| 誰もベットしていない | CHECK / BET / ALL-IN |
| 誰かがベット済み | FOLD / CALL / RAISE / ALL-IN |
| Call 額に tableStack が足りない | FOLD / ALL-IN |

> **重要：** 上の表は「目安」にすぎない。実際の活性/非活性は **§9.3 `availableActions` をロジック側が確定し、UI はそれに従う**。これにより「押せるのに押すと弾かれる（cap や forbidden zone で拒否される）」状態を UI から排除する。

### 9.3 availableActions（v1.2 新規・UI/ロジック境界の肝）

ロジック層が各アクションの可否を確定し、`useTexasHoldem` の返り値で公開する。UI はこれを見て disable + 理由ツールチップを出すだけにする。合法判定の知識を UI に分散させない。

```ts
export interface ActionAvailability {
  enabled: boolean;
  reason?: HoldemActionError;   // disabled の理由（UIツールチップ用）
}

export interface AvailableActions {
  fold:  ActionAvailability;
  check: ActionAvailability;    // enabled <=> amountToCall === 0
  call:  ActionAvailability;    // enabled時は amountToCall を併用
  bet:   ActionAvailability;    // enabled時の有効域: [bigBlind, maxBet]
  raise: ActionAvailability;    // enabled時の有効域: [minRaiseTo, maxRaiseTo]
  allIn: ActionAvailability;    // enabled時の投入額: allInAmount = tableStack
}
```

算出規則（ロジック層）：
- `check.enabled = (amountToCall === 0)`
- `call.enabled = (amountToCall > 0 && tableStack >= amountToCall && totalContribution + amountToCall <= cap)`
- `bet.enabled = (currentBet === 0 && tableStack >= bigBlind && totalContribution + bigBlind <= cap)`
- `raise.enabled = (currentBet > 0 && minRaiseTo <= maxRaiseToForSeat)`（=合法なレイズ幅が存在する場合のみ）
- `allIn.enabled`：§14 の許可条件（全額投入 かつ cap内 かつ forbidden zone でない）を満たす場合のみ。満たさない時は `reason = "SIDE_POT_NOT_SUPPORTED"` 等を入れる。
- `fold.enabled = (自分の手番 && status === "active")`

---

## 10. ベット / レイズ仕様

### 10.1 基本ベット単位

```ts
smallBlind = rate.betMin;
bigBlind   = rate.betMin * 2;
// v1簡略仕様。本来のNLHでは「直前のレイズ幅」が次の minRaise になるが、
// v1では実装簡略化のため常に Big Blind 固定にする。
minRaise = bigBlind;
```

### 10.2 ベットラウンド

各ストリート（preflop / flop / turn / river）でアクティブプレイヤーが順番に行動する。

### 10.3 行動順

```
Preflop : Big Blind の左隣から開始
Flop以降: Dealer Button の左隣から開始
```
Fold済み / busted / allIn / sittingOut の席はスキップ。

```ts
nextActionSeatIndex = findNextSeat({
  from: currentSeatIndex,
  seats,
  include: seat => seat.status === "active" && !seat.isAllIn,
});
```

### 10.4 Preflop開始時の初期化（v1.2 修正：ブラインドは placeToPot 経由）

ブラインドは `streetContribution` 等への直接代入ではなく、**必ず `placeToPot` を通す**。これにより `tableStack` 減算・`pot` 加算・正規化が確実に走り、「ちょうど BB しか持たない席が BB を払って `tableStack=0` なのに `active` のまま」という禁止状態が発生しない。

```ts
// postingBlinds: SB/BB を placeToPot 経由で徴収する
placeToPot(smallBlindSeat.id, smallBlind);  // tableStack/pot/normalize を内部で処理
placeToPot(bigBlindSeat.id,   bigBlind);

currentBet = bigBlind;
minRaise   = bigBlind;

// ブラインドは「強制投入」であり自発アクションではないため hasActed は立てない
smallBlindSeat.hasActed = false;
bigBlindSeat.hasActed   = false;

// placeToPot 内の normalizeSeatStatusAfterContribution により、
// ちょうど bigBlind だけ持っていた BB はここで allIn に正規化される
// （allIn 席は roundComplete 判定で hasActed 不要扱いになり整合する）
```

**重要（BBオプション保証）**
- Big Blind は Preflop 開始時に `hasActed=true` にしない。誰も Raise しなくても BB は最後に Check / Raise する権利を持つ。
- 最初の行動者：`currentTurnSeatIndex = seatLeftOf(bigBlindIndex)`。
- BB が自分の番で `amountToCall === 0` の場合 Check 可能。
- BB が Raise を選んだ場合は、他の active player の `hasActed` を再度 false にする。

### 10.5 Flop / Turn / River 開始時の初期化

```ts
currentBet = 0;
for (const seat of seats) {
  seat.streetContribution = 0;
  seat.hasActed = (seat.status !== "active");
}
// 最初の行動者（Fold済み/allIn/busted/sittingOut はスキップ）
currentTurnSeatIndex = seatLeftOf(dealerButtonIndex);
```

---

## 11. currentBet / Contribution

- `currentBet`：現ラウンドで各プレイヤーが合わせるべき最大額。
- `streetContribution`：そのストリート内で出した額。`amountToCall = currentBet - streetContribution`。
- `totalContribution`：そのハンド全体で出した額。

`currentBet` と `streetContribution` はストリートごとにリセット。`totalContribution` はハンド終了まで保持。

---

## 12. サイドポット防止用 handContributionCap

### 12.1 基本方針

v1ではサイドポット未実装のため、各プレイヤーが1ハンド内で出せる総額に上限 `handContributionCap` を設ける。

### 12.2 実装関数（専用関数に集約）

```ts
function getHandContributionCap(seats: HoldemSeat[]): number {
  const contenders = seats.filter(s => s.status === "active" || s.status === "allIn");
  if (contenders.length === 0) return 0;
  return Math.min(...contenders.map(s => s.tableStack + s.totalContribution));
}
```

意味：その時点でまだポット争いに残っている全員が出せる最大総額の最小値。Fold済みは cap 計算から除外する。

### 12.3 各プレイヤーの追加投入上限

```ts
maxAdditionalForSeat = handContributionCap - player.totalContribution;
maxRaiseToForSeat    = player.streetContribution + maxAdditionalForSeat;
```
Bet / Raise / All-in / CPUの攻撃的アクションは、すべてこの cap を超えてはならない。

---

## 13. 各アクション仕様

### 13.1 Check
条件：`amountToCall === 0`。処理：`hasActed=true; lastAction="check";`

### 13.2 Fold
```ts
seat.status = "folded";
seat.hasActed = true;
seat.lastAction = "fold";
```
Fold済みは：以降のアクション対象外／cap 計算対象外／Showdown 対象外／投入済みチップは返却しない。
Fold後、残り contender が1人になった場合は Showdown せず即 `settling` へ。
```ts
const contenders = seats.filter(s => s.status === "active" || s.status === "allIn");
if (contenders.length === 1) goToSettlingWithoutShowdown(contenders[0]);
```

### 13.3 Call
```
条件: amountToCall > 0
      tableStack >= amountToCall
      totalContribution + amountToCall <= cap
```
```ts
placeToPot(player.id, amountToCall);
player.hasActed = true;
player.lastAction = "call";
normalizeSeatStatusAfterContribution(player);
```
cap 超過時は `SIDE_POT_NOT_SUPPORTED` で拒否。

### 13.4 Bet
```
条件: currentBet === 0
      betAmount >= bigBlind
      tableStack >= betAmount
      totalContribution + betAmount <= cap
```
```ts
placeToPot(player.id, betAmount);
currentBet = betAmount;
player.hasActed = true;
player.lastAction = "bet";
normalizeSeatStatusAfterContribution(player);
resetOtherActivePlayersHasActed(player.id);
```

### 13.5 Raise
```
条件: currentBet > 0
      raiseTo >= currentBet + minRaise
      raiseTo <= maxRaiseToForSeat
      tableStack >= (raiseTo - streetContribution)
      totalContribution + (raiseTo - streetContribution) <= cap
```
```ts
amount = raiseTo - player.streetContribution;
placeToPot(player.id, amount);
currentBet = raiseTo;
player.hasActed = true;
player.lastAction = "raise";
normalizeSeatStatusAfterContribution(player);
resetOtherActivePlayersHasActed(player.id);
```

```ts
function resetOtherActivePlayersHasActed(actorId: string) {
  for (const seat of seats) {
    if (seat.id === actorId) continue;
    if (seat.status !== "active") continue;   // Fold/AllIn/Busted/SittingOut は対象外
    seat.hasActed = false;
  }
}
```

---

## 14. All-in 仕様

### 14.1 v1 の扱い

All-in ボタンは用意するが、サイドポットは未実装。よって：

- **All-in = 自分の残り `tableStack` を全額投入する操作**のみ許可。
- **禁止**：`handContributionCap` までだけ出して `tableStack` が残る疑似All-in。

### 14.2 投入額（固定）

```ts
allInAmount = player.tableStack;   // 必ず全額
// 禁止例:
// allInAmount = handContributionCap - player.totalContribution; // tableStack が残るためNG
```

### 14.3 実行条件

```
allInAmount > 0
player.tableStack === allInAmount
player.totalContribution + allInAmount <= handContributionCap
```
cap 超過は拒否：
```ts
return { ok: false, reason: "SIDE_POT_NOT_SUPPORTED",
  message: "v1ではサイドポットが発生するAll-inはできません。" };
```

### 14.4 誰もベットしていない場合の All-in（All-in Bet）

```
currentBet === 0
allInAmount >= bigBlind
totalContribution + allInAmount <= cap
```
```ts
placeToPot(player.id, allInAmount);
currentBet = player.streetContribution;
player.status = "allIn";
player.hasActed = true;
player.lastAction = "allIn";
resetOtherActivePlayersHasActed(player.id);
```
`allInAmount < bigBlind` の All-in Bet は v1 では拒否。

### 14.5 すでにベットがある場合の All-in（v1.2 forbidden zone を明示）

```
currentBet > 0
amountToCall  = currentBet - player.streetContribution
allInRaiseTo  = player.streetContribution + allInAmount
```

| allInRaiseTo の位置 | 判定 |
|---|---|
| `allInRaiseTo === currentBet` | **許可**：All-in Call |
| `allInRaiseTo >= currentBet + minRaise` | **許可**：All-in Raise |
| `currentBet < allInRaiseTo < currentBet + minRaise` | **拒否**：minRaise未満（forbidden zone） |
| `allInRaiseTo < currentBet` | **拒否**：Call にも満たない中途半端な投入 |

拒否時：
```ts
return { ok: false, reason: "SIDE_POT_NOT_SUPPORTED",
  message: "v1では中途半端な額のAll-inはできません。" };
```

> 注：cap が機能しているため「他のアクティブが Call できない額への Bet/Raise」は基本起きないが、上表で `allInRaiseTo < currentBet` も明示的に拒否しておくことで実装の抜けを防ぐ。

### 14.6 All-in後の扱い

```ts
player.status = "allIn";
player.hasActed = true;
player.lastAction = "allIn";
```
以降のアクション対象から除外。ただし Fold していないので Showdown の勝敗判定対象に含める。

### 14.7 v1で拒否する状況（`SIDE_POT_NOT_SUPPORTED`）

- cap を超える Bet / Raise / All-in
- あるアクティブプレイヤーが Call できない額への Bet / Raise
- `totalContribution` の差でサイドポットが必要になる All-in
- `tableStack` が残る疑似All-in
- currentBet を超えるが minRaise 未満の All-in Raise
- Call にも満たない All-in（`allInRaiseTo < currentBet`）

### 14.8 v2以降の拡張

複数人All-in／サイドポット／メイン・サイド分離／ポット別勝者判定／本来のNLH minRaise 更新。

---

## 15. ベットラウンド完了条件

```ts
const contenders = seats.filter(s => s.status === "active" || s.status === "allIn");
const activeNeedAction = contenders.filter(s => s.status === "active" && !s.hasActed);
const allMatchedOrAllIn = contenders.every(s =>
  s.status === "allIn" || s.streetContribution === currentBet
);
roundComplete = activeNeedAction.length === 0 && allMatchedOrAllIn;
```
前提：`status=active` かつ `tableStack=0` の seat は存在してはならない。各アクション後に必ず `normalizeSeatStatusAfterContribution(seat)` を実行する。

### 15.1 全員All-in状態

残り全員が All-in になったら、以降のベットラウンドを省略し、残りコミュニティカードを順番に公開して Showdown へ。`rankBestOfSeven` に渡す前に必ずコミュニティカードが5枚揃っている状態にする。

---

## 16. ポット処理

### 16.1 Pot 型

```ts
export interface Pot { amount: number; }   // v1は単一ポットのみ
```

### 16.2 チップ投入（集約関数）

```ts
function placeToPot(playerId: string, amount: number): ActionResult {
  if (amount <= 0)
    return { ok: false, reason: "INVALID_BET", message: "ベット額が不正です。" };

  const player = findSeat(playerId);
  if (!player)
    return { ok: false, reason: "NOT_SEATED", message: "席情報がありません。" };

  const cap = getHandContributionCap(seats);

  if (player.tableStack < amount)
    return { ok: false, reason: "INSUFFICIENT_TABLE_STACK", message: "テーブル上のチップが不足しています。" };

  if (player.isHuman && economy.chips < amount)
    return { ok: false, reason: "INSUFFICIENT_CHIPS", message: "所持チップが不足しています。" };

  if (player.totalContribution + amount > cap)
    return { ok: false, reason: "SIDE_POT_NOT_SUPPORTED", message: "v1ではサイドポットが発生するベットはできません。" };

  if (player.isHuman) {
    const ok = economy.placeBet(amount);
    if (!ok)
      return { ok: false, reason: "ECONOMY_FAILED", message: "チップ処理に失敗しました。" };
  }

  player.tableStack         -= amount;
  player.streetContribution += amount;
  player.totalContribution  += amount;
  pot.amount                += amount;
  normalizeSeatStatusAfterContribution(player);
  return { ok: true };
}
```

### 16.3 CPUのチップ処理

CPUは永続 `chips` を持たない。`placeToPot` は通すが `player.isHuman === false` のとき `economy.placeBet` を呼ばない（`cpu.tableStack` のみ減算）。

### 16.4 単独勝利時

```ts
// 人間
const wonAmount = pot.amount;
economy.settle(wonAmount);
player.tableStack += wonAmount;
pot.amount = 0;

// CPU
const wonAmount = pot.amount;
cpu.tableStack += wonAmount;
pot.amount = 0;
```
人間の `chips` はベット時に減算済みのため追加処理不要。

### 16.5 Fold勝利

```ts
const winner = contenders[0];
settlePotToWinner(winner);   // Showdown しない
```
Fold済みの投入済みチップは返却しない。

### 16.6 Split Pot

```ts
share     = Math.floor(pot.amount / winners.length);
remainder = pot.amount % winners.length;
```
端数は **① Dealer Button の左側に近い勝者 → ② seatIndex が小さい勝者** の順で配る。

```ts
for (const winner of orderedWinners) {
  let wonAmount = share;
  if (remainder > 0) { wonAmount += 1; remainder -= 1; }
  if (winner.isHuman) economy.settle(wonAmount);
  winner.tableStack += wonAmount;
  pot.amount -= wonAmount;
}
pot.amount = 0;
```

### 16.7 profit計算

```ts
profit = playerWonAmount - player.totalContributionInHand;
// Fold負け: playerWonAmount = 0
// Split:    profit = playerWonShare - player.totalContributionInHand
```

---

## 17. 役評価

### 17.1 共有評価コア

```ts
export function rankFiveCardHand(cards: Card[]): HandRank;
export function compareHandRank(a: HandRank, b: HandRank): number;
```

### 17.2 Hold'em用7枚評価

```ts
export interface BestHoldemHand {
  cards: Card[];
  rank: HandRank;
  usedHoleCardCount: 0 | 1 | 2;
}

export function rankBestOfSeven(
  holeCards: [Card, Card],
  communityCards: [Card, Card, Card, Card, Card]
): BestHoldemHand;
```

### 17.3 rankBestOfSeven の仕様

入力：`holeCards.length === 2`、`communityCards.length === 5`。
処理：7枚を作る → 重複検査 → 7C5=21通りを全列挙 → 各に `rankFiveCardHand` → `compareHandRank` で最強選択 → 最強5枚 / HandRank / 使用hole枚数を返す。21通りなので単純全探索でよい。

```ts
usedHoleCardCount = bestFive.filter(card =>
  holeCards.some(hole => sameCard(hole, card))
).length as 0 | 1 | 2;
```

### 17.4 Showdown 前提

`communityCards.length === 5` を必ず満たす。River 到達前に全員 All-in の場合は残りを公開してから Showdown。Fold勝利は Showdown も役判定もしない。

### 17.5 ショーダウン比較

`compareHandRank(a.rank, b.rank)`：正=a勝ち／負=b勝ち／0=同着。

### 17.6 役名表示

| category | 表示 |
|---|---|
| royal_flush | ROYAL FLUSH |
| straight_flush | STRAIGHT FLUSH |
| four_of_a_kind | FOUR OF A KIND |
| full_house | FULL HOUSE |
| flush | FLUSH |
| straight | STRAIGHT |
| three_of_a_kind | THREE OF A KIND |
| two_pair | TWO PAIR |
| one_pair | ONE PAIR |
| high_card | HIGH CARD |

---

## 18. CPU仕様

### 18.1 CPUタイプ

```ts
export type CpuStyle = "tightPassive" | "tightAggressive" | "loosePassive" | "looseAggressive";
```

### 18.2 Seat 型

```ts
export type SeatStatus = "active" | "folded" | "allIn" | "busted" | "sittingOut";

export interface HoldemSeat {
  id: string;
  name: string;
  seatIndex: number;
  isHuman: boolean;
  style?: CpuStyle;
  tableStack: number;
  holeCards: Card[];
  status: SeatStatus;
  streetContribution: number;
  totalContribution: number;
  hasActed: boolean;
  lastAction?: "fold" | "check" | "call" | "bet" | "raise" | "allIn";
}
```
v1：`humanSeats.length === 1`、`cpuSeats.length === 4`。

### 18.3 CPU行動の基本方針

高度なGTO/モンテカルロは行わない。プリフロップ手札強度／現在の役・ドロー可能性／Call額／簡易 Pot odds／性格／`tableStack` 残量／`handContributionCap` を基にルールベースで判断する。CPU の Bet / Raise / All-in は必ず cap を超えない範囲で行う。

### 18.4 プリフロップ評価

```ts
export type PreflopStrength = "premium" | "strong" | "playable" | "weak";
```
例：premium = AA,KK,QQ,AKs ／ strong = JJ,TT,AQs,AKo,KQs ／ playable = 中ペア,スーテッドコネクター,Axs ／ weak = その他。

### 18.5 CPU行動例

Tight系：weak=Fold、playable=安ければCall、strong以上=Call/Raise、premium=Raiseしやすい。
Loose系：weakでも一定確率Call、playable以上は参加しやすい。
Aggressive系：Bet/Raise確率が高い。Passive系：Check/Call中心でRaise少なめ。

### 18.6 CPUショートスタック処理

```ts
if (cpu.tableStack < bigBlind) reseatOrRebuyCpu(cpu);
```
CPU名と style を維持し `tableStack` だけ `[buyInMin, buyInMax]` で再抽選。CPUのショートAll-inを避け、サイドポット不要を維持する。

### 18.7 CPU思考演出

CPUの行動前に `300ms〜800ms` の待機演出。`prefers-reduced-motion` または `animationEnabled=false` の場合は短縮する。

---

## 19. ActionResult / 操作API

### 19.1 エラー型

```ts
export type HoldemActionError =
  | "ANIMATING" | "NOT_SEATED" | "INVALID_PHASE" | "NOT_YOUR_TURN"
  | "INVALID_BET" | "INSUFFICIENT_CHIPS" | "INSUFFICIENT_TABLE_STACK"
  | "REBUY_REQUIRED" | "SIDE_POT_NOT_SUPPORTED" | "DECK_EXHAUSTED"
  | "DUPLICATE_CARD" | "ECONOMY_FAILED";
```

### 19.2 ActionResult

```ts
export type ActionResult =
  | { ok: true }
  | { ok: false; reason: HoldemActionError; message: string };
```

### 19.3 AnimationPhase（参照）

`§25` を参照。

### 19.4 操作関数の前提チェック

```ts
if (isAnimating || isResolvingRef.current)
  return { ok: false, reason: "ANIMATING", message: "演出中です。" };
if (!isPlayerSeated())
  return { ok: false, reason: "NOT_SEATED", message: "着席していません。" };
if (!isPlayerTurn(action))
  return { ok: false, reason: "NOT_YOUR_TURN", message: "あなたのターンではありません。" };
```
`startHand / rebuy / exitTable` はターンチェック不要。

### 19.5 useTexasHoldem Return（v1.2：availableActions / animationEvents を追加）

```ts
export interface UseTexasHoldemReturn {
  // --- フェーズ / レート ---
  phase: HoldemPhase;
  animationPhase: HoldemAnimationPhase;
  rate: Rate | null;
  smallBlind: number;
  bigBlind: number;

  // --- 座席 / ボタン ---
  seats: HoldemSeat[];
  playerSeatIndex: number | null;
  dealerButtonIndex: number | null;
  smallBlindIndex: number | null;
  bigBlindIndex: number | null;
  currentTurnSeatIndex: number | null;

  // --- カード / ポット / ベット ---
  deckRemaining: number;
  communityCards: Card[];
  pot: Pot;
  currentBet: number;
  minRaise: number;
  amountToCall: number;
  handContributionCap: number;
  maxRaiseTo: number;
  tableStack: number;

  // --- UI補助（v1.2 追加）---
  availableActions: AvailableActions;        // 各操作の可否+理由（UIはこれでdisable）
  animationEvents: AnimationEvent[];         // 再生待ち演出キュー（§26）

  // --- 結果 / 状態 ---
  lastResult: HoldemResult | null;
  actionError: HoldemActionError | null;
  isAnimating: boolean;
  isResolving: boolean;

  // --- 操作 ---
  startHand: () => ActionResult;
  fold: () => ActionResult;
  check: () => ActionResult;
  call: () => ActionResult;
  bet: (amount: number) => ActionResult;
  raiseTo: (amount: number) => ActionResult;
  allIn: () => ActionResult;
  rebuy: (newTableStack: number) => ActionResult;
  exitTable: () => ActionResult;
  clearResult: () => void;

  // --- 演出完了通知（§26）---
  onAnimationEventComplete: (eventId: string) => void;
}
```
`unseated / buyIn` では未確定値（rate, 各index）に `null` を許可する。

---

## 20. 連打・二重実行対策

副作用（ブラインド/Bet/Call/Raise/All-in/精算）の前にロックを確定する。

```ts
if (isAnimating || isResolvingRef.current)
  return { ok: false, reason: "ANIMATING", message: "演出中です。" };

isResolvingRef.current = true;
try {
  // chips / tableStack / pot を更新
} finally {
  isResolvingRef.current = false;
}
```

無効化する区間：カード配布中／CPU思考中／チップ移動中／コミュニティ公開中／ショーダウン中／ポット配分中。

---

## 21. React / TypeScript 実装方針

### 21.1 直接ミューテーション禁止

擬似コードに `seat.tableStack -= amount` とあっても React state を直接変更しない。

```ts
// 禁止
state.seats[index].tableStack -= amount;

// 推奨（immutable）
return {
  ...state,
  seats: state.seats.map(seat =>
    seat.id === targetId ? { ...seat, tableStack: seat.tableStack - amount } : seat
  ),
};
```

### 21.2 推奨構成

`useReducer` 推奨。betting / pot / showdown は pure function に分離。reducer 内で immutable update。UI から直接 seat / pot / phase を変更しない。

### 21.3 ロジックとUIの分離

| 層 | 内容 |
|---|---|
| ロジック層 | deck / betting / pot / showdown / cpuStrategy / handEvaluator |
| UI層 | カード描画 / チップ描画 / テーブル描画 / アニメーション / 操作ボタン / 結果表示 |

---

# UI / 疑似3D演出仕様（v1.2 刷新）

## 22. デザイン基盤 / モーション・トークン（最優先）

**「カッコよさ」は派手さではなく一貫性で決まる。** 全演出は以下の共有トークンを必ず使い回す。バラバラの duration / easing を散在させない。

### 22.1 カラートークン

```css
:root {
  /* 卓・背景 */
  --felt-center: #0e7a52;   /* 卓中央（明） */
  --felt-edge:   #0a4f37;   /* 卓外周（暗） */
  --felt-line:   #0c5c3f;   /* ベットライン */
  --rail:        #b8860b;   /* レール（真鍮/金） */
  --rail-hi:     #e9c46a;   /* レールのハイライト */
  --bg-deep:     #07120d;   /* 画面最奥 */
  --bg-navy:     #0b1622;   /* 濃紺アクセント */

  /* アクセント */
  --gold:   #e9c46a;
  --gold-2: #f4d680;
  --red:    #c1121f;
  --neon:   #2bd9c4;        /* ネオンシアン */
  --neon-2: #7a5cff;        /* ネオンパープル */

  /* テキスト */
  --text-hi:  #f5f1e6;
  --text-mid: #c9c2b0;
  --text-dim: #6f6a5c;
}
```

### 22.2 モーション・トークン

```ts
export const DURATION = {
  fast:     200,   // ボタン/ホバー/ラベル
  normal:   350,   // 一般遷移
  slow:     600,   // 大きめの遷移
  dramatic: 1000,  // 役確定/バナー
} as const;

export const EASING = {
  // 登場（強い減速）: ease-out-expo 風
  entrance: [0.16, 1, 0.30, 1],
  // 退場
  exit:     [0.7, 0, 0.84, 0],
  // 一般遷移
  inout:    [0.65, 0, 0.35, 1],
} as const;

// カード/チップなど物理挙動は spring を使う
export const SPRING = {
  card:  { type: "spring", stiffness: 520, damping: 32, mass: 0.9 },
  chip:  { type: "spring", stiffness: 420, damping: 30 },
  light: { type: "spring", stiffness: 700, damping: 40 }, // スナップ用
} as const;
```

すべての演出時間は `prefers-reduced-motion` / `animationEnabled=false` でスケール（§24.12）。

---

## 23. 卓・環境ビジュアル

### 23.1 卓面（緑・確定）

中央に楕円形のポーカーテーブル。**色は深いエメラルド〜フォレスト。ベタ塗りは禁止**（安っぽくなる）。

```css
.felt {
  background:
    radial-gradient(ellipse at 50% 42%,
      var(--felt-center) 0%,
      var(--felt-edge) 78%);
  /* フェルト質感（微ノイズ） + 内側ソフトシャドウで奥行き */
  box-shadow: inset 0 0 120px rgba(0,0,0,0.55);
  border-radius: 50% / 42%;
}
.rail {
  /* 縁の金/真鍮レール */
  border: 14px solid var(--rail);
  background-image: linear-gradient(180deg, var(--rail-hi), var(--rail));
}
.bet-line {
  /* 中央のベットライン（淡い円） */
  border: 2px solid var(--felt-line);
}
```

### 23.2 疑似3D

```css
.table-stage { perspective: 1000px; transform-style: preserve-3d; }
.table       { transform: rotateX(8deg); }
```
操作可能なカード/ボタンはクリック判定が崩れないよう通常の2Dレイヤーに置いてよい。

### 23.3 環境演出（“何もしてない時”の質感）

- 卓全体に微フェルトテクスチャ + ソフトな vignette。
- 中央からの淡い ambient glow（呼吸するように極ゆっくり明滅、周期 ~6s）。
- ネオン要素にごく遅いシマー。
- 背景は `--bg-deep` → `--bg-navy` の縦グラデーション。

---

## 24. アニメーション詳細仕様

すべて §22 のトークンを使用。各演出は **duration / easing / 挙動** を満たすこと。

### 24.1 画面レイアウト

```
┌────────────────────────────────────┐
│ CASINO HUB / TEXAS HOLD'EM          │
│ chips / tableStack / rate           │
├────────────────────────────────────┤
│       CPU1            CPU2          │
│  CPU4   [ COMMUNITY ]      CPU3     │
│            [ POT ]                  │
│              PLAYER                 │
│           [Hole][Hole]              │
├────────────────────────────────────┤
│ FOLD CHECK CALL BET RAISE ALL-IN    │
│ Action log / Result message         │
└────────────────────────────────────┘
```

### 24.2 ホールカード配布（シネマティック）

- 山札位置から各席へ、**直線ではなく軽いアーチ**を描いて飛ぶ。
- 飛行中に微回転（-15° → 0°）、着地で `SPRING.card` の settle。
- 配布順：Dealer Button 左から1枚目を全員 → 同順で2枚目。`card delay = 80ms`（stagger）。飛行 `~250–300ms`。
- 自分のカードのみ表向きフリップ（`rotateY 0→180`、`backface-visibility:hidden`、中間で `scale 1→1.05→1` のスナップ）。CPUは裏面のまま。
- 手札は軽く扇状（±4°程度）に着地。

### 24.3 コミュニティカード公開

- **Flop**：裏向きで素早く3枚並べる → 左→右へ `120ms` stagger でフリップ + 軽い光のスイープ。v1では Burn Card はロジック・演出とも省略。
- **Turn**：一瞬のタメ → スライドイン → フリップ → 淡いフレア。
- **River**：最もドラマチックに。タメをやや長く、フリップ後に短い金フレア。

### 24.4 チップ移動（気持ちいい部分）

- 席 → ポットへ**アーチ移動**（`SPRING.chip`）。額に応じてデノミ別チップスタックで見せる（数字だけにしない）。
- ポットのカウントアップは `EASING.entrance`、増加時に軽い `scale pulse`。
- 可能なら `layoutId` でチップを“移動”させて連続性を出す。

### 24.5 ターンインジケータ（polish効果大）

- 手番の席に**呼吸する glow**（box-shadow アニメ、周期 ~1.4s）+ 微 scale（1.0 ↔ 1.02）。
- CPU thinking 中はその席に細い progress ring（`§18.7` の 300–800ms に同期）。

### 24.6 ディーラーボタン移動

ハンド間でボタンが新しい席へスライド（layout animation、`DURATION.normal` / `EASING.inout`）。

### 24.7 ショーダウンの振り付け

```
1. 卓を軽く暗転（vignette を一段濃く）
2. CPU ホールカードを1人ずつ stagger ~250ms でフリップ
3. 各 best-5 を少し持ち上げ + ハイライト
4. 勝者の5枚に金のシマーが流れる
5. 負け手は desaturate
6. ポットが勝者へカスケード
7. WINNER バナーが scale + fade + 軽いオーバーシュートで登場（DURATION.dramatic）
```

### 24.8 勝利演出の階層

| 役 | 演出 |
|---|---|
| High Card / One Pair | 控えめ（金テキストのフェード + 小カスケード） |
| Two Pair / Three of a Kind | 標準（バナー + 勝ち札 glow） |
| Straight / Flush | 強め（役色 glow + 軽いスパークル） |
| Full House / Four of a Kind | 大（画面端 glow + パーティクル増 + 大バナー） |
| Straight Flush / Royal Flush | 専用（金ネオンのバースト + 画面全体の一瞬のシマー + 別格バナー） |

一番派手なのは最後の2つだけに取っておく。

### 24.9 プレイヤー敗北演出（上品に）

LOSE は控えめにフェードイン／自分の札を desaturate + dim／勝者を軽くハイライト。**シェイクはしない。**

### 24.10 マイクロインタラクション（premium感）

- ボタン：hover で lift + glow、press で scale down、disable は明確に dim + 理由ツールチップ（`§9.3 availableActions` と連動）。
- 自分の手札：hover で軽く lift。
- Raise スライダー：滑らか追従。動かすとチップ枚数プレビューが即更新。

### 24.11 CPUアクションラベル

CPU席に短いラベルを表示（`FOLD / CHECK / CALL / BET 100 / RAISE 300 / ALL-IN`）。表示時間 `~700ms`、`EASING.entrance` でポップイン。

### 24.12 Reduced Motion

`prefers-reduced-motion` または `animationEnabled=false`：
- 飛行/フリップを `~100ms` のクロスフェードに置換。
- パーティクル / glow / シマーをオフ。
- **状態遷移自体は省略しない。**

---

## 25. AnimationPhase

```ts
export type HoldemAnimationPhase =
  | "idle" | "postingBlinds" | "dealingHoleCards" | "playerActing"
  | "cpuThinking" | "movingChips" | "dealingFlop" | "dealingTurn"
  | "dealingRiver" | "showdownReveal" | "settlingPot" | "resultBanner";
```

| 操作/処理 | Logic Phase | AnimationPhase |
|---|---|---|
| ハンド開始 | waitingHand → postingBlinds | postingBlinds |
| 配札 | postingBlinds → dealingHoleCards | dealingHoleCards |
| プリフロップ | preflop | playerActing / cpuThinking |
| フロップ公開 | dealingFlop | dealingFlop |
| ターン公開 | dealingTurn | dealingTurn |
| リバー公開 | dealingRiver | dealingRiver |
| ショーダウン | showdown | showdownReveal |
| ポット精算 | settling | settlingPot |
| 結果表示 | result | resultBanner |

---

## 26. 演出イベント契約（Animation Event Contract）★Claude↔Codex 境界の肝

ロジック（Codex）は離散演出を**イベントのキュー**として emit する。UI（Claude）はそれを順に再生し、完了したら `onAnimationEventComplete(eventId)` を呼んでロジックを次へ進める。これによりロジックはヘッドレスでテスト可能、UI は安定したイベント契約に対して演出だけ作れる。**この契約を境界として2エージェントの継ぎ目バグを防ぐ。**

### 26.1 イベント型

```ts
export type AnimationEvent =
  | { id: string; type: "POST_BLIND";   seat: number; amount: number }
  | { id: string; type: "DEAL_HOLE";    seat: number; cardIndex: 0 | 1; faceUp: boolean }
  | { id: string; type: "REVEAL_FLOP";  cards: [Card, Card, Card] }
  | { id: string; type: "REVEAL_TURN";  card: Card }
  | { id: string; type: "REVEAL_RIVER"; card: Card }
  | { id: string; type: "CPU_THINKING"; seat: number; ms: number }
  | { id: string; type: "PLAYER_ACTION_LABEL"; seat: number; action: HoldemSeat["lastAction"]; amount?: number }
  | { id: string; type: "CHIP_TO_POT";  seat: number; amount: number; potAfter: number }
  | { id: string; type: "FLIP_HOLE";    seat: number }              // showdown公開
  | { id: string; type: "HIGHLIGHT_BEST"; seat: number; cards: Card[] }
  | { id: string; type: "AWARD_POT";    seat: number; amount: number; isSplit: boolean }
  | { id: string; type: "RESULT_BANNER"; winners: number[]; category: HandCategory | "fold" };
```

### 26.2 再生プロトコル

```
1. ロジックが状態遷移時に AnimationEvent[] を animationEvents に積む
2. isAnimating = true（この間すべての操作は ANIMATING で拒否：§19.4 / §20）
3. UI はキュー先頭から1件ずつ再生
4. 1件の再生完了で onAnimationEventComplete(event.id) を呼ぶ
5. ロジックは該当イベントを消化し、キューが空になったら isAnimating = false にして次フェーズへ
```

### 26.3 責務の境界（重要）

- **数値・状態の確定はロジック側**：`potAfter` や `amount`、勝者、役カテゴリはイベントに含めて渡す。UI はそれを表示するだけで、勝敗や金額を**自前計算しない**。
- **見た目・タイミングはUI側**：各イベントの duration / easing / 軌道は §22・§24 に従って UI が決める。
- reduced motion 時もイベントは省略しない（再生時間だけ短縮）。

> AnimationPhase 方式（§25）と本イベント契約は併用する。AnimationPhase は「今どの大区間か」、イベントキューは「その区間で何を順に見せるか」を表す。

---

## 27. 画面表示項目

**常時**：chips / tableStack / 現在レート / SB・BB / pot / 自分の手札 / コミュニティカード / CPU席 / Dealer Button / 現在のターン。
**アクション中**：amountToCall / currentBet / minRaise / 選択中Raise額 / 操作ボタン（`availableActions` で活性制御）。
**結果**：勝者 / 自分の役 / CPUの役 / 獲得ポット / profit / tableStack変化 / chips変化。

---

# 実装

## 28. コンポーネント構成

### 28.1 フルセット

```
texasHoldem/
├─ adapter.ts
├─ logic/
│  ├─ holdemEvaluator.ts     # rankBestOfSeven
│  ├─ betting.ts             # pure reducer
│  ├─ cpuStrategy.ts
│  ├─ pot.ts
│  └─ showdown.ts
├─ components/
│  ├─ useTexasHoldem.ts      # reducer/state machine/availableActions/event emit
│  ├─ TexasHoldemGame.tsx
│  ├─ PokerTable.tsx
│  ├─ HoldemSeat.tsx
│  ├─ CommunityCards.tsx
│  ├─ HoleCards.tsx
│  ├─ HoldemControls.tsx
│  ├─ PotDisplay.tsx
│  ├─ ActionLog.tsx
│  ├─ ResultBanner.tsx
│  └─ RebuyModal.tsx
```

### 28.2 共有

```
shared/poker/
├─ deck.ts
├─ handEvaluator.ts
└─ cardTypes.ts

components/casino/
├─ CardFace.tsx
├─ ChipStack.tsx
└─ CasinoButton.tsx
```

---

## 29. サンドボックス仕様

認証/ロビー不要で Texas Hold'em 単体検証に使う。`/sandbox/texas-holdem`。

**機能**：モックチップ／リセット／+1000・+10000／レート切替／持ち込み額変更／CPU人数表示／CPUスタイル変更／固定デッキテスト／任意手札・任意 Flop/Turn/River 注入／animation ON/OFF／速度調整／phase・animationPhase・pot・currentBet・handContributionCap・deck remaining 表示／直近50ハンドログ。

### 29.1 deckProvider

```ts
export interface UseTexasHoldemOptions {
  rate: Rate;
  economy: GameEconomy;
  initialTableStack: number;
  rng?: RNG;
  deckProvider?: () => Card[];
  animationEnabled?: boolean;
}
```
`deckProvider` では重複カード／枚数不足／不正な rank・suit を検出する。

### 29.2 固定デッキの配布順

v1では Burn Card を使わない。先頭から：
```
1. Hole 1周目: SB → BB → UTG → ... → Dealer
2. Hole 2周目: SB → BB → UTG → ... → Dealer
3. Flop 3枚
4. Turn 1枚
5. River 1枚
```
評価時は必ず Hole 2枚 + Community 5枚が揃っている状態にする。

---

## 30. 経済システム

```ts
export interface GameEconomy {
  chips: number;
  placeBet: (amount: number) => boolean;
  settle: (payout: number) => void;
}
```

- 人間の支払いは必ず `placeToPot` 経由。`economy.placeBet` 失敗時は `tableStack`/`pot` を更新しない。
- 人間の勝利：`economy.settle(wonAmount); player.tableStack += wonAmount; pot.amount = 0;`
- CPUは `economy` を使わない（`cpu.tableStack` のみ更新）。
- 人間は常に `player.tableStack <= economy.chips` を維持。持ち込み・REBUYでは `chips` を減らさない。

---

## 31. 破産・救済仕様

```ts
BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.buyInMin; // 100
```
`chips < 100` で最安卓にも座れないため Rescue 対象。

**Rescue導線表示条件**：`chips < BANKRUPTCY_THRESHOLD`、または `tableStack < smallBlind かつ chips < rate.buyInMin`。

---

## 32. テスト

`holdemEvaluator / betting / pot / economy / seatState / cpuStrategy / animation / integration`。特に **chips と tableStack のロックステップ更新、サイドポット非発生、handContributionCap、All-in制限、BBオプション、Fold処理**を重点的にテストする。

### 32.1 主要ケース

- **holdemEvaluator**：7枚から Royal/Straight Flush/Quads/Full House/Flush/Straight/Wheel/Trips/Two Pair/One Pair/High Card を選べる。`compareHandRank` で勝敗・キッカー比較・完全同値=0。`usedHoleCardCount` が 0/1/2 で正しい。重複カード拒否。
- **betting**：SB/BB 徴収（placeToPot 経由で tableStack も減る）。Preflop 行動順=BB左隣。**Preflop で BB が最後に Check できる/Raise できる**。Flop以降=Dealer左隣。ストリート開始時の `currentBet/streetContribution/hasActed` 初期化。Check/Call/Bet/Raise 可否。minRaise未満拒否。tableStack/chips 不足拒否。cap超過の Bet/Raise/All-in 拒否。tableStackが残る疑似All-in拒否。**currentBet超〜minRaise未満のAll-in Raise拒否**。`allInRaiseTo < currentBet` 拒否。Foldは cap対象外・投入はpotに残る。
- **pot**：Call/Bet/Raise で pot 増。Player勝利で chips/tableStack 増。CPU勝利で player chips 不変。Split 均等分配・端数ルール。Fold勝利は Showdownせず配分。
- **economy**：人間Betで chips/tableStack 同額減。人間勝利で同額増。CPU Betで chips不変。`tableStack <= chips` 維持。勝利時 buyInMax 超でもクランプしない。
- **seatState**：tableStack=0 の active seat は allIn になる。`active かつ tableStack=0` が残らない。allInはアクション対象外/Showdown対象。Foldは Showdown対象外。result後の次ハンドで holeCards/contribution/hasActed/lastAction 初期化。
- **cpuStrategy**：tightPassive=weakをFoldしやすい／loosePassive=Callしやすい／tightAggressive=premiumでRaiseしやすい／looseAggressive=広く参加しRaiseも多い。CPUがBB未満なら次ハンド前に補充。CPUの Bet/Raise/All-in は cap超えない。
- **animation**：配布中/CPU思考中/チップ移動中/Flop・Turn・River公開中/Showdown中は操作不可。`animationEnabled=false` でも状態遷移は成立。**（追加）** `animationEvents` が正しい順序で積まれ、`onAnimationEventComplete` 消化でフェーズが進む。
- **integration**：1ハンド完走。Fold勝利で即settling。Showdownで勝者決定。Player勝敗・Splitで profit 正しい。resultから次ハンド。REBUY後再開。全員All-in後に残りコミュニティ公開→Showdown。

---

# 作業分担と運用

## 33. Codex / Claude 作業分担（明確版）

境界は **§26 演出イベント契約** と **§19.5 useTexasHoldem の返り値**。これが両者の唯一の接点。

### 33.1 Codex 担当（ヘッドレス・ロジック・システム）

> 副作用と状態の真実を握る側。UI を一切持たず、純粋にデータと関数で完結させる。テストもこちら。

| ファイル | 内容 |
|---|---|
| `shared/poker/deck.ts` | デッキ生成・シャッフル・`deckProvider` 検証（重複/枚数/不正rank·suit） |
| `shared/poker/cardTypes.ts` | Card / Suit / Rank 型 |
| `shared/poker/handEvaluator.ts` | `rankFiveCardHand` / `compareHandRank` |
| `logic/holdemEvaluator.ts` | `rankBestOfSeven`（7C5全列挙）、`usedHoleCardCount` |
| `logic/betting.ts` | ベット reducer（pure）。`placeToPot`・各アクション・roundComplete・BBオプション |
| `logic/pot.ts` | 単独勝利/Fold勝利/Split/端数/profit 計算 |
| `logic/showdown.ts` | 残存プレイヤーの最強役比較・勝者確定 |
| `logic/cpuStrategy.ts` | プリフロップ評価・ルールベース判断・cap遵守・ショート補充 |
| `adapter.ts` | GameEconomy 連携、Rate→HoldemRateConfig 変換 |
| `useTexasHoldem.ts`（**ロジック部分**） | useReducer 本体・state machine・`getHandContributionCap`・`availableActions` 算出・**`animationEvents` の emit**・`isResolvingRef` ロック・`startHand`/`fold`/`check`/`call`/`bet`/`raiseTo`/`allIn`/`rebuy`/`exitTable` の合法判定と状態更新 |
| 全テスト | `holdemEvaluator / betting / pot / economy / seatState / cpuStrategy / integration`（§32）。`animation.test.ts` のうち**状態遷移系**（`animationEnabled=false` でも遷移成立、イベントキューの順序・消化） |

**Codex への約束事**
- React state を直接ミューテーションしない（immutable update / reducer）。
- 操作関数は必ず `ActionResult` を返す。失敗は理由 + message を返す。
- 数値・勝敗・金額・役カテゴリはロジックで確定し、`animationEvents` に載せて UI に渡す（UI に再計算させない）。
- ブラインドは `placeToPot` 経由（§10.4）。cap は `getHandContributionCap` に集約（§12.2）。
- §36 の不変条件をテストで担保する。

### 33.2 Claude 担当（見えるところ・UI・演出）

> イベント契約に対して“魅せる”側。状態は読み取り専用で受け取り、自前で勝敗・金額を計算しない。

| ファイル | 内容 |
|---|---|
| `components/TexasHoldemGame.tsx` | 画面組み立て・`useTexasHoldem` の購読・イベントキューの再生ループ・`onAnimationEventComplete` 呼び出し |
| `components/PokerTable.tsx` | 緑卓・楕円・疑似3D（§23）・環境演出（vignette/ambient glow） |
| `components/HoldemSeat.tsx` | 席表示・ターンインジケータ（呼吸glow/progress ring §24.5）・CPUラベル（§24.11） |
| `components/CommunityCards.tsx` | Flop/Turn/River 公開演出（§24.3） |
| `components/HoleCards.tsx` | 配布アーチ・フリップ・扇状配置（§24.2）・hover lift |
| `components/HoldemControls.tsx` | 操作ボタン。**`availableActions` で disable + 理由ツールチップ**。Raise スライダー + チップ枚数プレビュー（§24.10） |
| `components/PotDisplay.tsx` | ポットのカウントアップ + scale pulse（§24.4） |
| `components/ActionLog.tsx` | アクションログ表示 |
| `components/ResultBanner.tsx` | 勝利演出の階層（§24.8）・敗北演出（§24.9）・WINNERバナー |
| `components/RebuyModal.tsx` | REBUY UI（SET方式・範囲制限の見せ方） |
| `components/casino/CardFace.tsx` | カード表/裏の描画 |
| `components/casino/ChipStack.tsx` | デノミ別チップスタック描画・アーチ移動 |
| `components/casino/CasinoButton.tsx` | hover lift/glow・press scale・disable dim |
| モーション基盤 | `DURATION`/`EASING`/`SPRING` トークン定義（§22.2）、カラートークン（§22.1） |
| `animation.test.ts` のうち**演出系** | 配布中/思考中/チップ移動中/公開中/Showdown中の操作ロックが UI 上で効いているか |

**Claude への約束事**
- ロジックの状態は読み取りのみ。seat/pot/phase を直接書き換えない（§21.3）。
- すべての演出時間・easing は §22 のトークンを使う（散在禁止）。
- 卓は緑（§23.1）。ベタ塗り禁止、radial-gradient + レール + soft shadow。
- 派手さは Straight Flush / Royal Flush に集中。敗北は上品に（シェイク無し）。
- `prefers-reduced-motion` / `animationEnabled=false` 対応（§24.12）。状態遷移は省略しない。
- 各 `AnimationEvent` の再生が終わったら必ず `onAnimationEventComplete(id)` を呼ぶ（呼ばないとロジックが進まない）。

### 33.3 共同（契約の固定）

先に両者で固定してから着手する：
1. `§19.5` の `UseTexasHoldemReturn`（特に `availableActions` / `animationEvents` / `onAnimationEventComplete`）。
2. `§26.1` の `AnimationEvent` 型（イベント種別と payload）。
3. `§18.2` の `HoldemSeat` / `§4.3` の `Rate` 型。

この3点が固まれば、Codex はヘッドレスで完成まで進め、Claude はモック `useTexasHoldem`（固定イベント列を返すスタブ）に対して演出を先行実装できる。

---

## 34. 実装優先順位

**最重要：最初にUI/演出を作らない。ロジックが不安定な状態で Framer Motion を入れない。順序は ロジック → サンドボックス → テスト → UI → 演出。**

| Phase | 内容 | 主担当 |
|---|---|---|
| 1 コアロジック | deck / cardType / Rate流用 / buy-in / tableStack / GameEconomy / `rankBestOfSeven` / pot / SB·BB / betting reducer / cap / Fold·All-in制限 | Codex |
| 2 状態遷移 | startHand / postingBlinds(placeToPot経由) / dealingHoleCards / preflop / flop·turn·river / showdown / settling / result / nextHand初期化 / **availableActions・animationEvents emit** | Codex |
| 3 CPU対戦 | CPU4人生成 / スタイル / プリフロップ判断 / Flop以降判断 / 自動進行 / 補充 | Codex |
| 4 サンドボックス & テスト | 固定デッキ / 任意手札 / phase表示 / toggle / betting·pot·economy·allIn·seatState·cpuStrategy·integration tests | Codex |
| 5 基本UI | 緑ポーカーテーブル / 自分の手札 / CPU席 / コミュニティ / 操作ボタン(availableActions連動) / pot表示 / action log / result | Claude |
| 6 疑似3D演出 | ホールカード配布 / コミュニティ公開 / チップ移動 / CPUラベル / ショーダウン公開 / 勝利カード発光 / モーショントークン適用 | Claude |
| 7 高度化 | サイドポット / 本格All-in / CPU強化 / 統計 / 実績 / オンライン / 完全3D検討 | 後フェーズ |

---

## 35. 受け入れ基準

1. レート一覧で入場資格を満たす卓のみ選択できる。
2. 持ち込み額が `[buyInMin, min(buyInMax, chips)]` に制限される。
3. 持ち込み時に `chips` は減算されない。
4. `tableStack` は着席中のみ保持され、リロードで破棄される。
5. ブラインド支払いで `chips` と `tableStack` が同額減る（**placeToPot 経由**）。
6. Call / Bet / Raise / All-in で `chips` と `tableStack` が同額減る。
7. Player勝利時に `chips` と `tableStack` が同額増える。
8. CPU勝利時に Player の `chips` は増えない。
9. `tableStack <= chips` が常に成立する。
10. `status=active かつ tableStack=0` の seat が存在しない。
11. 勝利による `tableStack` 増加は `buyInMax` を超えてよい。
12. REBUY は SET方式で `chips` を減算しない。
13. SB/BB がレートに応じて正しく設定される。
14. 5人卓で Dealer Button / SB / BB がハンドごとに回る（**初手の決定が定義済み**）。
15. Preflop / Flop / Turn / River のベットラウンドが正しく進行する。
16. **Preflop で BB が最後に Check/Raise できる。**
17. Foldで1人だけ残った場合、即ポット獲得になる。
18. Fold済みは Showdown対象外。All-in済みは Showdown対象に残る。
19. Showdownで7枚から最強5枚を判定できる。
20. 同着時に Split Pot（端数ルール込み）。
21. v1ではサイドポットが発生しないよう Bet/Raise/All-in が制限される。
22. All-inは残り tableStack 全額投入のみ可能。疑似All-in拒否。currentBet超〜minRaise未満のAll-in Raise拒否。
23. CPUが性格別に行動し、BB未満なら次ハンド前に補充される。
24. **`availableActions` により、UI 上で実行不可能なアクションは disable され、理由が表示される（押せるのに弾かれる状態が無い）。**
25. **`animationEvents` の再生 → `onAnimationEventComplete` 消化でロジックが進行する。**
26. 疑似3Dカード配布／Flop·Turn·River公開／チップ移動／ShowdownでのCPUカード公開がある。
27. 勝者と役名が表示され、勝利演出が役の階層に従う。
28. 卓が緑（radial-gradient + レール）で表示される。
29. アニメーション中は操作できない（`ANIMATING`）。
30. `ActionResult` により失敗理由がUIに表示される。
31. サンドボックスで固定デッキテストができる。
32. スマホ幅でもレイアウトが崩れない。
33. `chips < 100` で Rescue対象になる。
34. React state を直接ミューテーションしていない。reducer / pure function ベースで分離されている。
35. `prefers-reduced-motion` / `animationEnabled=false` で演出が短縮されても状態遷移は成立する。

---

## 36. 最重要不変条件

実装中、常に以下を満たす（テストで担保）。

```
human.tableStack <= economy.chips
pot.amount >= 0
currentBet >= 0
streetContribution >= 0
totalContribution >= 0

status=active かつ tableStack=0 の seat を残さない
folded seat は action / cap / showdown の対象外
allIn seat は action対象外だが showdown対象
side pot を必要とする状況を作らない

Player支払い : chips と tableStack を同額減算（placeToPot経由）
Player勝利   : chips と tableStack を同額加算
CPU支払い/勝利: CPU tableStack のみ更新
持ち込み/REBUY: chips を減算しない
勝利後の tableStack を buyInMax でクランプしない
React state を直接ミューテーションしない

availableActions が示す不可アクションは UI で実行できない
animationEvents は省略されず、完了通知でのみロジックが進む
```

---

## 37. 今後の拡張余地

本格No Limit Hold'em／サイドポット／複数人All-in／CPUモンテカルロ評価／難易度設定／トーナメント／Sit & Go／オンライン対戦／アバター／実績／ハンド履歴詳細／統計／ランキング／完全3Dテーブル（R3F・Three.js）／ボイス・効果音強化。

---

## 38. 仕様上の重要方針まとめ

1. `chips` は真実値。`tableStack` は着席中だけのランタイム値。
2. 持ち込み/REBUY時に `chips` を減らさない。実際のベット・ブラインド・Call・Raise・All-in時だけ減らす。Playerが勝った時だけ増やす。
3. CPUは永続チップを持たない（tableStackのみ）。
4. レート表は Video Poker と共通。`rate.betMin = SB`、`BB = betMin * 2`、`minRaise = BB`。
5. v1ではサイドポットを作らない。All-inは残り全額投入のみ。疑似All-in・中途半端なAll-in Raise禁止。Bet/Raise/All-inは `handContributionCap` で制限。
6. Preflopでは BB の最後の Check/Raise権を保証。
7. Fold済みはShowdown対象外、All-in済みは対象。`active かつ tableStack=0` は禁止。
8. 役判定は共有Evaluator。7枚評価は全組み合わせ(21通り)でよい。
9. UIは疑似3Dを正式採用。卓は緑。完全3Dは後フェーズ。
10. 操作関数は `ActionResult` を返す。演出中は必ず操作をロック。React state は直接ミューテーションしない。
11. **UI/ロジック境界は `availableActions` と演出イベント契約。Codex=ロジック+テスト、Claude=UI+演出。**

---

*v1.2.0 FINAL — 実装はこのドキュメントを単一の真実として進めること。*
