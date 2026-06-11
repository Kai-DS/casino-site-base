# CASINO HUB — European Roulette 仕様書 v1.0.0 FINAL

> 本書は **as-built 監査（ゲーム実装 仕様書 / 再利用テンプレ v1.0 FINAL）** の Platform 層パターンを土台に、
> ルーレット要件（2026-06-11 確定）を**そのまま実装着手できる完全仕様**に落としたもの。
> 語彙・体裁は `Texas_Holdem_仕様書_v1.2.0_FINAL.md` / `VideoPoker_仕様書_v1.3_FINAL.md` に準拠。
> 分業境界は従来どおり **型契約（§3）＋ Animation Event Contract（§3.5/§6）＋ availableActions（§3.4）**。
> ロジック＝Codex、UI演出＝Claude Code。キックオフプロンプトは §10。

---

## §0 メタ / 目的 / 前提

### 0.1 目的とスコープ

**v1 でやる**
- ヨーロピアンルーレット（シングルゼロ、0〜36）
- インサイドベット全種（ストレートアップ / スプリット / ストリート / コーナー / シックスライン / トリオ / ファーストフォー）
- アウトサイドベット全種（赤黒 / 奇偶 / ロー・ハイ / ダズン / カラム）
- コールベット4種（Voisins du Zéro / Tiers du Cylindre / Orphelins / Jeu Zéro）＋ ネイバーベット（racetrack UI）
- チップ積み上げ・加算・Undo・Clear、スピン後ロック
- ホイール＋ボール逆回転演出、当選ハイライト、回収/支払い演出、結果バナー
- REBET（前回配置の再現）、直近結果ヒストリー（12件）
- sandbox（強制出目・mock economy）→ hidden route → lobby 公開の段階導入

**v1 でやらない（スコープ外を明示）**
- La Partage / En Prison（0 でアウトサイド全敗 — 要件どおり）
- アメリカン（00）
- ベット種別ごとの個別上限テーブル（v1 は一律 `maxBetPerPosition`）
- オートスピン、ホット/コールド統計、確率表示、マルチプレイヤー

### 0.2 参照ドキュメント
- `ゲーム実装仕様書（as-built / 再利用テンプレ v1.0 FINAL）` … 本書の根拠。以下「as-built §An」で参照
- `Texas_Holdem_仕様書_v1.2.0_FINAL.md` / `VideoPoker_仕様書_v1.3_FINAL.md` … 体裁・語彙の基準
- `casino-hub-spec-v1.0.md` … ハブ全体（rates / store / repositories）

### 0.3 全体前提（Platform 不変条件の継承 — as-built §0.3）
- `chips` が唯一の真実値。**ルーレットは非着席ゲームのため `tableStack` を使わない**。
- React state は直接ミューテーションしない（reducer / pure function）。操作関数はすべて `ActionResult` を返す。
- UI は読み取り専用。**当選判定・配当額・勝敗をUI側で再計算しない**。
- ロジック↔UI の境界は §3.4（availableActions）と §3.5（AnimationEvent）の2本のみ。

### 0.4 as-built「ルーレット適合」判定の検証結果

監査の ○/△/× 判定を本書設計で検証した結論：

| as-built | 判定 | 検証結果 |
|---|---|---|
| §A2 Animation Event Contract | △ 縮約 | **正しい**。Hold'em の12イベント → ルーレットは **7イベント**に縮約（§3.5）。タイマー駆動 ack・「state=最終値/イベント=見せ方」・reveal ゲートは全て継承 |
| §A3 availableActions | ○ | **ほぼそのまま**。固定6ボタン型 → 盤面型に1点だけ拡張：共通ゲート `placeChip` ＋ 上限到達位置リスト `cappedPositionIds`（§3.4） |
| §A4 二軸レート | ○ | そのまま。adapter で「1チップ=betMin / 位置上限=betMax」へ翻訳（§2.4） |
| §A5 経済 / レスキュー | ○ | そのまま。ただし**監査が触れていない決定が1つ必要だった**：ベットを economy に渡すタイミング。→ **ベッティング中はローカルステージング、`placeBet` はスピン確定時に合計1回**（§2.3）。Undo/Clear が経済操作ゼロで成立し、台帳も1スピン1往復で済む |
| §A6 repositories | ○ | そのまま。`gameId: "roulette"` を積むだけ。スキーマ変更なし |
| §A7 状態機械＋UI派生層 | ○ | そのまま。CPU自動進行ループは不要なので書かない |
| §A8 discriminated union | ○ | そのまま採用（§3） |

**maxRaiseTo の教訓の適用**：Hold'em で問題化した「1フィールドの二重用途」を避けるため、result フェーズの盤面リセットは `clear` に兼任させず **`newBets` を別アクションとして分離**した（§3.4）。

---

## §1 ゲームルール（確定値）

### 1.1 基本方式
- ヨーロピアンルーレット。数字 **0〜36 の37ポケット**、シングルゼロ（00 なし）
- 0 は**緑**。赤/黒はヨーロピアン標準配置（1.2）
- ホイール上の数字順はヨーロピアン標準順（1.2）
- ハウスエッジ：全ベット一律 **1/37 ≈ 2.70%**（La Partage なし）

### 1.2 ホイール定数・色定義（`constants/wheel.ts`）

```ts
/** ホイール上の数字順（時計回り・先頭=0）。37要素 */
export const WHEEL_ORDER = [
   0, 32, 15, 19,  4, 21,  2, 25, 17, 34,  6, 27, 13, 36, 11, 30,
   8, 23, 10,  5, 24, 16, 33,  1, 20, 14, 31,  9, 22, 18, 29,  7,
  28, 12, 35,  3, 26,
] as const;

export const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type PocketColor = "red" | "black" | "green";
export const colorOf = (n: number): PocketColor =>
  n === 0 ? "green" : RED_NUMBERS.has(n) ? "red" : "black";
```

★ **単一ソース原則**：ホイール描画 / racetrack の数字配列 / ネイバー計算 / コールベットの対象範囲検証の**4箇所すべてが同一の `WHEEL_ORDER` を参照**する。重複定義・ハードコード禁止。

### 1.3 ベット一覧と配当

| 種別 | type | 対象 | 配当 | n（対象数） | 位置数 |
|---|---|---|---|---|---|
| ストレートアップ | `straight` | 1数字 | 35:1 | 1 | 37 |
| スプリット | `split` | 隣接2数字（0-1/0-2/0-3 含む） | 17:1 | 2 | 60 |
| ストリート | `street` | 横一列3数字 | 11:1 | 3 | 12 |
| コーナー | `corner` | 交差4数字 | 8:1 | 4 | 22 |
| シックスライン | `sixLine` | 隣接2列6数字 | 5:1 | 6 | 11 |
| トリオ | `trio` | 0-1-2 / 0-2-3 | 11:1 | 3 | 2 |
| ファーストフォー | `firstFour` | 0-1-2-3 | 8:1 | 4 | 1 |
| 赤 / 黒 | `red` / `black` | 各18数字 | 1:1 | 18 | 2 |
| 奇数 / 偶数 | `odd` / `even` | 各18数字 | 1:1 | 18 | 2 |
| ロー / ハイ | `low` / `high` | 1–18 / 19–36 | 1:1 | 18 | 2 |
| ダズン | `dozen` | 1–12 / 13–24 / 25–36 | 2:1 | 12 | 3 |
| カラム | `column` | 縦列12数字 | 2:1 | 12 | 3 |

