# Video Poker 仕様書（完成版）

## Jacks or Better（9/6）改訂版・演出統合版 — v1.2 最終詰め版

---

## 0. メタ情報 / 改訂方針

本ドキュメントは、CASINO HUB に組み込む Video Poker（Jacks or Better 9/6）の確定仕様である。
v1.0（演出統合版）をベースに、矛盾・抜け・曖昧箇所を解消した実装可能版。

* バージョン: v1.2
* 形式: Jacks or Better 9/6（Full House = 9、Flush = 6 / 理論 RTP ≈ 99.54%）
* スコープ: ゲームロジック、レート/持ち込み/経済処理、UI演出、テスト、受け入れ基準
* 想定読者: Claude Code / Codex（実装）、本人（レビュー）

### v1.1 の主な確定事項（決定ログは付録B参照）

1. `tableStack` の所有者を `useVideoPoker`（ランタイム状態）に確定。`economy` は `chips` のみ扱う。
2. ベット控除・配当付与時の `chips` と `tableStack` のロックステップ更新を擬似コードで明文化。
3. リバイは「新しい `tableStack` 値を選ぶ（SET）」方式に確定。端数は `chips` に残るため消えない。
4. `tableStack` の `buyInMax` 上限は「持ち込み・補充時のみ」適用。勝利による増加には上限を課さない。
5. `BANKRUPTCY_THRESHOLD` の参照バグ（配列への `.low` アクセス）を `RATE_BY_ID` 経由に修正。
6. `Card` 型 / `deck.ts` / `handEvaluator.ts` の公開APIを明文化（v1.0は参照のみだった）。
7. 着席フロー（rate選択 → 入場判定 → buy-in → `tableStack` 初期化）を追加。
8. Jacks or Better 判定ロジック（`one_pair` かつ pairRank >= J）を `payout.ts` 仕様として明記。
9. コンポーネント構成（14章フル / 15章簡易）の矛盾を「最小セット」と「フルセット」に整理。

---

## 1. 概要

本ゲームは Jacks or Better（9/6）形式の1人用ビデオポーカーである。

プレイヤーは5枚のカードを配られ、任意のカードを Hold したうえで、Hold していないカードを交換する。最終的な5枚の役に応じて配当を受け取る。

基本フローは以下の通り。

```txt
5枚配布
↓
任意のカードを Hold
↓
Hold していないカードを交換
↓
最終5枚で役判定
↓
配当
```

ゲームはカジノ共通チップ `UserProfile.chips` を使用して遊ぶ。

旧仕様の「レートごとの `minBalance` と `betUnit` だけで管理する方式」は撤回し、台ごとの「持ち込みレンジ」＋「ベットレンジ」を導入する。

また、ゲーム体験を高めるため、カジノ筐体風UI・疑似3Dカード演出・配布/Hold/交換/勝利演出を正式仕様として導入する。

---

## 2. ゲームフロー

### 2.1 着席フロー（v1.1追加）

ゲーム開始前に、レート選択と持ち込みを行う。

```txt
1. レート一覧を表示（LOW〜LEGEND）
2. 各レートに対し入場判定: chips >= rate.buyInMin
   - 満たさないレートは選択不可（グレーアウト）
3. 入場可能なレートを選択
4. 持ち込み額 buyInAmount を選択
   - buyInAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
5. tableStack = buyInAmount で初期化（chips は減算しない）
6. useVideoPoker を initialTableStack = buyInAmount で起動
7. ready フェーズへ
```

### 2.2 ロジックフェーズ

ゲームのロジック状態は以下の3フェーズで管理する。

```txt
ready → draw → result → ready ...
```

| フェーズ   | 操作       | 内部処理                                   |
| ------ | -------- | -------------------------------------- |
| ready  | DEAL     | ベット額を確定し、`chips`/`tableStack` を控除。デッキをシャッフルして5枚配布 |
| draw   | カードタップ   | Hold 状態をトグル                            |
| draw   | DRAW     | Hold 以外を交換し、役判定と配当処理を行う                |
| result | DEAL     | 次のハンドへ移行                               |

中断・リロード・離脱が発生した場合、進行中ハンドは破棄する。中断ハンドの配当処理は行わない。

チップの整合性のため、ベット控除と配当付与は必ず `UserProfile.chips` を真実の値として扱う。

> 注: ロジックフェーズ（`ready`/`draw`/`result`）と、演出フェーズ（`AnimationPhase`）は別管理。両者の対応は §13.1 を参照。

---

## 3. フェーズ詳細

### 3.1 ready

`ready` は次のゲームを開始できる状態である。

可能な操作: BET 変更 / MAX BET / DEAL / レート確認 / `tableStack` 確認 / 退店

DEAL 実行時に以下を行う。

```txt
1. 現在の BET 額を確定（bet = rate.betMin * coinCount）
2. economy.chips >= bet を確認（満たさなければ中断）
3. tableStack >= bet を確認（満たさなければ REBUY を促す）
4. economy.placeBet(bet) を実行（chips -= bet・真実値）
5. tableStack -= bet（ロックステップ）
6. デッキをシャッフルして5枚を配布
7. draw フェーズへ移行
```

DEAL 中はアニメーションを行うため、操作はロックする（`isAnimating = true`）。

### 3.2 draw

`draw` は、最初の5枚が配布された後、Hold を選択する状態である。

可能な操作: カードタップで Hold 切替 / DRAW / 現在役の表示確認 / BET 表示確認

> 「現在役の表示」は、配られた5枚そのままで成立している役（あれば）を参考表示する任意機能。確定配当ではない。

DRAW 実行時に以下を行う。

```txt
1. Hold されていないカードを交換対象にする
2. 交換対象カードを退場アニメーション
3. デッキ残りから新カードを補充
4. 新カードを配布アニメーション
5. 最終5枚で役判定（rankFiveCardHand）
6. payout を計算（evaluatePayout）
7. economy.settle(payout) を実行（chips += payout）
8. tableStack += payout（ロックステップ）
9. result フェーズへ移行
```

Hold されたカードは交換されず、その場に残る。

### 3.3 result

`result` は、最終結果を表示する状態である。

表示内容: 最終手札 / 成立役 / 配当 / profit / 勝利カードハイライト / 配当表該当行ハイライト / `tableStack` / `chips`

可能な操作: DEAL で次ハンド開始 / 退店 / レート画面へ戻る

---

## 4. 配当表

通常配当は以下の通り（1コインあたりの倍率＝総ベットに対する倍率）。

| 役               |  倍率 |
| --------------- | --: |
| Royal Flush     | 250 |
| Straight Flush  |  50 |
| Four of a Kind  |  25 |
| Full House      |   9 |
| Flush           |   6 |
| Straight        |   4 |
| Three of a Kind |   3 |
| Two Pair        |   2 |
| Jacks or Better |   1 |
| その他             |   0 |

* Jacks or Better は、J/Q/K/A のワンペアのみ配当対象（倍率1）。
* 10以下のワンペアは配当0。
* 9/6 は Full House = 9、Flush = 6 を指す（フルペイ）。この値は意図的であり変更しない。

### 4.1 コイン数別 配当表示（クラシック表記）

UI上はコイン数（1〜5）× 役のグリッドで表示してよい。Royal Flush のみ 5コインで跳ねる（§9）。

| 役               | 1coin | 2coin | 3coin | 4coin | 5coin |
| --------------- | ----: | ----: | ----: | ----: | ----: |
| Royal Flush     |   250 |   500 |   750 | 1,000 | **4,000** |
| Straight Flush  |    50 |   100 |   150 |   200 |   250 |
| Four of a Kind  |    25 |    50 |    75 |   100 |   125 |
| Full House      |     9 |    18 |    27 |    36 |    45 |
| Flush           |     6 |    12 |    18 |    24 |    30 |
| Straight        |     4 |     8 |    12 |    16 |    20 |
| Three of a Kind |     3 |     6 |     9 |    12 |    15 |
| Two Pair        |     2 |     4 |     6 |     8 |    10 |
| Jacks or Better |     1 |     2 |     3 |     4 |     5 |

> 表の数値は「コイン枚数」。チップ換算は各セル × `rate.betMin`。
> Royal Flush の 5coin = 4,000 は `CLASSIC_ROYAL_BONUS = true` のとき。`false` のときは 1,250。

---

## 5. 役評価

役評価には共有コア `shared/poker/handEvaluator.ts` の `rankFiveCardHand` を使用する。Video Poker 専用の役判定ロジックは作らない（Hold'em / Omaha / Video Poker 共通）。

### 5.1 公開API（v1.1明文化）

