# CASINO HUB ゲーム実装 仕様書（as-built / 再利用テンプレ v1.0 FINAL）

> 本書は **完成版 Texas Hold'em**（core + Effective All-in / SidePot + Visual UI、`main` 統合済み）を
> **as-built（実コードがどう動いているか）** で監査し、CASINO HUB の他ゲーム（ルーレット / Omaha など）に
> **流用できる設計ノウハウ**を抽出したもの。語彙・体裁は `Texas_Holdem_仕様書_v1.2.0_FINAL.md` に準拠。
> 出典は実ファイル（`src/...`）の関数名・型名で示す。**この文書はコードを変更しない。**

---

## §0 メタ / 目的 / 読み方

### 0.1 目的
- 「動く第一版」ではなく「修正を重ねて完成版になったもの」から、**次のゲームを起こすときに効く骨**を残す。
- 各設計を **2層**に仕分ける:
  - **Part A【Platform層 / ゲーム非依存】** — どのゲームでも流用できるパターン。
  - **Part B【Poker固有】** — Hold'em だけの部分。
- **Part C** に「新ゲーム流用テンプレ（手順 / 共有モジュール / 落とし穴）」。

### 0.2 「ルーレット適合」行の見方（必須）
Part A の各節に1行で添える判定。基準ゲーム＝**ルーレット**（*単発ベット → スピン → 一括解決 / ターン制でない / 即時解決*）。
- **○ そのまま流用** … 抽象が真に汎用。
- **△ 縮約/簡略すれば流用** … Poker前提が一部混ざるが整形すれば乗る。
- **× Poker前提** … ターン制・着席前提に依存。

### 0.3 全体の前提（spec v1.x から不変）
- `chips` が唯一の真実値。`tableStack` は着席中だけのランタイム値。持ち込み / REBUY では `chips` を減らさない。
- React state は直接ミューテーションしない（reducer / pure function）。操作関数は `ActionResult` を返す。
- UI は読み取り専用。勝敗・金額・役・SidePot配分・Effective All-in を**UI側で再計算しない**。

---

# Part A 【Platform層 / ゲーム非依存】

## §A1 全体アーキテクチャ（層分け）

```
repositories/storage.ts          ← localStorage 単一窓口（async, schemaVersion, migrate）
        ▲
store/casinoStore.ts (zustand)   ← chips の唯一の変更点。ledger・stats・tableStack lockstep・rescue
        ▲  ┌ useStoreEconomy(gameId, {syncTableStack}) → GameEconomy {chips, placeBet, settle}
        │  │
games/<game>/adapter.ts          ← Rate → ゲーム設定 / GameResult ドラフト変換（economy との接点）
        ▲
games/<game>/useXxx.ts           ← ★ヘッドレス状態機械（useReducer）。logic/* を呼び ActionResult を返す
        │                            availableActions / animationEvents を emit
        ▼
components/useXxxAnimationQueue.ts ← UI派生層。イベントキューを再生し onAnimationEventComplete を呼ぶ
        ▼
components/XxxGame.tsx            ← 画面組み立て。hook を購読し再生ループを回す（表示専用）
```

**原則**: 「副作用と真実 = 下層（store / logic）」「見せ方 = 上層（UI派生 / Game）」。境界は **§A2 演出イベント契約** と **§A3 availableActions** の2本だけ。この2本を固定すれば、ロジックはヘッドレスでテスト可能、UI は安定契約に対して演出だけ作れる（2エージェント分業が成立した理由）。

---

## §A2 Animation Event Contract（最終形）★最重要

ロジック層は「離散的な見せ場」を **イベントのキュー**として emit する。UI はそれを**1件ずつ順に再生**し、完了したら **`onAnimationEventComplete(eventId)`** を呼んでロジックを次へ進める。

### A2.1 イベント型（discriminated union）
`type` で判別する union（`src/games/texasHoldem/types.ts`）。**数値・勝者・役はイベントに載せてロジックが確定**し、UI は表示するだけ。