- **ポジション総数 = 157**（テスト §8.2 で件数を固定検証）
- カラム定義：`column-1` = {1,4,…,34} / `column-2` = {2,5,…,35} / `column-3` = {3,6,…,36}
- 配当は**純配当倍率 n:1**。勝ち戻り総額 = `amount × (payout + 1)`（元金込み）。この式は §5.1 の1箇所にのみ存在する

★ **配当の自己検証不変量**：全157ポジションについて
**`coveredNumbers.length × (payout + 1) === 36`** が成立する（straight: 1×36 / split: 2×18 / street・trio: 3×12 / corner・firstFour: 4×9 / sixLine: 6×6 / even-money: 18×2 / dozen・column: 12×3）。
→ ポジションテーブルのデータ誤りを一発で検出できるため、**property test として必須実装**（§8.2）。

### 1.4 コールベット定義（`constants/callBets.ts`）

コールベットは**新しいベット型ではない**。既存インサイドポジションへの**定型展開（マクロ）**として実装する：

```ts
export type CallBetId = "voisins" | "tiers" | "orphelins" | "jeuZero";

export interface CallBetDef {
  id: CallBetId;
  label: string;            // racetrack 表示名
  chipCount: number;        // 必要チップ枚数（× 選択チップ額）
  components: ReadonlyArray<{ positionId: PositionId; chips: number }>;
}
```

| id | label | 枚数 | 展開（positionId × chips） | カバー数字 |
|---|---|---|---|---|
| `voisins` | VOISINS DU ZÉRO | 9 | `trio-0-2-3`×2, `split-4-7`×1, `split-12-15`×1, `split-18-21`×1, `split-19-22`×1, `corner-25-26-28-29`×2, `split-32-35`×1 | 17数字（ホイール弧 22→25、0を含む） |
| `tiers` | TIERS DU CYLINDRE | 6 | `split-5-8` `split-10-11` `split-13-16` `split-23-24` `split-27-30` `split-33-36` 各×1 | 12数字（ホイール弧 27→33、0の対面） |
| `orphelins` | ORPHELINS | 5 | `straight-1`×1, `split-6-9` `split-14-17` `split-17-20` `split-31-34` 各×1 | 8数字（1,6,9,14,17,20,31,34） |
| `jeuZero` | JEU ZÉRO | 4 | `split-0-3` `split-12-15` `split-32-35` 各×1, `straight-26`×1 | 7数字（0,3,12,15,26,32,35） |

設計上の帰結：
- **配当計算は完全に既存ロジックの再利用**。`resolveSpin` はコールベットの存在を知らない
- 17 に Orphelins を置いた場合、`split-14-17` と `split-17-20` の**両方が当たる**（標準仕様どおり）
- 展開された各 `PlacedBet` は同一 `groupId` を持つ → Undo・ハイライト・回収/支払い演出を**グループ単位**で扱える
- ★ テスト必須：各コールベットの「展開 components のカバー数字の和集合」が「`WHEEL_ORDER` 上の定義弧から計算した集合」と一致すること（§8.2）

### 1.5 ネイバーベット（racetrack）

```ts
/** center とその左右 n 個（ホイール順）にストレートアップを 1 枚ずつ。合計 (2n+1) 枚。
 *  戻り値は CallBetDef.components と同形（straight-* への展開） */
export function makeNeighborsBet(
  center: number,
  n: number,
): ReadonlyArray<{ positionId: PositionId; chips: number }>;
```

- `n` の範囲：**1〜4、既定 2**（`config.neighborRange`）。UI はセレクタで切替
- 計算：`idx = WHEEL_ORDER.indexOf(center)`、対象 = `WHEEL_ORDER[(idx + k + 37) % 37]`（k = −n…+n）。**配列端の wrap-around 必須**（例：0 の n=2 → {3, 26, 0, 32, 15}）
- コスト = `(2n + 1) × 選択チップ額`。展開は全て `straight-*` への通常ベット（groupId 付与、origin: "racetrack"）

### 1.6 0 の扱い

- 0 が出た場合、赤黒・奇偶・ロー/ハイ・ダズン・カラムは**すべて負け**
- ★ 実装原則：これは「アウトサイドポジションの `coveredNumbers` に 0 が含まれない」ことの**データ上の帰結**として実現する。**`if (n === 0)` のような特例分岐を判定ロジックに書かない**（データ駆動原則。La Partage 等を将来入れる場合のみ分岐が生まれる）

---

## §2 アーキテクチャ / ファイル構成

### 2.1 層構成（as-built §A1 準拠）

```
repositories/storage.ts            ← 変更なし（schemaVersion 据え置き）
        ▲
store/casinoStore.ts               ← 変更なし。chips の唯一の変更点
        ▲   useStoreEconomy("roulette") → GameEconomy {chips, placeBet, settle}
        │   （非着席のため syncTableStack 指定不要 = 既定のまま素通り）
games/roulette/adapter.ts          ← Rate → RouletteConfig / 結果 → GameResultDraft
        ▲
games/roulette/useRoulette.ts      ← ★ヘッドレス状態機械（useReducer）
        │                             availableActions / animationEvents を emit
        ▼
components/useRouletteAnimationQueue.ts ← UI派生層。タイマー駆動 ack・reveal ゲート
        ▼
components/RouletteGame.tsx        ← 画面組み立て（表示専用）
```

### 2.2 ディレクトリ

```
src/games/roulette/
  types.ts                 … §3 の型契約（分業の同期点。最初に確定）
  constants/
    wheel.ts               … WHEEL_ORDER / RED_NUMBERS / colorOf
    positions.ts           … 全157 BetPosition の生成＋自己検証（§5.4）
    callBets.ts            … CALL_BET_DEFS / makeNeighborsBet（§1.4–1.5）
  logic/
    bets.ts                … ベット操作 pure 部品・上限判定・availability（§5.3）
    resolve.ts             … resolveSpin / buildSpinResult（§5.1–5.2）
  adapter.ts               … toRouletteRateConfig / buildRouletteGameResult（§2.4）
  useRoulette.ts           … 状態機械 hook（§4）
src/components/roulette/
  RouletteGame.tsx         … 画面組み立て
  RouletteTable.tsx        … 盤面（ヒット領域 §7.2）
  Racetrack.tsx            … racetrack UI（§7.3）
  RouletteWheel.tsx        … ホイール＋ボール（§6.4）
  ChipSelector.tsx / RouletteControls.tsx / ResultBanner.tsx / HistoryStrip.tsx
  useRouletteAnimationQueue.ts … 再生キュー（§6）
  tableLayout.ts           … positionId → ヒット領域座標（★UIレイヤ専用。logic から import 禁止）
  motion.ts                … DURATION / EASING トークン（§6.6）
src/pages/games/RoulettePage.tsx   … 本番ページ（hidden route）
src/pages/sandbox/RouletteSandbox.tsx … /sandbox/roulette（§8.1）
```

### 2.3 経済接続（★本書の重要決定）

**ベッティング中のチップはローカルステージング。economy への反映はスピン確定時に1回。**

```
betting 中:  bets[] に PlacedBet を積むだけ（chips 未減算）
             利用可能額 = economy.chips − stagedTotal   ← placeChip 判定と表示の基準
spin() 確定: economy.placeBet(stagedTotal) を 1 回      ← 原子的。false なら状態不変
settle:      economy.settle({ gameId: "roulette", bet: stagedTotal,
                              payout: totalReturned, profit }) を 1 回（タイミングは §4.4）
```