```ts
export type HandCategory =
  | "royal_flush"
  | "straight_flush"
  | "four_of_a_kind"
  | "full_house"
  | "flush"
  | "straight"
  | "three_of_a_kind"
  | "two_pair"
  | "one_pair"
  | "high_card";

export interface HandRank {
  category: HandCategory;
  // キッカー比較用。役を決めるランクから順に高い方を先頭に並べる。
  // 例: one_pair なら tiebreak[0] = ペアのランク, 以降キッカー降順。
  tiebreak: number[];
}

// 5枚の手から役を判定する。
export function rankFiveCardHand(cards: Card[]): HandRank;

// カテゴリ → キッカーの順で比較。a が強ければ正、弱ければ負、同値は0。
export function compareHandRank(a: HandRank, b: HandRank): number;
```

### 5.2 評価仕様

* ストレートはホイール対応: A-2-3-4-5 は5ハイストレートとして扱う。
* Royal Flush は Straight Flush と区別する: A-K-Q-J-10 の同一スート。
* `compareHandRank` により、カテゴリ → キッカーの順で比較できる。
* Jacks or Better の「J以上ペアか」は Video Poker 側の `payout` 判定で扱う（§8.2）。`handEvaluator` は `one_pair` を返すのみ。

---

## 6. レート / 持ち込み仕様

旧仕様の `minBalance + betUnit` は撤回し、台ごとの「持ち込みレンジ」＋「ベットレンジ」を導入する。

### 6.1 レート表

| ランク    |         持ち込み可能額 |  1BET | MAX BET | 目安      |
| ------ | --------------: | ----: | ------: | ------- |
| LOW    |         100〜500 |     1 |       5 | 最初の練習台  |
| MIDDLE |     1,000〜5,000 |    10 |      50 | 普通に遊ぶ台  |
| HIGH   |    5,000〜25,000 |    50 |     250 | かなりヒリつく |
| VIP    |   10,000〜50,000 |   100 |     500 | 上級者向け   |
| ROYAL  |  50,000〜250,000 |   500 |   2,500 | 大勝負台    |
| LEGEND | 100,000〜500,000 | 1,000 |   5,000 | 最上位台    |

全ランク共通ルール:

```txt
MAX BET = 1BET × 5
```

ベットは「1〜5コイン」で表現する。

> レンジは一部重複する（例: HIGH 上限25,000 と VIP 下限10,000）。これは仕様。入場は §6.3 の下限ゲートのみで判定する。

### 6.2 型定義

```ts
export type RateId =
  | "low"
  | "middle"
  | "high"
  | "vip"
  | "royal"
  | "legend";

export interface Rate {
  id: RateId;
  label: string;

  // 持ち込み下限。入場資格にも使う。
  buyInMin: number;

  // 一度に持ち込める上限。
  buyInMax: number;

  // 1コインの価値。
  betMin: number;

  // MAX BET。原則 betMin × 5。
  betMax: number;

  // 台の説明テキスト。
  blurb: string;
}
```

設定例:

```ts
export const VIDEO_POKER_RATES: Rate[] = [
  { id: "low",    label: "LOW",    buyInMin: 100,    buyInMax: 500,    betMin: 1,    betMax: 5,    blurb: "最初の練習台" },
  { id: "middle", label: "MIDDLE", buyInMin: 1000,   buyInMax: 5000,   betMin: 10,   betMax: 50,   blurb: "普通に遊ぶ台" },
  { id: "high",   label: "HIGH",   buyInMin: 5000,   buyInMax: 25000,  betMin: 50,   betMax: 250,  blurb: "かなりヒリつく" },
  { id: "vip",    label: "VIP",    buyInMin: 10000,  buyInMax: 50000,  betMin: 100,  betMax: 500,  blurb: "上級者向け" },
  { id: "royal",  label: "ROYAL",  buyInMin: 50000,  buyInMax: 250000, betMin: 500,  betMax: 2500, blurb: "大勝負台" },
  { id: "legend", label: "LEGEND", buyInMin: 100000, buyInMax: 500000, betMin: 1000, betMax: 5000, blurb: "最上位台" },
];

// v1.1追加: id 引きの安全なルックアップ。配列に .low でアクセスしない。
export const RATE_BY_ID: Record<RateId, Rate> = Object.fromEntries(
  VIDEO_POKER_RATES.map((r) => [r.id, r])
) as Record<RateId, Rate>;
```

### 6.3 入場資格

ある台に座れる条件は以下のみ。

```ts
chips >= rate.buyInMin
```

上限ゲートは設けない。資産が多いプレイヤーも下位の台に座れる。

例（chips = 12,000）:

```txt
LOW      入場可能
MIDDLE   入場可能
HIGH     入場可能
VIP      入場可能
ROYAL    入場不可
LEGEND   入場不可
```

### 6.4 持ち込み buy-in

着席時に、指定範囲内で持ち込み額を選択する。

```ts
buyInAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
tableStack = buyInAmount;
```

持ち込み時点では `UserProfile.chips` から物理的にチップを減算しない。
理由: チップの真実を `UserProfile.chips` の1か所に保ち、リロード/中断で持ち込み分が消失する事故を防ぐため。

### 6.5 テーブルスタック tableStack

`tableStack` は、現在その台に出している分を表すランタイム値。`useVideoPoker` が保持し、**永続化しない**（リロード/離脱で破棄）。

各ハンド中は `chips` と `tableStack` をロックステップで増減させる。

ベット時:

```ts
chips      -= bet;   // economy.placeBet(bet) が実施
tableStack -= bet;   // hook が実施
```

配当時:

```ts
chips      += payout;  // economy.settle(payout) が実施
tableStack += payout;  // hook が実施
```

これにより、ゲーム中の増減は共通チップにも反映される。

> 設計上の帰結: 着席〜退店の間、`chips - tableStack` は「持ち込まなかった財布の残り」として一定に保たれる（リバイ時のみ再定義、§6.7）。`tableStack` が1BET未満になったら、財布に残額があってもベットできず、REBUY が必要になる（セッション単位の自己制限）。

### 6.6 不変条件

常に以下を満たす。

```ts
tableStack <= chips
```

ベット時には以下の両方を満たす必要がある。

```ts
chips      >= bet
tableStack >= bet
```

どちらかを満たさない場合、DEAL は実行できない。

> 不変条件の維持: 着席時 `tableStack = buyInAmount <= min(buyInMax, chips) <= chips`。以後 bet/payout で両者が同額変化するため `tableStack <= chips` は保たれる。配当による増加でも `chips` が同額増えるため破綻しない。

### 6.7 補充 re-buy

`tableStack` が1BET未満になった場合、同じ台で補充できる。

補充は **SET 方式**: 補充後の `tableStack`（新しい総額）を選び直す。

```ts
// rebuyAmount は補充後の新しい tableStack 値そのもの。
rebuyAmount ∈ [rate.buyInMin, min(rate.buyInMax, chips)]

// 適用:
tableStack = rebuyAmount;
```

* 補充後は `tableStack <= min(rate.buyInMax, chips)` を満たす（上の範囲から自動的に成立）。
* 補充は `chips` を物理的に減算しない（着席時と同様）。
* 補充前の端数（1BET未満の残り）は `tableStack` 上は破棄されるが、`chips` には残っているため**消失しない**。実質的には「テーブルに出し直す額を選ぶ」操作。

> SET にした理由: ADD 方式だと `rebuyAmount ∈ [buyInMin, …]` と `tableStack <= min(buyInMax, chips)` が両立しなくなるケースがある（既存スタック + 下限を足すと上限を超え得る）。SET なら範囲制約がそのまま不変条件を満たす。

### 6.8 tableStack 上限の適用範囲（v1.1明確化）

`tableStack <= min(buyInMax, chips)` の上限は、**持ち込み・補充時のみ**適用する。

ハンドの勝利による `tableStack += payout` には上限を課さない。Royal Flush 等で `buyInMax` を超えてもよい（実カジノでも勝ち分でテーブルスタックは上限なく増える）。実装時に勝利後の `tableStack` を `buyInMax` にクランプしないこと。

### 6.9 退店

退店時、`tableStack` は破棄する。持ち込み時に `chips` を減算していないため、`tableStack` を `chips` へ戻す処理は行わない。

退店によって総資産は変化しない。ゲーム中の勝敗による増減のみが `UserProfile.chips` に反映される。

### 6.10 中断・リロード時の扱い

リロード/離脱時、進行中ハンドは破棄。`tableStack` は永続化しないため、リロード後は未着席状態に戻る。

持ち込み時に `chips` を減算していないため、リロードで持ち込み分が消えることはない。ただし、すでに DEAL でベット処理が完了したハンドを中断した場合、そのハンドの配当は発生しない（ベット分の `chips` 減算は確定済み）。

---

## 7. ベット仕様

Video Poker では、1プレイのベットを1〜5コインで指定する。