```ts
export type AnimationEvent =
  | { id: string; type: "POST_BLIND";   seat: number; amount: number }
  | { id: string; type: "DEAL_HOLE";    seat: number; cardIndex: 0 | 1; faceUp: boolean }
  | { id: string; type: "REVEAL_FLOP";  cards: [Card, Card, Card] }
  | { id: string; type: "REVEAL_TURN";  card: Card }
  | { id: string; type: "REVEAL_RIVER"; card: Card }
  | { id: string; type: "CPU_THINKING"; seat: number; ms: number }
  | { id: string; type: "PLAYER_ACTION_LABEL"; seat: number; action: HoldemActionKind; amount?: number }
  | { id: string; type: "CHIP_TO_POT";  seat: number; amount: number; potAfter: number }
  | { id: string; type: "FLIP_HOLE";    seat: number }
  | { id: string; type: "HIGHLIGHT_BEST"; seat: number; cards: Card[] }
  | { id: string; type: "AWARD_POT";    seat: number; amount: number; isSplit: boolean }
  | { id: string; type: "RESULT_BANNER"; winners: number[]; category: HandCategory | "fold" };
```

### A2.2 再生プロトコル（`components/useHoldemAnimationQueue.ts`）
```
1. ロジックが状態遷移時に AnimationEvent[] を animationEvents に積む（isAnimating = true）
2. UI はキュー先頭を1件再生
3. 1件の再生「時間」が経過したら onAnimationEventComplete(event.id) を呼ぶ
4. ロジックが該当イベントを消化し、キューが空になったら次フェーズへ
```

### A2.3 ★ liveness は「タイマー駆動」で保証する
- 完了通知（ack）を**コンポーネントの `animationend` や描画に依存させない**。`durationFor(event)` 経過後に `setTimeout` で**必ず1回** `onAnimationEventComplete` を呼ぶ（`useHoldemAnimationQueue.ts`）。呼ばないとハンドが**永久停止**する。
- 二重発火防止: `playingRef` / `completedRef` / `timerRef` の3点ガード。`events` 配列の identity が変わっても、同じ head.id の最中はタイマーを**潰さない**（incidental re-render でも ack を失わない）。

### A2.4 ★ 「state は最終値・イベントは“いつ/どう見せるか”」と、その罠
- ロジックはイベントを積む**同じ setState** で最終状態（pot, communityCards, seats[].holeCards）も確定する。よって UI は値を `game.*` から読み、イベントは「演出トリガ」として使う。
- **落とし穴（実際に踏んで直した）**: `communityCards` はフロップを**REVEALより前**（直前のアクション演出が流れている間）に既に保持する。素朴に `communityCards.length` で表示すると**フロップが先に表で出てしまい、REVEALで配り直す**二重表示になる。
- **対策**: 「**REVEAL イベントが完了した枚数** = `revealedCommunity`(0→3→4→5)」をキュー側で持ち、それを超える札は**盤面に出さない**。REVEAL中だけ該当チャンクを**裏向きで配って→その場でめくる**。`onAnimationEventComplete` のタイマーコールバック内で `revealedCommunity += chunk`（`useHoldemAnimationQueue.ts`）。
- **reduced motion**: 演出時間は短縮するが**イベント消化は省略しない**（`durationFor(event, true)` は ~100ms だが ack は必ず呼ぶ）。

> **ルーレット適合: △** — 契約自体は流用可。ただしルーレットはターン制 ack の往復が要らず「BET確定 → SPIN → 着地 → 一括精算」の**少数イベント列に縮約**される（例: `SPIN_START` / `BALL_LAND{number}` / `PAYOUT{amounts}` / `RESULT_BANNER`）。タイマー駆動 ack と「state=最終値・イベント=見せ方」「revealedCount 的ゲート（結果数字を着地まで隠す）」はそのまま効く。

---

## §A3 availableActions（事前計算契約）★UI↔ロジック境界の肝

**「どのアクションが今押せるか / 押せない理由 / 推奨額」をロジックが事前計算して渡す。UI は合法判定を一切再計算しない。**

### A3.1 型（`types.ts`）
```ts
export interface ActionAvailability { enabled: boolean; reason?: HoldemActionError; amount?: number }
export interface AvailableActions {
  fold: ActionAvailability; check: ActionAvailability; call: ActionAvailability;
  bet:  ActionAvailability; raise: ActionAvailability; allIn: ActionAvailability;
}
```
- `amount` を持つのは **`allIn` のみ**（= `effectiveAllInAmount`、enabled/disabled 双方で常に同梱）。