この設計の帰結：
- **Undo / Clear / 離席が経済操作ゼロで成立**する（refund 概念が不要。GameEconomy 契約 `{chips, placeBet, settle}` を変更しない）
- 台帳（ChipTransaction）は **1スピンにつき bet(−) と win(+) の1往復**。ヒストリーが汚れない
- betting 中の離席は無料で安全（ステージングは破棄するだけ）
- ★ ヘッダーの残高表示は `economy.chips` をそのまま出し、盤面側に「BET合計: stagedTotal」を併記する。spinning 移行時に chips が一括で減る（=賭けた感）、精算時に戻る（§4.4）

**未精算ガード**：`placeBet` 済みかつ `settle` 未了のまま unmount/離脱すると勝ち分が消える。
→ `state.settlement != null && !state.settled` のとき、unmount cleanup / `exitTable()` で **`flushPendingSettlement()`（演出スキップで即 settle）** を必ず呼ぶ（§4.5、チェックリスト §9）。

### 2.4 レート adapter（`adapter.ts`）

as-built §A4 の二軸レートをルーレットの単位へ翻訳する：

```ts
export interface RouletteConfig {
  chipDenoms: readonly number[]; // チップセレクタの額面
  minTotalBet: number;           // スピン成立の最低合計
  maxBetPerPosition: number;     // 1ポジションあたり上限
  maxTotalBet: number;           // 1スピン合計上限
  neighborRange: { min: number; max: number; default: number };
}

export function toRouletteRateConfig(rate: Rate): RouletteConfig {
  return {
    chipDenoms: [1, 2, 5].map((m) => m * rate.betMin), // ★調整値
    minTotalBet: rate.betMin,
    maxBetPerPosition: rate.betMax,                    // = betMin × 5
    maxTotalBet: rate.betMax * 10,                     // ★調整値（= betMin × 50）
    neighborRange: { min: 1, max: 4, default: 2 },     // ★調整値
  };
}

export function buildRouletteGameResult(s: SpinSettlement): GameResultDraft {
  return { gameId: "roulette", bet: s.totalBet, payout: s.totalReturned, profit: s.profit };
}
```

- 入場資格は従来どおり `canAfford(rate, chips) = chips >= rate.buyInMin`。RoulettePage の rate ガード＋ RescueModal 導線はハブ共通実装を流用
- ★調整値（chipDenoms / maxTotalBet 倍率 / neighborRange）は adapter 内の定数に集約し、バランス調整はこのファイルだけで完結させる
- サニティ：最小単位チップ（betMin）で Voisins(9)＋Tiers(6)＋Orphelins(5) を同時に置いても 20×betMin ≤ maxTotalBet(50×betMin) で成立する

---

## §3 データ設計 / 型契約（`types.ts`）

> このセクションが**分業の同期点**。Codex / Claude Code とも、ここに書かれた型を変更する場合は仕様書側を先に直すこと。

### 3.1 BetPosition / PlacedBet

```ts
export type PositionId = string; // 命名規則は下表。例 "straight-17", "split-17-20", "dozen-2", "red"

export type BetType =
  | "straight" | "split" | "street" | "corner" | "sixLine" | "trio" | "firstFour"
  | "red" | "black" | "odd" | "even" | "low" | "high" | "dozen" | "column";

export type BetCategory = "inside" | "outside";

/** 静的定義（全157件をビルド時に生成・凍結） */
export interface BetPosition {
  id: PositionId;
  type: BetType;
  label: string;                          // "17", "17/20", "2nd 12", "RED" など
  coveredNumbers: readonly number[];      // 昇順。当選判定の唯一のソース
  payout: number;                         // 純配当倍率 n（n:1）
  category: BetCategory;
}

/** 実行時のベット1口（操作1回 = 1エントリ。同一位置に複数エントリ可、表示は集約） */
export interface PlacedBet {
  betId: string;                          // uuid
  positionId: PositionId;
  amount: number;
  groupId?: string;                       // コールベット/ネイバー展開のまとまり
  origin: "table" | "racetrack";
}
```

**PositionId 命名規則**（type 接頭辞 + 昇順カバー数字。決定的・自己記述的・テスト容易）：

| type | 形式 | 例 |
|---|---|---|
| straight | `straight-{n}` | `straight-0`, `straight-17` |
| split | `split-{a}-{b}` | `split-0-2`, `split-17-20` |
| street | `street-{a}-{b}-{c}` | `street-13-14-15` |
| corner | `corner-{a}-{b}-{c}-{d}` | `corner-16-17-19-20` |
| sixLine | `six-{a}-…-{f}` | `six-13-14-15-16-17-18` |
| trio / firstFour | `trio-…` / `first4-0-1-2-3` | `trio-0-2-3` |
| even-money | 固定6種 | `red` `black` `odd` `even` `low` `high` |
| dozen / column | `dozen-{1\|2\|3}` / `column-{1\|2\|3}` | `dozen-2` |

**要件フィールドとの対応**（要件は満たした上で型安全な形に正規化）：

| 要件のフィールド | 本仕様での所在 |
|---|---|
| `betType` / `label` / `coveredNumbers` / `payout` | `BetPosition` の同名フィールド |
| `amount` | `PlacedBet.amount` |
| `position`（UI座標） | `components/roulette/tableLayout.ts`（positionId → ヒット領域。**ロジック非依存**） |
| `isInsideBet` / `isOutsideBet` | `BetPosition.category`（boolean 2本より排他が型で保証される） |
| `isCallBet` | `PlacedBet.origin === "racetrack"`（＋`groupId` 付与） |

### 3.2 SpinResult / SpinSettlement

```ts
export interface SpinResult {
  number: number;                    // 0–36
  color: PocketColor;                // 0 は "green"
  parity: "odd" | "even" | null;     // 0 は null
  range: "low" | "high" | null;      // 0 は null
  dozen: 1 | 2 | 3 | null;
  column: 1 | 2 | 3 | null;
}

export interface BetOutcome {
  betId: string;
  positionId: PositionId;
  amount: number;
  won: boolean;
  returned: number;                  // won ? amount × (payout + 1) : 0
}

export interface SpinSettlement {
  result: SpinResult;
  outcomes: readonly BetOutcome[];
  totalBet: number;
  totalReturned: number;
  profit: number;                    // totalReturned − totalBet
  winningBetIds: readonly string[];
  losingBetIds: readonly string[];
}
```

### 3.3 フェーズ / エラー / ActionResult

```ts
export type RoulettePhase = "idle" | "betting" | "spinning" | "settling" | "result";

export type RouletteActionError =
  | "ANIMATING"            // 演出中ロック（全操作共通）
  | "INVALID_PHASE"
  | "INSUFFICIENT_FUNDS"   // 利用可能額（chips − stagedTotal）不足
  | "POSITION_LIMIT"       // maxBetPerPosition 超過
  | "TABLE_LIMIT"          // maxTotalBet 超過
  | "BELOW_MIN_TOTAL"      // spin 時に stagedTotal < minTotalBet
  | "NO_BETS"              // undo/clear/spin 対象なし
  | "NO_LAST_BETS"         // rebet 対象なし
  | "INVALID_POSITION"
  | "ECONOMY_REJECTED";    // economy.placeBet が false（理論上は事前検証で防がれる）

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: RouletteActionError; message: string };
```

### 3.4 AvailableActions（事前計算契約 — as-built §A3 継承）

```ts
export interface ActionAvailability {
  enabled: boolean;
  reason?: RouletteActionError;
  amount?: number;                   // 参考値（下表）
}

export interface AvailableActions {
  placeChip: ActionAvailability;     // 選択中チップを「どこかに」置けるか。amount = 選択中チップ額
  undo:      ActionAvailability;
  clear:     ActionAvailability;     // betting 専用：全ベット消去（phase は betting のまま）
  spin:      ActionAvailability;     // amount = stagedTotal
  rebet:     ActionAvailability;     // amount = 再現に必要な合計額
  newBets:   ActionAvailability;     // result 専用：盤面リセット → betting へ
}
```