```ts
coinCount ∈ 1 | 2 | 3 | 4 | 5
bet     = rate.betMin * coinCount;
maxBet  = rate.betMin * 5;
```

例:

```txt
LOW    : 1BET = 1,  MAX BET = 5
MIDDLE : 1BET = 10, MAX BET = 50
HIGH   : 1BET = 50, MAX BET = 250
```

---

## 8. 配当計算

### 8.1 通常配当

```ts
payout = multiplier * bet;
profit = payout - bet;
```

例（MIDDLE / 3コイン / bet = 30）:

```txt
Flush  : payout = 6 × 30 = 180, profit = +150
JoB    : payout = 1 × 30 = 30,  profit = ±0
負け   : payout = 0,           profit = -30
```

### 8.2 payout.ts 仕様（v1.1明文化）

```ts
export interface PayoutInput {
  cards: Card[];          // 最終5枚
  coinCount: 1 | 2 | 3 | 4 | 5;
  betMin: number;         // rate.betMin
  classicRoyalBonus: boolean;
}

export interface PayoutResult {
  category: HandCategory | "none"; // 配当上のカテゴリ。10以下ペアや役なしは "none"
  multiplier: number;              // RF特典時は実効値（payout/bet）の参考値
  payout: number;
  profit: number;
  isJacksOrBetter: boolean;
  isRoyalMaxBonus: boolean;        // RF特典が適用されたか
}

export function evaluatePayout(input: PayoutInput): PayoutResult;
```

判定ロジック:

```txt
bet = betMin * coinCount
rank = rankFiveCardHand(cards)

switch (rank.category):
  royal_flush:
    if (classicRoyalBonus && coinCount === 5):
      payout = betMin * 4000        // §9 特典
      isRoyalMaxBonus = true
    else:
      payout = 250 * bet
  straight_flush:   payout = 50 * bet
  four_of_a_kind:   payout = 25 * bet
  full_house:       payout = 9  * bet
  flush:            payout = 6  * bet
  straight:         payout = 4  * bet
  three_of_a_kind:  payout = 3  * bet
  two_pair:         payout = 2  * bet
  one_pair:
    if (rank.tiebreak[0] >= 11):    // J=11 以上のペア
      payout = 1 * bet              // Jacks or Better
      isJacksOrBetter = true
    else:
      payout = 0                    // 10以下ペアは配当なし → category="none"
  high_card:
    payout = 0                      // category="none"

profit = payout - bet
```

---

## 9. Royal Flush MAX BET 特典

クラシックな Jacks or Better 仕様として、MAX BET 時のみ Royal Flush に特別配当を設定できる。フラグで切り替える。

```ts
CLASSIC_ROYAL_BONUS = true | false;
```

通常時:

```ts
Royal Flush = 250 × bet
```

`CLASSIC_ROYAL_BONUS = true` かつ `coinCount === 5` の場合:

```ts
Royal Flush at MAX BET = rate.betMin * 4000;   // = 4,000コイン
```

例（LOW / MAX BET / betMin=1 / bet=5）:

```txt
通常 RF       : 250 × 5 = 1,250
クラシック特典: 1 × 4,000 = 4,000   （実効 800倍）
```

例（MIDDLE / MAX BET / betMin=10 / bet=50）:

```txt
通常 RF       : 250 × 50 = 12,500
クラシック特典: 10 × 4,000 = 40,000  （実効 800倍）
```

> Straight Flush 以下には MAX BET 特典を適用しない（クラシック準拠）。これにより「常に MAX BET が得」という設計意図が成立する。

---

## 10. ゲーム別のレート解釈

共通カジノ内の各ゲームは、同じレート・持ち込み・スタック仕様をベースにする。ゲーム性に応じてベット解釈を調整してよい。

### 10.1 Video Poker

1〜5コインのベット選択を使用。`bet = rate.betMin * coinCount`、`payout = multiplier * bet`。RF の MAX BET 特典は `CLASSIC_ROYAL_BONUS` で切替。

### 10.2 NEON JACK

実機スロット風のため BET は固定3枚。1〜5コイン選択や MAX BET は適用しない。

```ts
coinCount = 3;
bet = rate.betMin * 3;
```

例: LOW → 3、MIDDLE → 30。`rate.betMin` はチップ/メダル換算として使用。

### 10.3 今後追加するゲーム

ブラックジャック / バカラ / テキサスホールデム / オマハ等は、持ち込み/スタック仕様を基本にしつつ、最小BET・最大BET・ブラインド・アンティ・レイズ上限・サイドベット・テーブル内スタックの使い方を各ゲームで調整してよい。

---

## 11. 経済システム

ゲームロジックはストアを直接参照しない。経済処理は `GameEconomy` を props 注入する。

```ts
export interface GameEconomy {
  // 永続化された真実値（読み取り）。
  chips: number;

  // ベット控除。chips -= amount。成功で true、残高不足で false。
  placeBet: (amount: number) => boolean;

  // 配当付与。chips += payout。payout=0（負け）でも呼んでよい。
  settle: (payout: number) => void;
}
```

* 本番: `useStoreEconomy.ts` が `casinoStore` にバインド。
* サンドボックス: `useMockEconomy.ts` を使用。

```txt
VideoPokerPage    ─ useStoreEconomy ┐
                                    ├→ VideoPokerGame → useVideoPoker
VideoPokerSandbox ─ useMockEconomy  ┘
```

### 11.1 tableStack の所有と更新（v1.1確定）

`tableStack` は `economy` ではなく `useVideoPoker` がランタイム状態として保持する。理由: 非永続・台ごとのランタイム値であり、リロードで破棄されるべきだから。`economy` は永続値 `chips` のみを扱う。

ベット/配当時の更新は hook が `economy` と `tableStack` をロックステップで動かす。

```ts
// useVideoPoker 内（概念実装）
function deal() {
  if (isAnimating) return;
  const bet = rate.betMin * coinCount;
  if (economy.chips < bet) return;        // chips ゲート
  if (tableStack < bet) return;           // tableStack ゲート → REBUY 促す
  if (!economy.placeBet(bet)) return;     // chips -= bet（真実値）
  setTableStack((s) => s - bet);          // ロックステップ
  startDealAnimation(shuffleAndDeal());   // phase → draw、isAnimating 制御
}

function draw() {
  if (isAnimating) return;
  const finalHand = replaceNonHeld();
  const result = evaluatePayout({
    cards: finalHand,
    coinCount,
    betMin: rate.betMin,
    classicRoyalBonus: CLASSIC_ROYAL_BONUS,
  });
  economy.settle(result.payout);          // chips += payout
  setTableStack((s) => s + result.payout);// ロックステップ
  startRevealAnimation(result);           // phase → result
}
```

ゲーム本体の `useVideoPoker.ts` は、本番とサンドボックスで完全共通にする。

---

## 12. UI / 演出仕様

カジノ筐体風の高級感あるUIを採用。配布/Hold/交換/結果にアニメーションを導入し、実際にカードが配られているような体験を作る。

### 12.1 基本方針

* 黒・濃紺・金・ネオンを基調とした高級カジノ風。
* 中央に5枚のカード。上部またはサイドに配当表。下部に BET / MAX BET / DEAL / DRAW 等の操作ボタン。
* `tableStack` / `chips` / `bet` / `win` を常に視認できるようにする。
* カード演出は CSS transform と Framer Motion による疑似3Dを基本とする。
* Three.js / R3F による完全3D化は後フェーズの検討対象。
* 演出はゲームロジックと分離。`useVideoPoker.ts` の役判定・配当・チップ処理は極力変更せず、アニメーションはUIコンポーネント側で制御する。

### 12.2 画面レイアウト

```txt
┌──────────────────────────────┐
│        VIDEO POKER TITLE      │
│      chips / tableStack       │
├──────────────────────────────┤
│        PAY TABLE / INFO       │
├──────────────────────────────┤
│                              │
│    [Card][Card][Card][Card][Card] │ ← PC: 5枚横並び（基本）
│                              │
├──────────────────────────────┤
│ BET  MAX BET  DEAL/DRAW      │
│ HOLD guide / result message  │
└──────────────────────────────┘
```

* PC: 5枚横並びを基本とする。
* スマホ: 小さくなりすぎる場合、中央寄せで横スクロール、または 3+2 の2段配置を許可。

### 12.3 疑似3D表現

CSS の3D transform を用いた疑似3Dで表現する。

```css
perspective: 1000px;
transform-style: preserve-3d;
/* rotateY(...), translate3d(...) */
```

実現する演出: カードが裏面→表面へ回転 / 山札から飛んでくる / 奥行きを持って着地 / Hold カードが少し浮く / 勝利カードが発光。