### A3.2 logic → UI のフロー（正確な形）
```
logic/betting.ts  calculateAvailableActions(context): AvailableActions
        │   ↑ context = { seats, playerSeatIndex, currentTurnSeatIndex, currentBet, bigBlind, minRaise }
        ▼
useTexasHoldem.ts  const availableActions = useMemo(() => {
        │            if (isAnimating || isResolvingRef.current) return ANIMATING_ACTIONS;  // 全 disable(理由 "ANIMATING")
        │            if (!bettingPhase(state.phase))           return DISABLED_ACTIONS;    // 全 disable(理由 "INVALID_PHASE")
        │            return calculateAvailableActions({...});
        │          }, [...])
        ▼  UseTexasHoldemReturn.availableActions として公開
components/HoldemControls.tsx
           disabled  = !availableActions[kind].enabled
           tooltip   = reasonText(availableActions[kind].reason)
           （legality は読むだけ。再計算しない）
```
- これにより **「押せるのに弾かれる / 押せないのに押せてしまう」が原理的に起きない**。演出中は `ANIMATING_ACTIONS` で全ロックされる（操作の二重実行対策も同時に満たす）。

> **ルーレット適合: ○** — そのまま流用可。ターン非依存の「このベットは置けるか / 理由 / 上限額」を返す契約として、ルーレットの賭けマス・チップ上限・最低/最高ベットにそのまま適用できる。

---

## §A4 二軸レート（buyIn = 入場ゲート / bet = 賭けスケール）

### A4.1 型（`src/types/casino.ts`）と定数（`src/constants/rates.ts`）
```ts
export type Rate = {
  id: RateId; label: string;
  buyInMin: number; buyInMax: number;  // 入場資格ゲート: chips >= buyInMin。持込/REBUY は [buyInMin, min(buyInMax, chips)]
  betMin: number;   betMax: number;    // 賭けスケール: betMin = 1コイン, betMax = MAX BET(= 5×betMin)
  blurb: string;
};
```
- `canAfford(rate, chips) = chips >= rate.buyInMin`、`clampBuyIn`、`betSteps`（betMin×1..5）。
- **2軸の意味**: `buyIn*` は「その卓に座れるか」(残高ゲート)、`bet*` は「1プレイの賭け規模」(スケール)。両者を分けたことで、レート表をゲーム横断で共有できる。

### A4.2 adapter による解釈（`games/texasHoldem/adapter.ts`）
ゲームごとに `bet*` を自分の単位に翻訳する。Hold'em は:
```ts
toHoldemRateConfig(rate) => { smallBlind: rate.betMin, bigBlind: rate.betMin * 2, minRaise: rate.betMin * 2 }
```
（Video Poker は betMin を1コイン額として 1..5 コイン。スロットは betMin をメダル単価として解釈。）

> **ルーレット適合: ○** — そのまま流用可。`buyIn*` を入場ゲート、`bet*` をチップ最小/最大額に直接マップ（adapter で「1チップ = betMin」「テーブル上限 = betMax×倍率」等に翻訳）。Poker の blind 換算が無いだけで枠組みは同一。

---

## §A5 チップエコノミー / adapter / 破産レスキュー

### A5.1 GameEconomy 契約（`games/shared/economy.ts`）
```ts
export type GameEconomy = {
  chips: number;                                  // 現在の残高（リアクティブ）
  placeBet: (amount: number) => boolean;          // 原子的に減算。不足なら false（状態不変）
  settle: (draft: GameResultDraft) => void;       // 1プレイ確定（payout 加算・stats/ledger 記録）
};
```
- 本番は `useStoreEconomy(gameId, { syncTableStack })`（`games/shared/useStoreEconomy.ts`）で store に束ねる。sandbox は `useMockEconomy` を差し替え → **同一ロジックを2系統で動かせる**。