- ★ **`clear` と `newBets` は分離する**（maxRaiseTo 二重用途の教訓。1フィールドにフェーズで意味が変わる役割を与えない）
- `useRoulette` 内の `useMemo` で算出。**演出中は全キー disabled（reason: "ANIMATING"）の `ANIMATING_ACTIONS` を返す**（Hold'em と同一パターン。二重実行対策を兼ねる）
- UI は `enabled` / `reason` を**読むだけ**。合法判定の再計算禁止
- **ポジション単位の上限**は事前計算リスト **`cappedPositionIds: readonly PositionId[]`**（選択中チップ額を足すと `maxBetPerPosition` を超える位置）として hook が公開する。UI はこれを dim 表示に使うだけ。判定の正本はあくまで `placeChip()` 実行時の logic 検証（§5.3）

### 3.5 AnimationEvent（discriminated union — as-built §A2 の縮約形）

```ts
export type AnimationEvent =
  | { id: string; type: "NO_MORE_BETS" }                       // ベット締切の合図
  | { id: string; type: "SPIN_START" }                         // ホイール加速〜定速、ボール逆回転投入
  | { id: string; type: "BALL_LAND"; result: SpinResult }      // 減速〜着地。UIは result.number を減速ターゲットに使う
  | { id: string; type: "MARK_WINNER"; number: number }        // ドリー設置＋盤面/ホイール/racetrack ハイライト
  | { id: string; type: "COLLECT_LOSING"; betIds: readonly string[]; totalLost: number }
  | { id: string; type: "PAY_WINNING";
      payouts: ReadonlyArray<{ betId: string; amount: number }>; totalWon: number }
  | { id: string; type: "RESULT_BANNER"; result: SpinResult;
      totalBet: number; totalReturned: number; profit: number };
```

設計原則（as-built §A2.4 の継承）：
- **state は最終値、イベントは「いつ/どう見せるか」**。`spin()` は同じ setState で `settlement` を確定し、イベント列を一括で積む
- 各イベントの再生時間は**イベントに持たせず**、queue 側の `durationFor(event, reducedMotion)`（motion.ts）が決める
- 勝敗ベットが片方しかないスピンでは `COLLECT_LOSING` / `PAY_WINNING` の該当しない方は**積まない**（空配列イベントを流さない）

### 3.6 UseRouletteReturn / RouletteState / providers

```ts
export interface RouletteState {
  phase: RoulettePhase;
  bets: readonly PlacedBet[];
  stagedTotal: number;
  lastBets: readonly PlacedBet[] | null;   // 直前スピンのスナップショット（REBET 用）
  settlement: SpinSettlement | null;        // spin() で確定。UIは reveal ゲート越しにのみ描画（§6.3）
  settled: boolean;                         // economy.settle 済みフラグ（flush 用）
  history: readonly SpinResult[];           // 新しい順、最大12件
}

export interface UseRouletteReturn {
  state: RouletteState;
  config: RouletteConfig;
  availableActions: AvailableActions;
  cappedPositionIds: readonly PositionId[];
  positionTotals: Readonly<Record<PositionId, number>>; // 表示用集約（ChipStack 描画の基準）
  animationEvents: readonly AnimationEvent[];
  isAnimating: boolean;
  selectedChip: number;
  // 操作（すべて ActionResult を返す。直接ミューテーション禁止）
  selectChip(value: number): void;
  placeChip(positionId: PositionId): ActionResult;
  placeCallBet(id: CallBetId): ActionResult;
  placeNeighbors(center: number, n: number): ActionResult;
  undo(): ActionResult;
  clearBets(): ActionResult;
  spin(): ActionResult;
  rebet(): ActionResult;
  newBets(): ActionResult;
  exitTable(): ActionResult;
  onAnimationEventComplete(eventId: string): void;
  flushPendingSettlement(): void;           // 未精算ガード（§2.3）
}

export interface RouletteProviders {
  /** テスト/sandbox 用の強制出目。未指定時は Math.floor(Math.random() * 37) */
  resultProvider?: () => number;
}
```

- 乱数は**ロジック層のみ**が引く。UI演出は結果（`BALL_LAND.result`）から角度を逆算する（§6.4）。**角度から結果を読まない**

---

## §4 状態機械（`useRoulette.ts`）

### 4.1 フェーズ遷移図

```
idle ──(config確定/入場)──▶ betting ──spin()──▶ spinning ──BALL_LAND ack──▶ settling
                              ▲   ▲                                            │
                              │   └── rebet()（result から）                    │
                              └────── newBets() ◀──── result ◀──RESULT_BANNER ack
```

実装は as-built §A7 と同形：`useReducer`（`{ type: "replace"; state }` でまるごと差し替え）＋ `stateRef` 最新参照。全操作関数は `ActionResult` を返す。CPU 自動進行ループは**存在しない**（不要なので書かない）。

### 4.2 フェーズ × 操作 可否マトリクス

| 操作 | idle | betting | spinning | settling | result |
|---|---|---|---|---|---|
| `selectChip` | — | ○ | no-op | no-op | ○（次スピン用） |
| `placeChip` / `placeCallBet` / `placeNeighbors` | × | ○ | × | × | × |
| `undo` / `clearBets` | × | ○（ベット有時） | × | × | × |
| `spin` | × | ○（§4.3 条件） | × | × | × |
| `rebet` | × | ○（盤面空 & lastBets 有） | × | × | ○ |
| `newBets` | × | × | × | × | ○ |
| `exitTable` | ○ | ○（ステージング破棄・無料） | × | × | ○ |
| `onAnimationEventComplete` | — | — | ○ | ○ | — |

× は `INVALID_PHASE`（演出中なら `ANIMATING`）。betting 中の退室はステージング破棄のみで**チップを一切失わない**（§2.3 ステージング設計の帰結）。

### 4.3 `spin()` の処理順（原子性）

```
1. phase === "betting" を検証            （× → INVALID_PHASE）
2. !isAnimating を検証                   （× → ANIMATING）
3. bets.length > 0 を検証                （× → NO_BETS）
4. stagedTotal >= config.minTotalBet     （× → BELOW_MIN_TOTAL）
5. economy.placeBet(stagedTotal)         （false → ECONOMY_REJECTED。状態は一切変えない）
6. winning = providers.resultProvider?.() ?? Math.floor(Math.random() * 37)
7. settlement = resolveSpin(bets, winning)
8. 1回の setState で確定:
   - phase = "spinning" / lastBets = bets スナップショット
   - settlement 確定、settled = false
   - animationEvents = [NO_MORE_BETS, SPIN_START, BALL_LAND, MARK_WINNER,
                        (COLLECT_LOSING?), (PAY_WINNING?), RESULT_BANNER]
```

★ 5 が通った後の 6–8 は pure 計算のみで失敗しない → `placeBet` と状態確定の間に不整合が生じない。乱数を引くのは**この1箇所だけ**。

### 4.4 イベント消化とフェーズ前進（ack 駆動）

`onAnimationEventComplete(eventId)` は**キュー先頭の id と一致した場合のみ**消化（不一致・重複は無視）。消化時の副作用：

| 消化イベント | 副作用 |
|---|---|
| `NO_MORE_BETS` / `SPIN_START` | なし（次へ） |
| `BALL_LAND` | `phase = "settling"`。`history` 先頭に push（12件超は切捨て） |
| `COLLECT_LOSING` | 全敗（`PAY_WINNING` 不在）の場合は**ここで settle** |
| `PAY_WINNING` | **ここで settle**：`economy.settle(buildRouletteGameResult(settlement))`、`settled = true` |
| `RESULT_BANNER` | `phase = "result"` |