完全3Dではなく疑似3Dを採用する理由: 通常UIと相性が良い・実装難易度が低い・クリック判定とレスポンシブが簡単・Claude Code で修正しやすい・Video Poker の画面構成では十分に高級感を出せる。

### 12.4 カード配布演出

DEAL 時、5枚は山札位置から順番に配布される。

```txt
1. プレイヤーが DEAL を押す
2. isAnimating = true で操作をロック
3. 山札位置からカードが1枚ずつ移動
4. 左から右へ順番に5枚配置
5. 各カードは最初は裏面で表示
6. 着地後、表面へフリップ
7. 5枚すべての表面表示が終わったら draw フェーズへ
8. isAnimating = false で操作再開
```

カードごとに短い遅延:

```txt
card 1: 0ms / card 2: 90ms / card 3: 180ms / card 4: 270ms / card 5: 360ms
```

### 12.5 Hold演出

`draw` フェーズ中、カードタップで Hold をトグル。

* カード上部に `HOLD` / `HELD` ラベル表示
* カードを少し上に浮かせる
* カード枠を金色または青色に発光
* 背景に軽いグロー
* 再タップで Hold 解除

Hold されたカードは DRAW 時に交換されない。

### 12.6 カード交換演出

DRAW 時、Hold されていないカードのみ交換対象。

```txt
1. プレイヤーが DRAW を押す
2. isAnimating = true で操作をロック
3. Hold されていないカードだけを裏返す
4. 裏返ったカードを山札方向または画面下方向へ退場
5. 新しいカードを山札位置から配る
6. 新しいカードを表面へフリップ
7. すべての交換が完了したら役判定結果を表示
8. result フェーズへ移行
9. isAnimating = false
```

Hold されたカードはその場に残り続け、交換中も Hold 表示を残す。

### 12.7 結果表示演出

役判定後に表示: 成立役 / payout / profit / `tableStack` の変化 / `chips` の変化。

勝利時は勝利役に関係するカードと、配当表の該当役を同時にハイライト。

演出例: 勝利カードの枠を発光 / 配当表該当行を発光 / 獲得チップをカウントアップ / `WIN +xxx`（= payout）を中央表示 / 負け時は控えめに `NO WIN`。

> WIN 表示の数値は payout（戻り総額）。profit はステータス側に補助表示する。

### 12.8 大役演出

Four of a Kind 以上は強演出対象（Four of a Kind / Straight Flush / Royal Flush）。

Royal Flush は専用演出: 背景を金色に発光 / カード周辺に光の粒子 / 配当数字を大きく表示 / 効果音 / 配当表 RF 行を強調 / 画面中央に `ROYAL FLUSH` を大きく表示。

### 12.9 操作ロック

以下のタイミングで操作を無効化する: カード配布中 / 交換中 / フリップ中 / 配当カウントアップ中 / チップ処理中。

```ts
const [isAnimating, setIsAnimating] = useState(false);
```

`isAnimating === true` の間は以下を受け付けない: カードタップ / DEAL / DRAW / BET変更 / MAX BET / 退店 / レート変更。

### 12.10 音演出

音は後フェーズでもよいが、設計上は対応可能にしておく。候補: DEAL音 / フリップ音 / Hold音 / DRAW音 / 小勝利音 / 大勝利音 / RF専用音 / ボタン押下音。音量設定はカジノ共通設定に統合。

### 12.11 実装方針

```txt
React + TypeScript + Framer Motion + CSS疑似3D
```

ゲームロジックは `useVideoPoker.ts` に残し、アニメーション状態はUIコンポーネント側で管理。完全3Dが必要になった場合のみ、後フェーズで R3F / Three.js / 3Dカードオブジェクト / 3Dテーブル / ライト・カメラ演出を検討。初期実装では Three.js を使わない（クリック判定・レスポンシブ・既存UI統合・保守性のため）。

---

## 13. UI状態管理

UIではロジック状態とは別に、演出用の状態を持つ。

```ts
type AnimationPhase =
  | "idle"
  | "dealing"
  | "flipping"
  | "holding"
  | "replacing"
  | "revealing"
  | "settling";

interface CardVisualState {
  cardId: string;       // Card.id と一致
  slotIndex: 0|1|2|3|4; // 画面上の固定スロット
  isFaceUp: boolean;
  isHeld: boolean;
  isWinningCard: boolean;
  isReplacing: boolean;
  dealIndex: number;    // 配布順（0〜4）
}
```

### 13.1 ロジックフェーズ × AnimationPhase 対応（v1.1明文化）

| ユーザー操作 | ロジックフェーズ遷移 | AnimationPhase 推移 | isAnimating |
| ------ | ---------- | ----------------- | ----------- |
| (待機)   | ready      | idle              | false       |
| DEAL   | ready→draw | dealing → flipping → idle | true → false |
| カードタップ | draw（維持）   | holding（瞬間）→ idle | false       |
| DRAW   | draw→result | replacing → revealing → settling → idle | true → false |
| DEAL（次） | result→ready→draw | dealing … | true → false |

要点:
* ロジック側の役判定・配当・チップ処理は DRAW 押下直後に同期的に確定してよい（内部状態）。表示は AnimationPhase に従って遅延反映する。
* `draw` フェーズの Hold タップは `isAnimating === false` のときのみ受け付ける。
* AnimationPhase が `idle` に戻った時点で、対応するロジックフェーズの操作が解放される。

### 13.2 カードIDのライフサイクル（v1.1明文化）

* `Card.id` はハンド内で一意（同一デッキに重複なし、交換補充分も既出5枚と重複しない）。
* DRAW で交換されたスロットには新しい `Card`（新しい `id`）が入る。
* UIキー戦略: 外側スロットコンテナは `slotIndex` でキー（位置を安定させる）、内側のカード面は `card.id` でキー（交換時の退場/登場とフリップをトリガー）。Hold カードは `id` が変わらないため、その場に残る。

基本方針: 役判定/配当はロジック側、見た目の移動・発光・フリップはUI側、`isAnimating` 中はロジック操作を受け付けない、アニメーション完了後に次フェーズへ進む。

---

## 14. コンポーネント構成（フルセット）

実装が進んだ段階の推奨構成。最小実装は §15.1。

```txt
videoPoker/
├─ adapter.ts
├─ logic/
│  └─ payout.ts
├─ components/
│  ├─ useVideoPoker.ts
│  ├─ VideoPokerGame.tsx
│  ├─ VideoPokerTable.tsx
│  ├─ VideoPokerCard.tsx
│  ├─ VideoPokerControls.tsx
│  ├─ VideoPokerPaytable.tsx
│  ├─ VideoPokerStatusPanel.tsx
│  └─ VideoPokerResultBanner.tsx
```

* **VideoPokerGame.tsx**: 親。`useVideoPoker` を呼び、経済情報/レート情報を受け取り、各UIへ状態を渡し、アニメーション状態を管理。
* **VideoPokerTable.tsx**: カード表示エリア。5枚配置・配布/交換アニメーション・疑似3Dの土台。
* **VideoPokerCard.tsx**: 1枚のカード。表/裏表示・フリップ・Hold表示・勝利ハイライト・クリック処理。
* **VideoPokerControls.tsx**: BET- / BET+ / MAX BET / DEAL / DRAW / REBUY / EXIT。`isAnimating` や `phase` に応じて無効化。
* **VideoPokerPaytable.tsx**: 通常配当 / MAX BET時RF特典 / 成立役ハイライト / 現在BETに応じた実配当表示。
* **VideoPokerStatusPanel.tsx**: chips / tableStack / currentBet / coinCount / lastWin / currentRate / buyIn。
* **VideoPokerResultBanner.tsx**: WIN / NO WIN / ROYAL FLUSH / FOUR OF A KIND / payout / profit。

---

## 15. アーキテクチャ

### 15.1 最小実装セット

まず動かす段階のファイル（フルセットへ段階的に分割していく）。

```txt
videoPoker/
├─ adapter.ts
├─ logic/
│  └─ payout.ts
├─ components/
│  ├─ useVideoPoker.ts
│  └─ VideoPokerGame.tsx
```

### 15.2 ページ

```txt
pages/games/VideoPokerPage.tsx   →  /games/video-poker
```

### 15.3 共有ファイル

```txt
shared/poker/
├─ deck.ts            // Card 型、createDeck、shuffle、take
├─ handEvaluator.ts   // rankFiveCardHand、compareHandRank

components/casino/CardFace.tsx   // カード1枚の見た目（スート/ランク描画）
```

#### deck.ts 公開API（v1.1明文化）