### A5.2 lockstep と「二重減算しない」設計（`store/casinoStore.ts`）
- 人間の支払いは必ず `placeToPot` → `economy.placeBet`。失敗時は `tableStack`/`pot` を更新しない。
- `placeBet`/`applyGameResult` は `options.tableStack: "sync" | "ignore"` を取り、`chips` と `tableStack` を**同額**で増減（lockstep）。
- ★ **着席型ゲーム（Hold'em）は `syncTableStack: false` を使う**。理由: フックが `seat.tableStack` を内部所有しているので、store 側の `tableStack` も動かすと**二重減算**になる。→ store は `chips` だけ動かす。
- 不変条件: `tableStack <= chips` を常に維持。勝利時の増加は `buyInMax` でクランプしない。

### A5.3 破産レスキュー
- `BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.buyInMin`（最安卓にも座れない閾値）。
- `rescue()`（残高を一定額へ底上げ・クールダウン付き）／ `claimDailyBonus()`。UI は `chips < buyInMin` のとき導線（"Get chips"）を出すだけ。

### A5.4 adapter の結果変換
```ts
buildHoldemGameResult(result): GameResultDraft = { gameId:"holdem", bet, payout, profit }
```
→ `economy.settle(draft)` → store が `chips += payout`・stats・ledger を1回の `set()` で原子更新。

> **ルーレット適合: ○** — `placeBet`/`settle` はそのまま。ただし `tableStack` lockstep は「着席して持ち込む」ゲーム用なので、**単発のルーレットは syncTableStack 不要（= 既定の sync でも、そもそも着席概念が無ければ tableStack=null で素通り）**。レスキュー/レート/ledger は完全流用。

---

## §A6 永続化層 repositories/

### A6.1 単一窓口 + スキーマ版管理（`repositories/storage.ts`）
```ts
const ROOT_KEY = "casino-hub";                    // localStorage を触る唯一のモジュール
export type PersistedRoot = { schemaVersion; user; transactions; results; dailyBonus };
loadRoot()/saveRoot()/clearAll()                  // すべて async（将来 Supabase へ sync→async 差し替えても呼び側不変）
migrate(root)                                     // 旧保存を前方移行 + 欠損バックフィル
```
- **chips は user.chips が単一真実**（`chipRepository` は無い）。`tableStack`/`currentRate` は**ランタイム専用＝永続化しない**（リロードで破棄）。
- `casinoStore.persist()` が各ミューテーション後に root 全体を fire-and-forget で保存。`ChipTransaction` は **符号付き台帳**（bet→負, win/bonus→正, `balanceAfter` は適用後 `chips` と一致）。

> **ルーレット適合: ○** — ゲーム非依存。新ゲームは `GameResult` を `gameId:"roulette"` で積むだけ。スキーマ追加が要れば `schemaVersion` を上げ `migrate` に変換を足す（既存セーブを壊さない前方移行が前提）。

---

## §A7 状態機械 ＋ UI派生層の構成パターン

- **ロジック hook = useReducer 状態機械**（`useTexasHoldem.ts`）。`{ type:"replace"; state }` で**まるごと差し替え**る reducer ＋ `stateRef` で最新参照。すべての操作関数（buyIn/startHand/fold/check/call/bet/raiseTo/allIn/rebuy/exitTable）は **`ActionResult`（成功 or 理由+message）を返す**。直接ミューテーション禁止。
- **連打/二重実行対策**: `isResolvingRef` ＋ `animationEvents.length > 0`（演出中）で `locked()` 判定し、操作は `ANIMATING` で拒否。
- **CPU 自動進行**: state変化を監視する `useEffect` が「手番がCPU・キュー空・ベッティングフェーズ」のとき `CPU_THINKING` を積む → 完了通知で `resolveCpuAction` が走り、次の行動/ストリート/結果イベントを積む。UI は何もせずキュー消化で進む。
- **UI派生 hook**（`useHoldemAnimationQueue.ts`）＝ イベント列から「今どう見せるか」の派生状態（active event / revealedCommunity / dealtHoleCards / flippedSeats / chipFly / banner …）を生成。アキュムレータは **POST_BLIND（各ハンド先頭）でリセット**。
- **Game.tsx** は hook を購読し、上記2本（state + 派生）から画面を組むだけ（表示専用・読み取り）。

> **ルーレット適合: ○** — フェーズ数は少ない（`idle → betting → spinning → result`）が同型。reducer + ActionResult + 派生 hook + 購読 Game の三段は流用可。CPU 自動進行ループは不要（無ければ書かない）。

---