★ **settle のタイミング規則**：「精算イベント（`PAY_WINNING` があればその消化時／全敗なら `COLLECT_LOSING` の消化時）に1回」。チップ帰還演出の完了と残高反映が同期し、バナー表示時点でヘッダー残高は最終値になる。`settled` フラグで二重 settle を防止。

### 4.5 animationEnabled=false / reduced motion / 未精算ガード

- `animationEnabled = false`：`spin()` 内でイベントを積まず、betting → spinning → settling → result を即時連続遷移し settle も即時実行。**状態遷移自体は省略しない**（as-built §B2 と同じ規則）
- reduced motion（OS 設定）：`durationFor` が短縮値を返すのみ。**イベント消化は省略しない**（as-built §A2.4）
- **未精算ガード**：`settlement != null && !settled` のとき、unmount cleanup で `flushPendingSettlement()`（演出スキップで即 settle）。spinning / settling 中の `exitTable()` は `INVALID_PHASE` で拒否し、ブラウザバック等の強制離脱だけを flush で救う

### 4.6 undo / rebet / 履歴

- **undo の単位 = 直前の操作1回**。内部に `betOps: string[][]`（操作ごとの betId 配列）スタックを持つ。単発チップ → 1口除去、コールベット/ネイバー → **groupId のグループまるごと除去**
- `clearBets`：bets / betOps を空に（phase は betting のまま）
- `rebet`：`lastBets` を**新しい betId / groupId** で複製して配置。合計が利用可能額を超える場合は `INSUFFICIENT_FUNDS` で**全体拒否**（部分再現はしない）。result フェーズでの rebet は配置後 `phase = "betting"`
- `newBets`：盤面リセットして `phase = "betting"`。`lastBets` は保持（直後の rebet 可）
- `history`：新しい順・最大12件。**永続化しない**（リロードで破棄。`tableStack` と同じランタイム専用の扱い）

---

## §5 判定ロジック（`logic/`）

### 5.1 `resolveSpin`（データ駆動・特例なし）

```ts
export function resolveSpin(
  bets: readonly PlacedBet[],
  winning: number,
  positions: Readonly<Record<PositionId, BetPosition>> = POSITION_TABLE,
): SpinSettlement {
  const result = buildSpinResult(winning);
  const outcomes = bets.map((b): BetOutcome => {
    const pos = positions[b.positionId];
    const won = pos.coveredNumbers.includes(winning);
    return {
      betId: b.betId, positionId: b.positionId, amount: b.amount,
      won, returned: won ? b.amount * (pos.payout + 1) : 0,
    };
  });
  const totalBet = sumBy(outcomes, (o) => o.amount);
  const totalReturned = sumBy(outcomes, (o) => o.returned);
  return {
    result, outcomes, totalBet, totalReturned,
    profit: totalReturned - totalBet,
    winningBetIds: outcomes.filter((o) => o.won).map((o) => o.betId),
    losingBetIds: outcomes.filter((o) => !o.won).map((o) => o.betId),
  };
}
```

- 当選判定は `coveredNumbers.includes(winning)` **のみ**。ベット種別による分岐ゼロ
- 0 のアウトサイド全敗はデータの帰結（§1.6）。**`if (n === 0)` を判定に書かない**
- `amount × (payout + 1)`（元金込み戻り）の式は**この1箇所にのみ**存在する

### 5.2 `buildSpinResult`

```ts
export function buildSpinResult(n: number): SpinResult {
  if (n === 0) {
    return { number: 0, color: "green", parity: null, range: null, dozen: null, column: null };
  }
  return {
    number: n,
    color: colorOf(n),
    parity: n % 2 === 1 ? "odd" : "even",
    range: n <= 18 ? "low" : "high",
    dozen: Math.ceil(n / 12) as 1 | 2 | 3,
    column: (((n - 1) % 3) + 1) as 1 | 2 | 3,
  };
}
```

（0 の早期 return は「表示用メタの算出」であり、勝敗判定の特例ではない点に注意）

### 5.3 ベット操作 pure 部品（`bets.ts`）

**`placeChip` 検証順**（最初に引っかかった reason を返す）：

```
1. phase === "betting"                                   → INVALID_PHASE
2. !isAnimating                                          → ANIMATING
3. positionId が POSITION_TABLE に存在                    → INVALID_POSITION
4. chipValue ≤ (economy.chips − stagedTotal)             → INSUFFICIENT_FUNDS
5. positionTotal(positionId) + chipValue ≤ maxBetPerPosition → POSITION_LIMIT
6. stagedTotal + chipValue ≤ maxTotalBet                 → TABLE_LIMIT
```

**`placeCallBet` / `placeNeighbors`（グループ配置の原子性）**：
- 展開 components の**全件**について 4–6 を**事前に一括検証**し、1件でも不可なら**全体を拒否**（部分配置しない）
- コスト = `chipCount × selectedChip`（= components の `chips × selectedChip` 総和）
- 成功時は `groupId` を発行し、各 component を `PlacedBet` として一括追加。`betOps` には**1操作として** push

**`evaluateAvailableActions`**（§3.4 の算出）：
- `isAnimating` → 全キー `ANIMATING_ACTIONS` / betting・result 以外 → `DISABLED_ACTIONS`（reason: INVALID_PHASE）
- 各キーの enabled / reason / amount を上記検証の軽量版で算出
- `cappedPositionIds` = `positionTotal + selectedChip > maxBetPerPosition` のポジション一覧

### 5.4 ポジションテーブル生成と自己検証（`constants/positions.ts`）

生成規則（グリッド：行 r = 1..12、行の数字 = `[3r−2, 3r−1, 3r]`）：

| 種別 | 生成 | 件数 |
|---|---|---|
| straight | 0..36 | 37 |
| split | 行内隣接 2×12 ＋ 行間同列 3×11 ＋ ゼロ絡み（0-1 / 0-2 / 0-3） | 60 |
| street | 各行 | 12 |
| corner | 行間11 × 列間2 | 22 |
| sixLine | 隣接行ペア | 11 |
| trio / firstFour | 0-1-2, 0-2-3 / 0-1-2-3 | 2 / 1 |
| outside | even-money 6 ＋ dozen 3 ＋ column 3 | 12 |

**モジュール読み込み時の自己検証**（開発ビルドで assert。同内容を §8.2 のテストでも固定）：
- 総数 157、種別ごとの件数が上表どおり
- id 重複なし、`coveredNumbers` は昇順・0..36 範囲内・重複なし
- ★ 全件で `coveredNumbers.length × (payout + 1) === 36`

---

## §6 Animation Event Contract 再生仕様（`useRouletteAnimationQueue.ts`）

### 6.1 標準イベント列（1スピンの完全例 — テスト固定値を兼ねる）

前提：betMin=10 の卓、選択チップ 10。配置 = `straight-17` ×10、`dozen-2` ×20、Orphelins（5枚 = 50）。`stagedTotal = 80`。出目 = **17**。

精算：`straight-17` → 10×36 = 360 ／ `dozen-2`（13–24）→ 20×3 = 60 ／ Orphelins は `split-14-17` と `split-17-20` が**両方当たり** 10×18×2 = 360、`straight-1`・`split-6-9`・`split-31-34` は負け（計30）。→ `totalReturned = 780`、`profit = +700`。