```ts
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14; // 11=J,12=Q,13=K,14=A

export interface Card {
  readonly id: string;   // 例 "s-14"。ハンド内で一意。
  readonly suit: Suit;
  readonly rank: Rank;
}

export type RNG = () => number;   // [0, 1)、デフォルト Math.random

export function createDeck(): Card[];                       // 52枚・固定順
export function shuffle(deck: Card[], rng?: RNG): Card[];   // Fisher-Yates・コピーを返す
export function take(deck: Card[], n: number): { taken: Card[]; rest: Card[] };
```

### 15.4 サンドボックス

```txt
sandbox/VideoPokerSandbox.tsx   →  /sandbox/video-poker
```

---

## 16. サンドボックス仕様

認証/ロビー不要で Video Poker 単体の挙動確認に使用。本番と同じ `useVideoPoker.ts` を使う。

提供機能: モックチップ / チップリセット / +1000 追加 / 不足時オートtop-up / レート切替 / 持ち込み額変更 / `tableStack` 表示 / coinCount 変更 / BET 表示 / Plays・Wins・Net 統計 / 直近50ハンドのログ / アニメーション ON/OFF / 速度調整 / Royal Flush 演出テスト / 任意の手札テスト。

### 16.1 任意手札テストの注入（v1.1明文化）

`useVideoPoker` はテスト用の注入口を持つ。

```ts
interface UseVideoPokerOptions {
  rate: Rate;
  economy: GameEconomy;
  initialTableStack: number;      // = buyInAmount
  classicRoyalBonus?: boolean;    // 既定 true
  rng?: RNG;                      // 既定 Math.random（シード可）
  deckProvider?: () => Card[];    // 既定 () => shuffle(createDeck(), rng)
}
```

* `deckProvider` を差し替えると、配られる5枚と交換後のカードを完全に固定できる（先頭5枚が初期手札、6枚目以降が交換補充順）。
* サンドボックスの「Royal Flush 演出テスト」「任意の手札テスト」はこの `deckProvider` 経由で実装する。
* 本番では `deckProvider`/`rng` を渡さず、既定のシャッフルを使う。

---

## 17. 破産・救済仕様

破産閾値は、最安テーブル LOW の `buyInMin`。

```ts
// v1.1修正: 配列に .low でアクセスせず、RATE_BY_ID 経由。
export const BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.buyInMin; // = 100
```

`chips < 100` になった場合、最安テーブルにも入れないため Rescue 対象とする。Rescue は共通カジノ側の救済仕様に従う。

---

## 18. テスト

### 18.1 payout.test.ts

* Royal Flush 通常配当 / MAX BET時RF特典
* Straight Flush / Four of a Kind / Full House / Flush / Straight / Three of a Kind / Two Pair / Jacks or Better
* 10以下ワンペアは0 / ノーハンドは0
* coinCount ごとの配当計算
* `CLASSIC_ROYAL_BONUS` の ON/OFF（5コイン時の 4,000 / 1,250 切替）
* `isJacksOrBetter` / `isRoyalMaxBonus` フラグの正しさ

### 18.2 handEvaluator.test.ts

* Royal Flush / Straight Flush / Four of a Kind / Full House / Flush / Straight / Wheel Straight / Three of a Kind / Two Pair / One Pair / High Card
* タイブレーク比較（`compareHandRank`）
* A-2-3-4-5 の5ハイ判定
* `one_pair` の `tiebreak[0]` がペアランクであること（payout 連携の前提）

### 18.3 rate.test.ts

* 各レートの `betMax = betMin * 5`
* 入場資格 `chips >= buyInMin`
* 持ち込み範囲 `[buyInMin, min(buyInMax, chips)]`
* `tableStack <= chips` の不変条件（着席〜複数ハンド後まで）
* `tableStack < bet` の場合は DEAL 不可
* `chips < bet` の場合は DEAL 不可
* re-buy（SET）後に `tableStack <= min(buyInMax, chips)` を満たす
* 勝利による `tableStack` 増加は `buyInMax` を超えてよい（クランプしない）
* `RATE_BY_ID.low.buyInMin === 100`

### 18.4 economy.test.ts（v1.1追加）

* DEAL で `chips -= bet` と `tableStack -= bet` が同時に起きる
* DRAW（勝ち）で `chips += payout` と `tableStack += payout` が同時に起きる
* DRAW（負け）で `settle(0)` が呼ばれ、`chips`/`tableStack` が変わらない
* `chips - tableStack` がハンドをまたいで一定（リバイ前まで）

### 18.5 animation.test.ts

* DEAL 中は `isAnimating = true` / カードタップ不可 / BET変更不可
* DRAW 中は Hold カードが交換されない / Hold していないカードのみ交換
* 交換完了後に result フェーズへ移行 / result 表示後に次の DEAL が可能
* AnimationPhase が `idle` に戻るまで対応操作がロックされる

---

## 19. 受け入れ基準（v1.1追加）

実装完了の判定基準。すべて満たすこと。

1. 着席フロー: 入場資格を満たすレートのみ選択でき、持ち込み額が範囲内に制限される。
2. 1ハンドの収支が `profit = payout - bet` と一致し、`chips` の増減が `profit` と一致する。
3. `tableStack` と `chips` がベット/配当で同額変化し、`tableStack <= chips` が常に成立。
4. `tableStack < bet` のとき DEAL が不可で、REBUY 後に再開できる。
5. REBUY が SET 方式で、補充後 `tableStack <= min(buyInMax, chips)` を満たす。
6. 9/6 配当表どおりに役が支払われ、10以下ペア・役なしは0。
7. `CLASSIC_ROYAL_BONUS = true` かつ 5コインでのみ RF が 4,000コイン配当になる。
8. リロードで `tableStack` が破棄され、持ち込み分の `chips` は失われない。
9. 全演出中は `isAnimating` で操作がロックされ、Hold は `draw` かつ非アニメ時のみ。
10. サンドボックスで本番と同一の `useVideoPoker.ts` が動き、任意手札テストが可能。
11. `chips < 100` で Rescue 対象になる。
12. スマホ幅でレイアウトが崩れない。

---

## 20. 実装優先順位

### Phase 1: ゲーム仕様の安定化
レート表 / buy-in / tableStack / coinCount / MAX BET / 配当計算 / RF MAX BET特典 / テスト整備（payout・rate・economy・handEvaluator）

### Phase 2: 基本UI改善
カジノ風レイアウト / 配当表 / ステータスパネル / BET操作 / HOLD表示 / 結果表示

### Phase 3: 疑似3Dカード演出
DEAL配布 / フリップ / Hold浮き上がり / 非Holdカード交換 / 勝利カードハイライト

### Phase 4: カジノ演出強化
配当表ハイライト / チップカウントアップ / Four of a Kind以上の強演出 / RF専用演出 / 音演出

### Phase 5: 高度化
最適Holdサジェスト / テーブルランキング / 実績システム / 途中保存 / 3D化検討

---

## 21. Claude Code / Codex 向け実装指示

```txt
Video Poker（Jacks or Better 9/6）を本仕様に沿って実装してください。

【ロジック / 経済】
- React + TypeScript の既存構成を維持する
- ゲームロジック useVideoPoker.ts は極力変更しない
- tableStack は useVideoPoker がランタイム状態として保持し、永続化しない
- ベットは economy.placeBet(bet)（chips -= bet）と tableStack -= bet をロックステップで実施
- 配当は economy.settle(payout)（chips += payout）と tableStack += payout をロックステップで実施
- DEAL ガード: chips >= bet かつ tableStack >= bet。満たさなければ DEAL 不可（tableStack 不足なら REBUY を促す）
- REBUY は SET 方式: rebuyAmount ∈ [buyInMin, min(buyInMax, chips)] をそのまま新しい tableStack にする
- tableStack の上限 min(buyInMax, chips) は持ち込み/補充時のみ。勝利増加はクランプしない
- 役判定は shared/poker/handEvaluator.ts の rankFiveCardHand を使用（専用ロジックを作らない）
- payout は logic/payout.ts の evaluatePayout に集約。Jacks or Better は one_pair かつ tiebreak[0] >= 11
- CLASSIC_ROYAL_BONUS = true かつ coinCount === 5 のときのみ RF を betMin * 4000 にする
- BANKRUPTCY_THRESHOLD は RATE_BY_ID.low.buyInMin（配列に .low でアクセスしない）
- deckProvider / rng を注入口として用意し、本番は既定シャッフル、テストは固定デッキ

【UI / 演出】
- アニメーションは UI 層で実装し、Framer Motion を使用してよい
- 5枚は DEAL 時に左から順番（0/90/180/270/360ms）に配られる
- カードは裏面で出現し、着地後に表面へフリップする
- draw フェーズではカードをタップすると Hold（少し浮かせ、HOLDラベルと光る枠）
- DRAW 時は Hold していないカードだけを裏返して退場させ、新しいカードを配る。Hold カードはその場に残す
- RESULT 時は勝利役のカードと配当表の該当行を光らせる。WIN 表示は payout
- Four of a Kind 以上は強演出、Royal Flush は専用演出
- アニメーション中は isAnimating で操作をロックする（カードタップ/DEAL/DRAW/BET/MAXBET/退店/レート変更）
- 外側スロットは slotIndex でキー、内側カード面は card.id でキー
- 見た目は黒・濃紺・金・ネオン基調の高級カジノ風
- 完全な Three.js 3D ではなく、CSS transform と Framer Motion による疑似3Dで実装する
- スマホでも崩れないレスポンシブ対応にする
- 既存の payout / handEvaluator / economy 設計を壊さない
```