## §A8 型定義の組み方（discriminated union 中心）

| 用途 | 形 | 判別子 | 出典 |
|---|---|---|---|
| 演出イベント | `AnimationEvent` union | `type` | `types.ts` |
| 操作結果 | `ActionResult = {ok:true} \| {ok:false; reason; message}` | `ok` | `types.ts` |
| フェーズ | `HoldemPhase` 文字列リテラル union | 値そのもの | `types.ts` |
| アクション可否 | `ActionAvailability {enabled, reason?, amount?}` | `enabled` | `types.ts` |
| ポット | `Pot {amount; sidePots?: SidePot[]}` / `SidePot {amount; eligibleSeatIds; cap}` | — | `types.ts` |
| エラー | `HoldemActionError` 文字列 union（"ANIMATING" 等） | 値 | `types.ts` |

- ★ 効いた点: **イベントもエラーも“判別union”にしたことで、UI 側 `switch(event.type)` / `if (result.ok)` が網羅チェックされ、契約変更時に型で破綻が出る**。`reason` を文字列 union にしておくと UI 側で `reasonText` のような表示専用マップに1対1で落とせる。

> **ルーレット適合: ○** — 同じ型設計をそのまま採用（`SpinEvent` union / `BetResult` / `RoulettePhase` / `BetAvailability`）。

---

# Part B 【Poker固有 / Hold'em】

## §B1 卓 / 着席 / ブラインド
- 5人卓（人間=seat0 ＋ CPU4）。`makeSeats`（`useTexasHoldem.ts`）。CPU は4スタイル（tightPassive/tightAggressive/loosePassive/looseAggressive）。
- ハンド毎に Dealer Button → SB → BB がローテ（`nextOccupiedSeatIndex`）。初手の Button 決定は固定（deckProvider時=0 / 通常=乱数）。
- ブラインドは `placeToPot` 経由で徴収（`chips`/`tableStack` も同額減）。`POST_BLIND` イベントを emit。

## §B2 フェーズ遷移（`HoldemPhase`）
```
unseated/buyIn → waitingHand → postingBlinds → dealingHoleCards → preflop
  → dealingFlop → flop → dealingTurn → turn → dealingRiver → river
  → showdown → settling → result → (next) waitingHand
```
`animationEnabled=false` では演出フェーズ（dealing*/showdown/settling）をスキップして直接遷移するが、**状態遷移自体は省略しない**。

## §B3 ベットラウンド / ターン順 / 行動可否（`logic/betting.ts`）
- **行動可能席**: `isActionable(seat) = status==="active" && tableStack>0 && !effectiveAllInLocked`。
- **次の手番**: `nextActionSeatIndex(seats, from)` は `isActionable` のみ選ぶ → **All-in/Fold 済みは飛ばす**（=自分が All-in したら以降手番が回らない）。
- **ラウンド完了**: `isBettingRoundComplete` = 「未行動の active がいない」かつ「全 contender が `allIn` or `effectiveAllInLocked` or `streetContribution===currentBet`」。
- 行動順: Preflop は BB の左隣始まり（BB に最後の Check/Raise 権）。Flop 以降は Dealer 左隣始まり。ストリート開始時に `streetContribution/hasActed` を初期化（`resetSeatsForNewStreet`）。Bet/Raise は他 active の `hasActed` を倒して再行動権を与える（`resetOtherActivePlayersHasActed`）。

## §B4 アクション仕様（`logic/betting.ts`）
- 投入は集約関数 **`placeToPot`**（人間は `economy.placeBet` 経由・失敗で不変・`status==="active" && tableStack===0` を `allIn` に正規化）。
- 状態量: `currentBet`（その街の最高 streetContribution）/ `streetContribution`（その街の投入）/ `totalContribution`（ハンド累計）。
- `handContributionCap = min(contender ごとの tableStack+totalContribution)`（サイドポット防止の上限基礎）。

## §B5 ★ maxRaiseTo の二重用途 — 最終決着（実コードで確認）
**結論: 別フィールド（`maxBet` / `minRaiseTo`）は作らなかった。** 単一の `maxRaiseTo` を bet-max / raise-max の**両方に流用**し、*最小値だけ* UI 側で契約値から出す。