```
NO_MORE_BETS
SPIN_START
BALL_LAND      { result: { number:17, color:"black", parity:"odd", range:"low", dozen:2, column:2 } }
MARK_WINNER    { number: 17 }
COLLECT_LOSING { betIds: [straight-1, split-6-9, split-31-34 の3口], totalLost: 30 }
PAY_WINNING    { payouts: [{straight-17 口:360}, {dozen-2 口:60},
                            {split-14-17 口:180}, {split-17-20 口:180}], totalWon: 780 }
RESULT_BANNER  { result, totalBet:80, totalReturned:780, profit:+700 }
```

### 6.2 liveness（as-built §A2.3 の継承 — 一言一句このまま守る）

- 完了通知（ack）を**コンポーネントの `animationend` や描画に依存させない**。`durationFor(event)` 経過後に `setTimeout` で**必ず1回** `onAnimationEventComplete(event.id)` を呼ぶ。呼ばないとスピンが**永久停止**する
- 二重発火防止：`playingRef` / `completedRef` / `timerRef` の3点ガード。`events` 配列の identity が変わっても、同じ head.id の最中はタイマーを**潰さない**（incidental re-render でも ack を失わない）
- queue liveness テスト必須（§8.2）

### 6.3 ★ 結果秘匿ゲート `resultRevealed`（Hold'em `revealedCommunity` の移植）

**罠**：`spin()` の時点で `state.settlement` に当選番号・勝敗・金額が**すべて確定済み**。UI が素朴に state を読むと、ボールが回っている間に結果が見えてしまう（Hold'em でフロップが先出しされた罠と同型）。

**対策**：queue 側が `resultRevealed: boolean`（初期 false）を持ち、**`BALL_LAND` のタイマー完了時に true** にする。UI の規則：
- `resultRevealed === false` の間、`settlement` / 当選番号 / 勝敗ハイライト / history 更新を**一切描画しない**
- 唯一の例外：`BALL_LAND` イベント payload の `result.number` を**減速ターゲットの角度計算にのみ**使う（画面に数字としては出さない）
- `MARK_WINNER` 以降のイベントと、result フェーズでの `settlement` 直読みは reveal 後なので可

アキュムレータ（`collectedBetIds` / `paidBetIds` / `dollyNumber` / `banner` / `resultRevealed`）は **`NO_MORE_BETS`（各スピン先頭）でリセット**する（as-built「POST_BLIND でリセット」と同じ位置づけ）。

### 6.4 ホイール / ボール演出の実装指針

- ポケット角：`angleOf(n) = WHEEL_ORDER.indexOf(n) × (360 / 37)`
- ホイールは時計回りに回転、**ボールは逆方向（反時計回り）**に外周を周回 → 減速 → 内側へ落下 → ポケットに着地
- `SPIN_START`：ホイール・ボールとも加速〜定速ループ（CSS keyframes。回転数・速度は CSS 変数で注入）
- `BALL_LAND`：最終静止角を結果から逆算し、減速 easing で**正確に着地**させる。`最終ボール角 = ホイール最終角 + angleOf(number)`（＋整数回転分）。微小バウンドは任意
- ★ **UI は結果から角度を導く。角度から結果を読まない**（判定の真実はロジック側のみ）
- 実装は純CSS＋Tailwind（framer-motion 不使用、ハブ規約）。ホイールは `WHEEL_ORDER` から生成した SVG（37セクタ＋数字ラベル）。rAF 併用時も終端値は CSS 変数で固定し、リフロー誤差で着地がズレないようにする
- reduced motion：数百 ms の簡略表現（または静止＋ポケットハイライト）。ただしイベント消化は通常どおり

### 6.5 チップ演出 / ドリー / バナー

- `MARK_WINNER`：盤面の当選セルにドリー（マーカー）設置。ホイールのポケットと racetrack の該当数字も同時ハイライト
- `COLLECT_LOSING`：負けポジションのチップ群をディーラー側へスライドアウト（`positionTotals` 集約で位置決め、stagger）
- `PAY_WINNING`：勝ちポジションへ配当チップが飛来 → 残高表示へ吸い込まれる。**完了 ack の時点で settle が走り、ヘッダー残高が最終値になる**（§4.4 と同期）
- `RESULT_BANNER`：番号・色・奇偶・ロー/ハイ・ダズン・カラム・収支（§7.5）。`CasinoButton` で [REBET] [NEW BETS]

### 6.6 motion トークン（`components/roulette/motion.ts`）

| イベント | normal (ms) | reduced (ms) |
|---|---|---|
| NO_MORE_BETS | 600 | 100 |
| SPIN_START | 2000 | 150 |
| BALL_LAND | 3200 | 200 |
| MARK_WINNER | 900 | 100 |
| COLLECT_LOSING | 800 | 100 |
| PAY_WINNING | 1000 | 150 |
| RESULT_BANNER | 1600 | 400 |

★調整値。1スピン合計 ≈ 10秒／reduced ≈ 1.2秒。`durationFor(event, reducedMotion)` は**この表のみ**を参照する（DURATION / EASING / STAGGER のトークン構成は Hold'em の `motion.ts` と同形式）。

---

## §7 UI 仕様

### 7.1 レイアウト

- 優先順位はハブ規約どおり **PC（1280×820）優先、390px は「大崩れしない」まで**（横スクロール無し・wrap。細部は後回し可）
- 盤面グリッドは **縦型（3列 × 12行、0 が最上段で3列ぶち抜き）を v1 標準**とする。要件の語（ストリート＝横一列、カラム＝縦列）と一致し、390px にそのまま乗る。landscape 配置は将来
- PC 構成（例）：左 = ホイール＋履歴＋結果領域 ／ 中央 = 盤面テーブル ／ 右 = racetrack＋チップセレクタ＋コントロール
- モバイル構成：上 = ホイール（縮小）＋履歴 ／ 中 = 盤面 ／ 下固定 = チップセレクタ＋コントロール。racetrack はタブ／ドロワー切替
- ヘッダー：`economy.chips` 残高、現在レート、BET 合計（`stagedTotal`）、退室

### 7.2 ベッティングテーブル（`RouletteTable.tsx` ＋ `tableLayout.ts`）

- 盤面は SVG（または CSS grid＋絶対配置レイヤ）。**ヒット領域はグリッド座標から機械的に生成**する：
  - 数字セル矩形 → `straight`
  - セル境界の帯（幅 t ≈ セル幅の 22–28%）→ `split`
  - 4セル交点の正方形（t×t）→ `corner`
  - 行の外側エッジ帯 → `street`、隣接行エッジの交点 → `sixLine`
  - 0 と 1行目の境界帯／交点 → `trio` / `firstFour`
  - 外周の専用エリア → 赤黒・奇偶・ロー/ハイ・ダズン・カラム
- `tableLayout.ts` が positionId → ヒット形状を返す。**ロジックから import しない**（要件の `position` はここに置く。§3.1 対応表）
- タップで `placeChip(positionId)`。失敗時は `ActionResult.message` をトースト／シェイクで提示（reason → 文言は付録Aの `reasonText` マップ。Hold'em と同形式）
- チップ表示：`positionTotals` を `ChipStack` で各ポジション上に集約描画（額面別の色＋合計ラベル）
- `cappedPositionIds` は dim 表示。`isAnimating` 中は盤面全体を非活性オーバーレイ
- ホバー（PC）／長押し（モバイル）プレビュー：対象 `coveredNumbers` のセルを薄くハイライト（split / corner / sixLine の境界クリックの分かりにくさ対策）

### 7.3 racetrack UI（`Racetrack.tsx`）