---

## 22. 現状の制約 / 今後の拡張余地

### 後フェーズとして扱う
完全3D化 / R3F導入 / 高度なパーティクル / オンラインランキング / マルチプレイ / 実績システム / 途中ハンド保存 / 最適Holdサジェスト / 本格サウンド設定。
（ただし疑似3Dによる配布・交換・Hold・勝利演出は本仕様に含める。）

### 改善候補
Royal Flush 専用BGM / 大役の派手演出 / 配当表のリアルタイム期待値表示 / 最適Holdサジェスト / 直近50ハンドログ / 最大勝利額表示 / テーブル別統計・ランキング / 実績システム / 総合ロビー連携 / BJ・ポーカー卓との共通UI化 / 疑似3D→完全3D移行検討。

---

## 23. 仕様上の重要方針

1. チップの真実は `UserProfile.chips` の1か所にする。
2. `tableStack` は永続化しないランタイム値（`useVideoPoker` が保持）。
3. 持ち込み・補充時に `chips` を物理的に減算しない。
4. 各ハンドのベットと配当だけを `chips` に反映する。
5. ベット/配当で `chips` と `tableStack` をロックステップ更新し、`tableStack <= chips` を常に守る。
6. `tableStack` 上限（`min(buyInMax, chips)`）は持ち込み/補充時のみ。勝利増加には課さない。
7. Video Poker では1〜5コインBETを採用する。
8. MAX BET（5コイン）時のみ Royal Flush 特典を設定可能にする。
9. NEON JACK では実機風にBET固定3枚とする。
10. 旧仕様の `minBalance + betUnit` は使用しない。
11. UI演出はゲームロジックから分離し、アニメーション中は必ず操作をロックする。
12. 完全3Dではなく、まずは疑似3Dで高級感を出す。
13. 役判定は共有 `handEvaluator` を使い、Jacks or Better 判定だけ `payout` 側で行う。

---

## 付録A. 型定義まとめ

```ts
// shared/poker/deck.ts
export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14;
export interface Card { readonly id: string; readonly suit: Suit; readonly rank: Rank; }
export type RNG = () => number;

// shared/poker/handEvaluator.ts
export type HandCategory =
  | "royal_flush" | "straight_flush" | "four_of_a_kind" | "full_house"
  | "flush" | "straight" | "three_of_a_kind" | "two_pair" | "one_pair" | "high_card";
export interface HandRank { category: HandCategory; tiebreak: number[]; }

// videoPoker/logic/payout.ts
export interface PayoutInput {
  cards: Card[]; coinCount: 1|2|3|4|5; betMin: number; classicRoyalBonus: boolean;
}
export interface PayoutResult {
  category: HandCategory | "none"; multiplier: number; payout: number; profit: number;
  isJacksOrBetter: boolean; isRoyalMaxBonus: boolean;
}

// rate
export type RateId = "low"|"middle"|"high"|"vip"|"royal"|"legend";
export interface Rate {
  id: RateId; label: string; buyInMin: number; buyInMax: number;
  betMin: number; betMax: number; blurb: string;
}

// economy
export interface GameEconomy {
  chips: number;
  placeBet: (amount: number) => boolean;
  settle: (payout: number) => void;
}

// useVideoPoker options
export interface UseVideoPokerOptions {
  rate: Rate; economy: GameEconomy; initialTableStack: number;
  classicRoyalBonus?: boolean; rng?: RNG; deckProvider?: () => Card[];
}

// flags
export const CLASSIC_ROYAL_BONUS = true;
export const BANKRUPTCY_THRESHOLD = RATE_BY_ID.low.buyInMin; // 100
```

---

## 付録B. 決定ログ（v1.0で曖昧だった点と確定理由）

| # | 論点 | v1.0の状態 | v1.1の確定 | 理由 |
| - | -- | ------- | ------- | -- |
| 1 | `tableStack` の所有者 | 不明確（economy か hook か） | `useVideoPoker` が保持 | 非永続・台ごとのランタイム値だから。economy は永続値 chips のみ |
| 2 | bet/payout 時の tableStack 更新 | 文章のみ | 擬似コードで明文化 | placeBet/settle は chips のみ更新。tableStack は hook がロックステップ |
| 3 | REBUY の方式 | 「tableStack を更新するだけ」 | SET（新しい総額を選ぶ） | ADD だと範囲制約と上限が両立しないケースがある。SET は制約がそのまま不変条件 |
| 4 | 勝利時の tableStack 上限 | 言及なし | 上限なし（持ち込み/補充のみ上限） | 実カジノ準拠。勝ち分でクランプしないことを明示 |
| 5 | `BANKRUPTCY_THRESHOLD` | `VIDEO_POKER_RATES.low`（配列に不正アクセス） | `RATE_BY_ID.low` に修正 | 配列に `.low` は型エラー。Record を追加 |
| 6 | Card / deck / handEvaluator API | 参照のみ | 公開APIを明文化 | 実装が一意に決まるようにするため |
| 7 | 着席フロー | 規則のみ | フローを追加 | rate選択〜tableStack初期化までの状態遷移を完備 |
| 8 | Jacks or Better 判定 | 「payout側で扱う」 | one_pair かつ tiebreak[0] >= 11 | 判定ロジックを一意化 |
| 9 | コンポーネント構成の重複（14 vs 15） | 不一致 | フルセット / 最小セットに整理 | 段階的実装の指針として両立させる |
| 10 | カードIDのライフサイクル | 言及なし | id はハンド内一意・交換で新規発番 | React キー戦略と交換アニメの前提を確定 |



---

## 24. v1.2 最終詰め仕様（実装事故防止）

本章以降は v1.1 の補強仕様である。v1.1 と矛盾する場合は、本章以降の v1.2 記述を優先する。

v1.2 の目的は、ゲーム内容を変えることではなく、Claude Code / Codex が実装時に迷いやすい箇所を潰すことである。

### v1.2 の追加確定事項

1. `DEAL` / `DRAW` / `BET変更` / `REBUY` などの操作は `ActionResult` を返す。
2. 連打・二重実行を防ぐため、操作ガードは副作用より先に確定する。
3. `currentBet` は DEAL 時点で固定し、DRAW 完了まで変更不可。
4. `result` フェーズでは BET 変更を許可するが、次ハンド用の変更として扱う。
5. `DRAW` 時の交換順は、左から右のスロット順に固定する。
6. 勝利カードのハイライト用に `winningCardIndexes` を仕様化する。
7. `deckProvider` は固定デッキテスト用として、重複カード・枚数不足を検出する。
8. `tableStack < currentBet` のときは DEAL 不可。ただし `tableStack >= rate.betMin` なら BET を下げれば続行可能。
9. `tableStack < rate.betMin` のときに REBUY / 退店 / Rescue 導線を出す。
10. `prefers-reduced-motion` と演出OFF設定に対応する。

---

## 25. 操作API / ActionResult

ユーザー操作は、失敗理由をUIへ返せるようにする。単に `return` で無視すると、実装後に「なぜ押せないのか」が分からなくなるためである。

```ts
export type VideoPokerPhase =
  | "unseated"
  | "buyIn"
  | "ready"
  | "draw"
  | "result";

export type VideoPokerActionError =
  | "ANIMATING"
  | "NOT_SEATED"
  | "INVALID_PHASE"
  | "INVALID_BET"
  | "INSUFFICIENT_CHIPS"
  | "INSUFFICIENT_TABLE_STACK"
  | "REBUY_REQUIRED"
  | "DECK_EXHAUSTED"
  | "DUPLICATE_CARD"
  | "ECONOMY_FAILED";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      reason: VideoPokerActionError;
      message: string;
    };
```

### 25.1 操作関数の戻り値

`useVideoPoker` は、最低限以下の操作関数を返す。