- ロジック（`logic/betting.ts`）:
  ```ts
  maxRaiseToForSeat(seat, seats) = seat.streetContribution + getEffectiveAllInAmount(seat, seats)
  calculateActionMetrics(...) => { amountToCall, handContributionCap,
                                   maxRaiseTo: streetContribution + effectiveAllInAmount,
                                   effectiveAllInAmount }
  ```
  → `maxRaiseTo` は「raise-**to**（その街の総 streetContribution 目標）」上限。`effectiveAllInAmount` は「追加投入の有効上限」。本エンジンでは **`maxRaiseTo` と All-in 時の raise-to が数値一致**（=相手がカバーできる範囲までしか上げられない＝サイドポット非発生）。
- UI（`components/HoldemControls.tsx`）が *最小値* と *モード* を導出:
  ```ts
  mode = raise.enabled ? "raise" : bet.enabled ? "bet" : null;
  min  = mode === "raise" ? currentBet + minRaise : bigBlind;   // ← 最小値だけ UI 側
  max  = maxRaiseTo;                                            // ← bet/raise 共通の上限
  // step=1, 値は常に [min,max] に clamp
  ```
- **All-in は別扱い**: 表示額 = `availableActions.allIn.amount ?? effectiveAllInAmount`、実行は `allIn()`。スライダー右端（`maxRaiseTo`）と数値が一致しても、**実行経路は分離**（スライダー→`raiseTo` / ALL-IN→`allIn()`。短スタックで raise 不可だが all-in 可、のケースは ALL-IN ボタンのみ活性）。
- **3BET はUIプリセット**（新ロジックアクションではない）: `clamp(currentBet*3, currentBet+minRaise, maxRaiseTo)` を `raiseTo(...)` で呼ぶだけ。`raise.enabled===false` で disable。

> 要点: 「bet/raise の **上限は1本**（maxRaiseTo）、**下限はモード別**（bigBlind / currentBet+minRaise）、**All-in は別チャネル**（allIn.amount）」が最終形。ドキュメントで補ったのではなく **実コードでこの形に収束**した。

## §B6 Effective All-in / SidePot（`logic/betting.ts`, `logic/pot.ts`）
- **Effective All-in 額** `getEffectiveAllInAmount(actor, seats)`: 「自分の総可用(`totalContribution+tableStack`)」と「相手の最大総可用」の小さい方まで。= **相手がカバーできない超過分は投入させない**（v1 のサイドポット制御）。`validateAllIn` は投入額＝有効All-in額の一致を要求。`effectiveAllInLocked` 席は以降の行動対象外。
- **SidePot 構築** `buildSidePots(seats)`: `totalContribution` の段差ごとにポットを切り、各 `{amount, eligibleSeatIds, cap}` を作る。
- **精算** `buildSidePotSettlements`: 各サイドポットで**eligible なショーダウン役のみ比較**して勝者へ配分。端数は **`orderWinnersForRemainder`（Dealer の左隣から）** で1枚ずつ配る。Fold勝利は `buildFoldResult`、Showdown は `buildShowdownResult`。`applySettlementsToSeats` で `tableStack += wonAmount`。
- UI は `HoldemResult.{winners, sidePots, playerWonAmount, playerProfit, winningCategory}` を**表示するだけ**。

## §B7 ハンド評価（`shared/poker/handEvaluator.ts`, `logic/holdemEvaluator.ts`, `logic/showdown.ts`）
- `rankBestOfSeven(hole2, community5)`: 7枚から 7C5=21通りを全列挙し最強5枚（`usedHoleCardCount`付き）。共有 `rankFiveCardHand`/`compareHandRank` を使用。
- `evaluateShowdown(seats, community)`: contender（active/allIn）を best-of-7 で比較、同値は複数勝者（split）。`compareHandRank===0` で引き分け。

## §B8 CPU 戦略（`logic/cpuStrategy.ts`）
- スタイル別のルールベース（tight/loose × passive/aggressive）。**必ず `calculateAvailableActions` の結果に従い**、cap/Effective All-in を超えない。BB 未満になった CPU は次ハンド前に補充（`resetSeatForHand`）。

---

# Part C 次ゲーム流用テンプレ