- 楕円トラックに `WHEEL_ORDER` 順で数字ノードを配置（SVG）。中央ゾーン分割：VOISINS DU ZÉRO ／ TIERS ／ ORPHELINS（2弧）／ JEU ZÉRO（内側）
- ゾーンタップ → `placeCallBet(id)`。**コスト常時表示必須**：「VOISINS = 9 × {選択チップ額}」のように枚数×額を見せる
- 数字ノードタップ → `placeNeighbors(center, n)`。**n セレクタ（1〜4、既定2）**をトラック脇に常設
- ホバー／長押しプレビュー：対象数字を**トラック上と盤面側の両方**でハイライト（展開先の可視化）
- 配置後のチップは**盤面側の展開先ポジションに載る**（racetrack 上には載せない。真実は盤面側、racetrack は入力デバイス）

### 7.4 チップセレクタ / コントロール（availableActions 接続）

- `ChipSelector`：`config.chipDenoms` をカジノチップ風トークンで表示、選択状態を強調。額面色はトークン定数化（例：×1=白系／×2=赤系／×5=緑系）
- コントロールバーと `availableActions` の接続（**読むだけ。再計算禁止**）：

| ボタン | キー | 備考 |
|---|---|---|
| SPIN | `spin` | 活性時はラベルに合計併記（"SPIN — 80"） |
| UNDO | `undo` | 直前操作単位（グループまるごと） |
| CLEAR | `clear` | betting 専用 |
| REBET | `rebet` | `amount`（必要額）をツールチップ表示 |
| NEW BETS | `newBets` | result 専用 |

- disabled の reason はツールチップ／トーストで提示（`reasonText`）
- ★ 視認性の落とし穴（as-built §C3 継承）：暗背景でのチップ／ボタンは縁取り＋明示装飾。ネイティブ range は使わないが同趣旨で「暗所コントラスト」を全コントロールで確認

### 7.5 結果表示・履歴

- `ResultBanner`：当選番号（ポケット色付き大表示）、color / parity / range / dozen / column のメタ行、totalBet / totalReturned / profit（正負で色分け）
- `HistoryStrip`：直近12件の `SpinResult` を新しい順に色チップ（赤/黒/緑）＋数字で表示。`BALL_LAND` 消化時に先頭へ追加（§4.4）
- 0 のときメタ行は「—」表示（parity / range / dozen / column が null）

### 7.6 共有コンポーネント / テーマ

- 流用：`CasinoButton` / `ChipStack` / `RescueModal`（`components/casino/*`）。`RoulettePage` の rate ガード・rescue 導線はハブ共通実装
- テーマはハブの世界観（ダークフェルト＋ゴールド＋ネオンアクセント）に整合。具体配色・質感は Claude Code の裁量（既存2ゲームとトーンを揃える）
- モーションは純CSS＋Tailwind、framer-motion 不使用（ハブ規約）

---

## §8 sandbox / テスト

### 8.1 `/sandbox/roulette`（`RouletteSandbox.tsx`）

- `useMockEconomy`（初期残高を任意設定可）で本番ロジックをそのまま駆動（as-built §A5.1「同一ロジックを2系統で動かす」）
- **強制出目パネル**：0〜36 の入力＋クイックボタン（`0`＝全アウトサイド負け検証 ／ `17`＝Orphelins 二重当選検証 ／ 任意の赤・黒）→ `providers.resultProvider` に注入
- **イベントログパネル**：emit された `AnimationEvent` と ack を時系列表示
- トグル類：Visual UI ／ `animationEnabled` ／ reduced motion 強制
- インスペクタ：`availableActions` / `cappedPositionIds` / `stagedTotal` / `settlement` の生値表示

### 8.2 テスト一覧（logic は pure に集約 — as-built §C1）

| 対象 | テスト内容 |
|---|---|
| `positions.ts` | 総数 157・種別件数（37/60/12/22/11/2/1/12）・id 重複なし・`coveredNumbers` 昇順／範囲内 |
| `positions.ts` ★ | **全157件で `coveredNumbers.length × (payout + 1) === 36`**（配当データの一括検証） |
| `callBets.ts` | 各コールベットの展開カバー集合 = `WHEEL_ORDER` 上の定義弧から計算した集合と一致。chipCount = 9/6/5/4 |
| `makeNeighborsBet` | wrap-around（0 中心 n=2 → {3, 26, 0, 32, 15}）、n=1..4、コスト = (2n+1) 枚 |
| `resolve.ts` | 0 → 全アウトサイド負け（red/black/odd/even/low/high/dozen×3/column×3 全敗） |
| `resolve.ts` | 17 ＋ Orphelins → `split-14-17` と `split-17-20` の両当選、returned = 2 × amount × 18 |
| `resolve.ts` | §6.1 の固定値例（totalBet 80 / totalReturned 780 / profit +700）を完全一致で検証 |
| `bets.ts` | `placeChip` 検証順（INSUFFICIENT / POSITION_LIMIT / TABLE_LIMIT の優先）、コールベット原子性（1件不可 → 全体拒否・状態不変） |
| `useRoulette`（受け入れ） | headless 1スピン完走：配置 → `spin()`（強制出目）→ イベント順序どおり ack → result。chips 差分 = profit、台帳は bet(−)/win(+) の1往復 |
| `useRoulette` | 演出中ロック：spinning 中の `placeChip` / `spin` が `ANIMATING`、`ANIMATING_ACTIONS` 全 disabled |
| `useRoulette` | `rebet`：lastBets を再現（betId / groupId は新規）、不足時 `INSUFFICIENT_FUNDS` で全体拒否 |
| `useRoulette` | `flushPendingSettlement`：settle 未了で flush → `settled = true`、二重 settle なし |
| queue | liveness：全イベントがタイマー ack される／同一 head.id 中の再レンダでタイマーが潰れない |
| queue | `resultRevealed`：`BALL_LAND` ack 前に true にならない（先バレ検出） |

---

## §9 実装手順（as-built §C1 の10ステップを具体化）＋ 分業境界

| # | ステップ | 担当 |
|---|---|---|
| 1 | `types.ts`（§3 を転記して確定） | **Codex** |
| 2 | `constants/`（wheel / positions / callBets）＋ 自己検証 | **Codex** |
| 3 | `logic/`（bets / resolve）＋ §8.2 の logic テスト | **Codex** |
| 4 | `adapter.ts` ＋ `useRoulette.ts` ＋ 受け入れテスト | **Codex** |
| 5 | `useRouletteAnimationQueue.ts`（liveness / resultRevealed）＋ `motion.ts` | **Claude Code** |
| 6 | `components/roulette/`（Table / Racetrack / Wheel / Selector / Controls / Banner / History）＋ `tableLayout.ts` | **Claude Code** |
| 7 | `/sandbox/roulette` | **Claude Code** |
| 8 | queue テスト（liveness / reveal） | **Claude Code** |
| 9 | `RoulettePage.tsx`（hidden route、rate ガード、rescue、unmount flush） | **Claude Code** |
| 10 | 検証後 `constants/games.ts` を `comingSoon → available`（1行） | 手動（最後） |

順序は **Codex 先行（1–4）→ Claude Code（5–9）**。並行する場合も `types.ts` と本仕様 §3／§6 を正とし、契約変更は**仕様書を先に更新**してから両者に反映する。

### 落とし穴チェックリスト（as-built §C3 のルーレット版）