```ts
interface UseVideoPokerReturn {
  phase: VideoPokerPhase;
  cards: Card[];
  heldIndexes: Set<number>;
  coinCount: 1|2|3|4|5;
  currentBet: number;
  lockedBet: number | null;
  tableStack: number;
  lastResult: PayoutResult | null;
  winningCardIndexes: number[];
  isAnimating: boolean;
  actionError: VideoPokerActionError | null;

  deal: () => ActionResult;
  draw: () => ActionResult;
  toggleHold: (slotIndex: 0|1|2|3|4) => ActionResult;
  setCoinCount: (coinCount: 1|2|3|4|5) => ActionResult;
  maxBet: () => ActionResult;
  rebuy: (newTableStack: number) => ActionResult;
  clearResult: () => void;
}
```

### 25.2 エラー表示方針

UIでは `ActionResult.ok === false` の場合、画面下部またはトーストで短く表示する。

例:

```txt
INSUFFICIENT_TABLE_STACK: テーブル残高が不足しています。BETを下げるか、REBUYしてください。
INSUFFICIENT_CHIPS: チップが不足しています。
ANIMATING: 演出中です。
INVALID_PHASE: 現在この操作はできません。
```

---

## 26. 状態遷移の最終仕様

### 26.1 フェーズ

```txt
unseated → buyIn → ready → draw → result → ready ...
```

| フェーズ | 意味 | 主な操作 |
|---|---|---|
| `unseated` | 未着席 | レート選択へ進む |
| `buyIn` | 持ち込み額選択 | buy-in確定 |
| `ready` | 次ハンド開始前 | BET変更 / MAX BET / DEAL / REBUY / 退店 |
| `draw` | Hold選択中 | Hold切替 / DRAW |
| `result` | 結果表示中 | BET変更 / MAX BET / DEAL / REBUY / 退店 |

### 26.2 DEAL の扱い

`ready` または `result` で `DEAL` できる。

`result` で DEAL した場合は、以下を同時に行う。

```txt
1. 前回の lastResult / winningCardIndexes / heldIndexes をクリア
2. 新しい currentBet を lockedBet として固定
3. bet を chips / tableStack から控除
4. 新しいデッキで5枚配布
5. draw フェーズへ移行
```

### 26.3 BET変更の扱い

BET変更は `ready` / `result` のみ許可する。

`draw` 中は、すでにベットが確定しているため変更不可。

```txt
ready  : BET変更可
draw   : BET変更不可
result : BET変更可（次ハンド用）
```

`lockedBet` は DEAL 時に設定し、DRAW 完了後に `null` へ戻してよい。

```ts
lockedBet = rate.betMin * coinCount; // DEAL時
```

### 26.4 Hold の扱い

Hold は `draw` かつ `isAnimating === false` の場合のみ可能。

```txt
ready/result: Hold不可
draw        : Hold可
演出中       : Hold不可
```

新しい DEAL が始まるたびに `heldIndexes` は必ず空に戻す。

---

## 27. 連打・二重実行対策

`DEAL` / `DRAW` は、チップを動かす副作用を持つため、連打で二重実行されないようにする。

### 27.1 操作ロック順

副作用の前にロックを確定する。

```ts
function deal(): ActionResult {
  if (isAnimating || isResolvingRef.current) {
    return { ok: false, reason: "ANIMATING", message: "演出中です。" };
  }

  if (phase !== "ready" && phase !== "result") {
    return { ok: false, reason: "INVALID_PHASE", message: "今はDEALできません。" };
  }

  const bet = rate.betMin * coinCount;

  if (economy.chips < bet) {
    return { ok: false, reason: "INSUFFICIENT_CHIPS", message: "チップが不足しています。" };
  }

  if (tableStack < bet) {
    return {
      ok: false,
      reason: "INSUFFICIENT_TABLE_STACK",
      message: "テーブル残高が不足しています。BETを下げるか、REBUYしてください。",
    };
  }

  isResolvingRef.current = true;
  setIsAnimating(true);

  try {
    if (!economy.placeBet(bet)) {
      isResolvingRef.current = false;
      setIsAnimating(false);
      return { ok: false, reason: "ECONOMY_FAILED", message: "ベット処理に失敗しました。" };
    }

    setTableStack((s) => s - bet);
    setLockedBet(bet);
    startNewHand();
    return { ok: true };
  } catch {
    isResolvingRef.current = false;
    setIsAnimating(false);
    return { ok: false, reason: "ECONOMY_FAILED", message: "ベット処理に失敗しました。" };
  }
}
```

### 27.2 animation callback の stale 対策

アニメーション完了コールバックが古いハンドに対して発火しないよう、`handId` を使う。

```ts
const handIdRef = useRef(0);

function startNewHand() {
  handIdRef.current += 1;
  const handId = handIdRef.current;

  // animation end
  onDealAnimationComplete(() => {
    if (handId !== handIdRef.current) return;
    setPhase("draw");
    setIsAnimating(false);
    isResolvingRef.current = false;
  });
}
```

---

## 28. デッキ / カード交換仕様

### 28.1 deckProvider の入力検証

`deckProvider` が返すデッキは、以下を満たす必要がある。

```txt
1. 先頭5枚が初期手札
2. 6枚目以降が交換補充カード
3. 最大交換5枚に対応するため、最低10枚あることが望ましい
4. Card.id が重複していないこと
5. 同一 suit/rank のカードが重複していないこと
```

本番では `shuffle(createDeck(), rng)` を使用するため、通常はこの条件を自然に満たす。

サンドボックスやテストで不正な固定デッキが渡された場合は、`DUPLICATE_CARD` または `DECK_EXHAUSTED` を返す。

### 28.2 交換順

DRAW 時の交換順は、必ずスロットの左から右に固定する。

例:

```txt
slot 0: Hold
slot 1: Replace
slot 2: Replace
slot 3: Hold
slot 4: Replace

補充順:
1枚目 → slot 1
2枚目 → slot 2
3枚目 → slot 4
```

これにより、固定デッキテストの期待値が安定する。

### 28.3 全Hold / 全交換

両方とも正式に許可する。

```txt
全Hold   : 交換0枚。そのまま役判定へ進む。
全交換   : 5枚すべて交換。補充カードを5枚使う。
```

---

## 29. 配当結果 / 表示仕様の最終化

### 29.1 表示する数値

結果画面では、以下を明確に分けて表示する。

```txt
BET     : 今回賭けた額
WIN     : payout（戻り総額）
PROFIT  : payout - bet
CHIPS   : 共通チップ残高
TABLE   : tableStack
```

例:

```txt
BET 50 / WIN 0 / PROFIT -50
BET 50 / WIN 50 / PROFIT ±0
BET 50 / WIN 300 / PROFIT +250
```

`WIN` は `payout` を表示する。純増ではない。

### 29.2 ラベル

`PayoutResult.category` と UI 表示名は分離する。

```ts
export const PAYOUT_LABELS: Record<PayoutResult["category"], string> = {
  royal_flush: "ROYAL FLUSH",
  straight_flush: "STRAIGHT FLUSH",
  four_of_a_kind: "FOUR OF A KIND",
  full_house: "FULL HOUSE",
  flush: "FLUSH",
  straight: "STRAIGHT",
  three_of_a_kind: "THREE OF A KIND",
  two_pair: "TWO PAIR",
  one_pair: "JACKS OR BETTER",
  high_card: "NO WIN", // 使用しない場合あり
  none: "NO WIN",
};
```

ただし `PayoutResult.category` は v1.1 どおり `HandCategory | "none"` とする。10以下ペアや役なしは `"none"`。

### 29.3 現在役プレビュー

`draw` 中に表示する現在役は、確定結果ではない。

表示名は以下のどちらかにする。

```txt
CURRENT HAND
または
HELD HAND PREVIEW
```

`WIN` や `PAYOUT` と誤認される表現は避ける。

---

## 30. 勝利カードハイライト仕様

UIで勝利カードだけを光らせるため、`winningCardIndexes` を返す。

```ts
export function getWinningCardIndexes(
  cards: Card[],
  payoutResult: PayoutResult
): number[];
```

### 30.1 ハイライト対象

| 配当カテゴリ | ハイライト |
|---|---|
| `royal_flush` | 5枚すべて |
| `straight_flush` | 5枚すべて |
| `four_of_a_kind` | 4カードの4枚 |
| `full_house` | 5枚すべて |
| `flush` | 5枚すべて |
| `straight` | 5枚すべて |
| `three_of_a_kind` | 3カードの3枚 |
| `two_pair` | 2ペアの4枚 |
| `one_pair` / JoB | J以上ペアの2枚 |
| `none` | なし |

### 30.2 補助関数の考え方

`rankFiveCardHand` は比較用の評価に集中させる。ハイライト判定は Video Poker 側の UI 補助ロジックで行う。

```ts
function groupByRank(cards: Card[]): Map<Rank, number[]> {
  const map = new Map<Rank, number[]>();
  cards.forEach((card, index) => {
    const indexes = map.get(card.rank) ?? [];
    indexes.push(index);
    map.set(card.rank, indexes);
  });
  return map;
}
```