## §C1 新ゲームを起こす手順（推奨順）
1. **型契約** `games/<game>/types.ts` … `Phase` / `ActionResult` / `AnimationEvent`(union) / `AvailableActions` / `UseXxxReturn`。
2. **ロジック** `games/<game>/logic/*` … pure 関数（reducer 部品 / 役・解決 / 可否計算）。テストはここに集約。
3. **adapter** `games/<game>/adapter.ts` … `Rate → ゲーム設定` と `結果 → GameResultDraft`。
4. **状態機械 hook** `useXxx.ts` … useReducer、`ActionResult` 返却、`availableActions`/`animationEvents` emit、`isResolving`ロック。
5. **UI派生 hook** `useXxxAnimationQueue.ts` … タイマー駆動 ack（**必ず `onAnimationEventComplete`**）、派生表示状態、reduced motion 短縮。
6. **画面** `components/XxxGame.tsx` ＋ 部品 … 読み取り専用。`availableActions` でボタン制御。
7. **sandbox** `/sandbox/<game>` … `useMockEconomy` + 固定 deck/seed、Visual UI トグル。
8. **tests** … logic（pure）＋ 受け入れ（headless 1プレイ完走）＋ UIロック/queue liveness。
9. **本番ページ（hidden）** `pages/games/XxxPage.tsx` … `useStoreEconomy` 接続、rate ガード、rescue/exit。`router.tsx` に hidden route。
10. **lobby 公開** … 検証後に `constants/games.ts` の `status: comingSoon → available`（1行）。

## §C2 流用できる共有モジュール
- `games/shared/economy.ts`（GameEconomy 契約）/ `games/shared/useStoreEconomy.ts`（store 接続・syncTableStack）。
- `games/shared/poker/*`（deck / handEvaluator / cardTypes）※ ポーカー系のみ。
- `repositories/*`（storage 永続化・schemaVersion）/ `store/casinoStore.ts`（chips 唯一の変更点・rescue/dailyBonus）。
- `constants/rates.ts`（二軸レート・canAfford/clampBuyIn/betSteps）/ `types/casino.ts`（Rate/ChipTransaction）。
- `components/casino/*`（`CardFace` / `ChipStack` / `CasinoButton` / `BuyInControl` / `RebuyModal` / `RescueModal`）。
- モーション規約: 純CSS+Tailwind（framer-motion 不使用）。`motion.ts` 的トークン（DURATION/EASING/STAGGER + reduced-motion）をゲーム毎に持つ。

## §C3 落とし穴チェックリスト（実際に踏んで直した）
- ☐ **liveness**: イベント再生は**必ず `onAnimationEventComplete` を呼ぶ**（タイマー駆動・二重発火ガード）。呼ばないと永久停止。
- ☐ **state 先行ゲート**: ロジックが結果値を先に確定するので、UIは「確定済みだが未公開」を**カウンタでゲート**（Hold'em の `revealedCommunity`）。素朴に `length` で出すと先出し/二重表示になる。
- ☐ **availableActions のみで合法判定**（UIで再計算しない）。`amount` を持つのは All-in 等の特殊ボタンだけ。
- ☐ **二重減算**: 着席型は `useStoreEconomy(..., { syncTableStack:false })`（フックが stack を所有）。
- ☐ **3D フリップ**: 反転コンテナは `position:absolute; inset:0; height:100%`（高さ抜けでカードが潰れる罠）。カード面サイズは container-query（`cqw`）で可変対応。
- ☐ **range スライダー**: ネイティブの track/thumb は暗背景で見えない。`::-webkit-slider-thumb` / `::-moz-range-thumb` ＋ track 背景を**明示装飾**（金つまみ＋薄ライン）。
- ☐ **reduced motion**: 短縮はするが**イベント消化は省略しない**。
- ☐ **モバイル**: PC（1280×820）優先で詰め、390px は「大崩れしない（横スクロール無し・wrap）」まで。細部は後回し可。
- ☐ **lobby 非公開のまま実装を入れる**: route/page は入れて `comingSoon` のまま検証 → 公開は最後に1行で。

---

*as-built v1.0 FINAL — 出典は本書記載の `src/...` 各ファイル（main 統合済み）。本書はテンプレであり、ゲーム固有値は各ゲームの adapter / logic で上書きする。*