- ☐ **liveness**：イベント再生は必ずタイマー ack（§6.2）。呼ばないと永久停止
- ☐ **resultRevealed ゲート**（§6.3）：素朴に `settlement` を読むと結果が先バレする
- ☐ 合法判定は `availableActions` のみ（UI 再計算禁止）。`cappedPositionIds` は表示専用
- ☐ 経済は **staging ＋ placeBet 1回 ＋ settle 1回**。`flushPendingSettlement` を unmount に必ず接続
- ☐ `clear` と `newBets` を混ぜない（maxRaiseTo の教訓：二重用途禁止）
- ☐ `WHEEL_ORDER` の単一ソース（ホイール描画／racetrack／ネイバー／コールベット検証の4箇所）
- ☐ `resolveSpin` に 0 の特例分岐を書かない
- ☐ reduced motion はイベント消化を省略しない
- ☐ 暗背景のコントラスト（チップ／ボタン縁取り）
- ☐ lobby 非公開のまま実装 → 公開は最後に1行

---

## §10 キックオフプロンプト

> 仕様書本体を `docs/Roulette_仕様書_v1.0.0_FINAL.md` としてリポジトリに置いた前提（配置先は実リポジトリの慣例に合わせて読み替え）。

### 10.1 Codex 用（ロジック先行：ステップ 1–4）

```
# CASINO HUB — European Roulette ロジック実装（ステップ1–4）

あなたは CASINO HUB リポジトリ内にいる。
仕様書: docs/Roulette_仕様書_v1.0.0_FINAL.md
本タスクの範囲は「ヘッドレスなロジック一式＋テスト」。UIコンポーネント・演出・ページは作らない。

## 実装対象（仕様書 §9 ステップ1–4）
1. src/games/roulette/types.ts … 仕様書 §3 の型契約を転記して確定
2. src/games/roulette/constants/ … wheel.ts / positions.ts / callBets.ts（§1）
   - positions.ts は全157件を生成し、読み込み時自己検証を入れる（§5.4）
3. src/games/roulette/logic/ … bets.ts / resolve.ts（§5）
4. src/games/roulette/adapter.ts ＋ useRoulette.ts（§2.4 / §4）

## 厳守事項
- §3 の型契約を変更しない。不都合があれば実装で迂回せず、変更提案として報告して止まる
- 共有モジュール（store / repositories / constants/rates / games/shared）は変更しない。
  必要なのは GameResultDraft に gameId:"roulette" を流すことだけ
- constants/games.ts は触らない（comingSoon のまま）。route 追加もしない（Claude Code 側）
- resolveSpin に 0 の特例分岐を書かない（§1.6 / §5.1）
- 経済はステージング方式: placeBet はスピン確定時に1回（§4.3）、settle は §4.4 の規則で1回。
  flushPendingSettlement を実装する（§2.3）
- 乱数は spin() 内の1箇所のみ。providers.resultProvider で注入可能にする
- 参考として games/texasHoldem/ の useTexasHoldem.ts / logic/betting.ts を読んでよいが、変更しない

## テスト（仕様書 §8.2 の logic / hook 分をすべて）
- positions: 件数157・種別件数・★全件 coveredNumbers.length × (payout+1) === 36
- callBets: 展開カバー集合が WHEEL_ORDER 定義弧と一致、枚数 9/6/5/4
- neighbors: wrap-around（0中心 n=2 → {3,26,0,32,15}）
- resolve: 0で全アウトサイド負け / 17+Orphelins 二重当選 / §6.1 の固定値例（80→780, +700）
- bets: 検証順・コールベット原子性
- useRoulette: headless 1スピン完走（強制出目）・演出中ロック・rebet・flushPendingSettlement

## 完了報告
- 作成/変更ファイル一覧、テスト結果、契約からの逸脱や未決事項（あれば）
```

### 10.2 Claude Code 用（UI／演出：ステップ 5–9）

```
# CASINO HUB — European Roulette UI/演出実装（ステップ5–9）

/model opusplan、plan mode、/effort high。
仕様書: docs/Roulette_仕様書_v1.0.0_FINAL.md
ロジック一式（types/constants/logic/adapter/useRoulette）は実装・テスト済みで main にある。
本タスクは UI 派生層と画面。**ロジック層のコードは変更しない（読み取りのみ）**。
契約に不足を見つけたら実装で迂回せず、報告して止まること。

## 進め方（plan mode）
1. 仕様書 §3.4–3.6 / §6 / §7 / §9 チェックリストを読む
2. Hold'em の useHoldemAnimationQueue.ts / HoldemControls.tsx を読み、流用できる形を掴む
3. 実装計画を出してから着手

## 実装対象（仕様書 §9 ステップ5–9）
5. components/roulette/useRouletteAnimationQueue.ts ＋ motion.ts
   - タイマー駆動 ack（§6.2: playingRef/completedRef/timerRef の3点ガード、必ず ack）
   - ★ resultRevealed ゲート（§6.3）: BALL_LAND ack まで settlement 由来の表示を一切出さない
   - アキュムレータは NO_MORE_BETS でリセット
6. components/roulette/ … RouletteTable / Racetrack / RouletteWheel / ChipSelector /
   RouletteControls / ResultBanner / HistoryStrip ＋ tableLayout.ts（§7）
   - 盤面は縦型 3列×12行。ヒット領域はグリッドから機械生成（§7.2）
   - racetrack はコスト常時表示＋ネイバー n セレクタ（1–4, 既定2）＋プレビュー（§7.3）
   - ホイールは WHEEL_ORDER から SVG 生成、ボール逆回転、結果から角度を逆算（§6.4）。
     角度から結果を読まない
7. /sandbox/roulette（§8.1: mock economy・強制出目・イベントログ・各トグル）
8. queue テスト（§8.2: liveness / resultRevealed）
9. pages/games/RoulettePage.tsx（hidden route、rate ガード、rescue 導線、
   unmount で flushPendingSettlement）

## 厳守事項
- 合法判定は availableActions を読むだけ（再計算禁止）。cappedPositionIds は dim 表示専用
- 純CSS+Tailwind（framer-motion 不使用）。reduced motion は時間短縮のみ、イベント消化は省略しない
- 暗背景コントラスト（チップ/ボタン縁取り）に注意
- constants/games.ts は comingSoon のまま（公開しない）
- 完了条件: 仕様書 §9 の落とし穴チェックリスト全項目

## 完了報告
- 作成/変更ファイル一覧、sandbox での確認手順（強制出目 0 / 17 の2ケース含む）、
  テスト結果、仕様との差分（あれば）
```

---

## 付録A `reasonText` 文言案（UI 表示専用マップ）

| reason | 表示文言（案） |
|---|---|
| `ANIMATING` | スピン中はベットできません |
| `INVALID_PHASE` | いまは操作できません |
| `INSUFFICIENT_FUNDS` | チップが足りません |
| `POSITION_LIMIT` | この場所のベット上限に達しています |
| `TABLE_LIMIT` | テーブルの合計上限に達しています |
| `BELOW_MIN_TOTAL` | 最低ベット額（{minTotalBet}）に達していません |
| `NO_BETS` | ベットがありません |
| `NO_LAST_BETS` | 前回のベットがありません |
| `INVALID_POSITION` / `ECONOMY_REJECTED` | エラーが発生しました（通常到達しない） |

Hold'em の `reasonText` と同じく、エラー union → 表示文言の**1対1マップ**として UI 層に置く（ロジックには置かない）。

---

*European Roulette 仕様書 v1.0.0 FINAL — 2026-06-11*
*★調整値（chipDenoms / maxTotalBet 倍率 / neighborRange / motion duration）は `adapter.ts` と `motion.ts` の2ファイルに集約。バランス調整はそこだけで完結する。*
*本書の上位互換性：契約（§3 / §6）を変更する場合は本書を v1.x として先に改訂し、Codex / Claude Code 双方へ再配布すること。*