実装方針:

```txt
four_of_a_kind  : rank group size === 4
three_of_a_kind : rank group size === 3
two_pair        : rank group size === 2 のグループを2つ
one_pair        : rank group size === 2 かつ rank >= 11
straight/flush系 : 5枚すべて
none            : []
```

---

## 31. REBUY / 残高不足の最終仕様

### 31.1 tableStack 不足

`tableStack < currentBet` の場合、現在のBETでは DEAL できない。

ただし、`tableStack >= rate.betMin` の場合は、BETを下げれば続行できる。

例:

```txt
rate.betMin = 10
tableStack = 20
coinCount = 5
currentBet = 50

→ DEAL不可
→ coinCount を 2 に下げれば DEAL可能
→ REBUY してもよい
```

### 31.2 REBUY 必須になる条件

実質的にREBUYが必要になるのは以下。

```ts
tableStack < rate.betMin
```

この場合、最小BETすら置けない。

UI表示:

```txt
テーブル残高が最小BET未満です。REBUYするか、退店してください。
```

### 31.3 chips も不足している場合

```ts
chips < rate.buyInMin
```

この場合は同じ台で REBUY できない。

UIでは以下の導線を出す。

```txt
1. 下位レートへ移動
2. 退店
3. chips < BANKRUPTCY_THRESHOLD の場合は Rescue
```

### 31.4 REBUY 範囲

REBUY は v1.1 どおり SET 方式。

```ts
newTableStack ∈ [rate.buyInMin, min(rate.buyInMax, chips)]
tableStack = newTableStack;
```

ただし `chips < rate.buyInMin` の場合は REBUY モーダルを開けない。

---

## 32. UIレスポンシブ / アクセシビリティ

### 32.1 レスポンシブ

目安:

```txt
PC幅      : 配当表 + 5枚横並び + 操作パネル
タブレット : 配当表を上、カードを中央、操作を下
スマホ    : カードは横スクロール、または 3+2 配置
```

カードが小さくなりすぎる場合は、5枚横並びに固執しない。

```css
.cardRow {
  overflow-x: auto;
}

.card {
  min-width: 88px;
}
```

### 32.2 reduced motion

以下のどちらかが true の場合、演出時間を短縮または無効化する。

```txt
1. OS の prefers-reduced-motion
2. ゲーム内設定 animationEnabled === false
```

この場合も、状態遷移は通常と同じにする。

```txt
dealing → flipping → idle
replacing → revealing → settling → idle
```

ただし各フェーズの duration を 0〜50ms 程度に短縮してよい。

### 32.3 キーボード操作

最低限、以下を許可してよい。

```txt
1〜5 : 対応カードの Hold 切替
Space / Enter : DEAL または DRAW
M : MAX BET
Esc : モーダルを閉じる
```

これは必須ではないが、実装できる場合は入れてよい。

---

## 33. サンドボックス追加仕様

サンドボックスは、見た目確認だけでなくロジック確認にも使う。

### 33.1 必須デバッグ表示

```txt
phase
animationPhase
isAnimating
coinCount
currentBet
lockedBet
tableStack
chips
lastResult.category
lastResult.payout
lastResult.profit
winningCardIndexes
deck remaining count
```

### 33.2 固定シナリオ

最低限、以下のボタンを用意する。

```txt
Royal Flush 初期手札
Royal Flush 交換成立
Straight Flush
Four of a Kind
Full House
Flush
Straight
Three of a Kind
Two Pair
Jacks or Better
10以下ペア
No Win
All Hold
All Replace
Low tableStack
Insufficient chips
```

### 33.3 直近ログ

直近50ハンドのログには以下を保存する。

```ts
interface VideoPokerHandLog {
  handId: number;
  rateId: RateId;
  coinCount: 1|2|3|4|5;
  bet: number;
  initialCards: Card[];
  heldIndexes: number[];
  finalCards: Card[];
  category: PayoutResult["category"];
  payout: number;
  profit: number;
  chipsAfter: number;
  tableStackAfter: number;
  createdAt: number;
}
```

---

## 34. v1.2 追加テスト

### 34.1 action.test.ts

* `draw` 中に `setCoinCount` すると `INVALID_PHASE`
* `ready` / `result` では `setCoinCount` 成功
* `isAnimating === true` のとき DEAL / DRAW / Hold が失敗
* `tableStack < currentBet` で DEAL 失敗
* `tableStack >= rate.betMin` なら BETを下げて DEAL 可能
* `tableStack < rate.betMin` で REBUY 導線
* `chips < rate.buyInMin` で REBUY 不可

### 34.2 deckProvider.test.ts

* 固定デッキの先頭5枚が初期手札になる
* 非Holdカードが左から右に交換される
* 全Holdでは補充カードを使わない
* 全交換では補充カードを5枚使う
* 重複カードがある場合 `DUPLICATE_CARD`
* 補充カードが足りない場合 `DECK_EXHAUSTED`

### 34.3 winningCards.test.ts

* Royal Flush は5枚
* Four of a Kind は4枚
* Full House は5枚
* Three of a Kind は3枚
* Two Pair は4枚
* Jacks or Better は2枚
* 10以下ペアは0枚
* No Win は0枚

### 34.4 rapidClick.test.ts

* DEAL 連打で `placeBet` が1回しか呼ばれない
* DRAW 連打で `settle` が1回しか呼ばれない
* アニメーション完了コールバックが古い `handId` に対して状態を書き換えない

### 34.5 display.test.ts

* WIN は payout を表示する
* PROFIT は payout - bet を表示する
* Jacks or Better は `one_pair` ではなく `JACKS OR BETTER` と表示する
* 10以下ペアは `NO WIN`
* Royal Flush MAX BET 時は 4,000コイン表示になる

---

## 35. v1.2 Claude Code / Codex 追加指示

以下を v1.1 の実装指示に追加する。

```txt
【v1.2 追加指示】

- 操作関数は ActionResult を返してください。失敗時に単に return せず、理由を UI に返してください。
- DEAL / DRAW は連打で二重実行されないよう、副作用の前に isResolvingRef または同等のロックを立ててください。
- currentBet は DEAL 時点で lockedBet として固定し、draw 中は BET 変更不可にしてください。
- result フェーズでは BET 変更を許可し、次ハンド用の設定として扱ってください。
- DEAL は ready / result で許可してください。result から DEAL する場合は前回結果をクリアして新ハンドを開始してください。
- tableStack < currentBet の場合は DEAL 不可。ただし tableStack >= rate.betMin なら BETを下げれば続行可能にしてください。
- tableStack < rate.betMin の場合は REBUY / 退店 / Rescue 導線を出してください。
- REBUY は SET 方式を維持してください。chips は減算しません。
- DRAW の交換順は左から右の slotIndex 順に固定してください。
- deckProvider では重複カードと枚数不足を検出してください。
- 全Hold / 全交換を正式にサポートしてください。
- winningCardIndexes を返し、勝利カードだけをハイライトしてください。
- WIN は payout、PROFIT は payout - bet として表示してください。
- Jacks or Better は UI 表示上 `JACKS OR BETTER` とし、10以下ペアは `NO WIN` にしてください。
- prefers-reduced-motion または animationEnabled=false の場合は演出時間を短縮/無効化してください。ただし状態遷移は省略しないでください。
- サンドボックスには phase / animationPhase / lockedBet / winningCardIndexes / deck remaining count を表示してください。
- rapid click / fixed deck / winning card highlight / tableStack不足のテストを追加してください。
```

---

## 36. v1.2 最終受け入れ基準

v1.1 の受け入れ基準に加えて、以下も満たすこと。

1. DEAL / DRAW 連打で、ベット控除・配当付与が二重に発生しない。
2. draw 中に BET / MAX BET / レート変更 / 退店 / REBUY ができない。
3. result 中は BET変更ができ、次の DEAL に反映される。
4. `tableStack < currentBet` では DEAL 不可だが、BETを下げて続行できるケースがある。
5. `tableStack < rate.betMin` では REBUY / 退店 / Rescue 導線が出る。
6. deckProvider の固定デッキで、交換順が常に左から右に再現される。
7. 全Hold・全交換が正常に処理される。
8. 勝利カードのハイライト対象が役ごとに正しい。
9. WIN と PROFIT の表示が混同されない。
10. reduced motion / 演出OFFでも、ゲーム状態が破綻しない。
11. サンドボックスで主要な役と異常系をすべて再現できる。
12. 古い animation callback が次ハンドの状態を上書きしない。


以上をもって、Video Poker のレート・持ち込み・配当・経済処理・UI演出・テスト・受け入れ基準を含む確定仕様（v1.2）とする。

