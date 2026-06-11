# CASINO HUB — European Roulette 追加UI演出仕様
## Roulette Cinematic Spin / Animation Mode 追加仕様 v1.0

**送信先: Claude Code**

> 本書は `Roulette_仕様書_v1.0.0_FINAL.md` に対する **Claude Code 用の追加仕様**。
> 目的は、ルーレットのスピン演出を「テンポ重視の簡易演出」と「緊張感重視のシネマティック演出」で切り替え可能にすること。
>
> ロジック、当選判定、配当計算、経済処理は変更しない。
> 変更対象は UI / animation queue / motion token / roulette components / sandbox のみ。

---

## 0. このタスクの担当範囲

### 担当: Claude Code

実装対象は以下。

```txt
src/components/roulette/
  RouletteGame.tsx
  RouletteWheel.tsx
  RouletteTable.tsx
  Racetrack.tsx
  RouletteControls.tsx
  ResultBanner.tsx
  HistoryStrip.tsx
  useRouletteAnimationQueue.ts
  motion.ts
  tableLayout.ts
src/pages/sandbox/RouletteSandbox.tsx
src/pages/games/RoulettePage.tsx
```

必要なら UI 専用の補助ファイルを追加してよい。

例:

```txt
src/components/roulette/animationMode.ts
src/components/roulette/wheelGeometry.ts
src/components/roulette/rouletteSound.ts
src/components/roulette/useRouletteAnimationMode.ts
```

---

## 1. 絶対に変更しないもの

以下は原則変更禁止。

```txt
src/games/roulette/useRoulette.ts
src/games/roulette/logic/resolve.ts
src/games/roulette/logic/bets.ts
src/games/roulette/constants/positions.ts
src/games/roulette/constants/callBets.ts
src/games/roulette/adapter.ts
src/games/roulette/types.ts
store/
repositories/
```

ただし、既存の型契約と明確に矛盾するコンパイルエラーがあり、UI側だけでは解消できない場合は、勝手に変更せず報告する。

---

## 2. 目的

ルーレットは、結果が出るまでの緊張感が一番重要なゲームである。

そのため、スピン演出を以下の2系統に分ける。

```txt
STANDARD:
  テンポ重視。
  元々の簡易演出。
  盤面から大きく離れず、ホイールとボールの回転、着地、当選ハイライトを短時間で見せる。

FULL:
  雰囲気重視。
  シネマティック演出。
  盤面を暗転させ、ホイールへズームインし、ボールの減速、ラトル、落下、当選ポケット強調までしっかり見せる。
```

さらに OS の reduced motion やユーザーの負荷軽減向けに `REDUCED` を用意する。

---

## 3. 追加する演出モード

### 3.1 型

UI 層に以下を追加する。

```ts
export type RouletteAnimationMode = "standard" | "full" | "reduced";
```

### 3.2 デフォルト

```txt
デフォルト: standard
```

理由:
- 毎回 12〜14秒の FULL 演出は、人によってはテンポが悪い。
- 初期状態はサクサク遊べる方が安全。
- 演出を楽しみたい人だけ FULL を選ぶ形にする。

### 3.3 localStorage 永続化

演出モードは localStorage に保存する。

```ts
const ROULETTE_ANIMATION_MODE_STORAGE_KEY = "casino-hub:roulette:animation-mode";
```

保存値が不正な場合は `"standard"` に戻す。

OS の `prefers-reduced-motion` が有効な場合は、UIの選択値が `"full"` や `"standard"` でも、実再生は reduced 相当に短縮する。

---

## 4. モードごとの仕様

### 4.1 STANDARD

テンポ重視の簡易演出。

```txt
- 盤面から大きくカメラ移動しない
- ホイールを軽く強調する程度
- 背景暗転は弱め
- ボールは短く回転して、短く減速して着地
- ポケットをかすめる演出は無し、またはかなり控えめ
- 当選番号アップは短め
- 1スピン目安: 6〜8秒
```

### 4.2 FULL

緊張感重視のシネマティック演出。

```txt
- SPIN後、盤面が暗く奥へ引く
- ホイールが画面中央へズームイン
- ホイールは斜め上から見た2.5D表現
- ホイールは時計回り、ボールは反時計回り
- ボールは外周を高速周回
- 徐々に減速
- 最後に外周から内側へ入り、複数ポケットをかすめる
- 仕切りに当たるような小さいバウンドを入れる
- 最終的に result.number のポケットへ正確に着地
- 着地後、当選ポケットを約1秒アップで見せる
- その後、盤面へ戻ってチップ回収/支払い演出へ進む
- 1スピン目安: 12〜14秒
```

### 4.3 REDUCED

負荷軽減・アクセシビリティ用。

```txt
- ズームなし、または最小限
- 長い回転なし
- 短いハイライト中心
- 1スピン目安: 1〜2秒
```

---

## 5. 追加する UI 派生状態

ロジックの `phase` とは別に、UI専用の視覚状態を追加する。

```ts
export type RouletteVisualFocus =
  | "table"
  | "closingBets"
  | "wheelZoomIn"
  | "highSpeedSpin"
  | "suspenseSpin"
  | "rattleDrop"
  | "winnerReveal"
  | "tableReturn";
```

### 5.1 各状態の意味

| visualFocus | 意味 |
|---|---|
| `table` | 通常のベット画面 |
| `closingBets` | NO MORE BETS 表示、盤面ロック |
| `wheelZoomIn` | ホイールへカメラズーム |
| `highSpeedSpin` | ホイールとボールの高速回転 |
| `suspenseSpin` | ボールが減速し、落下直前の緊張感を作る |
| `rattleDrop` | ボールがポケットをかすめながら落ちる |
| `winnerReveal` | 当選ポケットをアップで見せる |
| `tableReturn` | 盤面へ戻る |

### 5.2 モード別の使い方

#### STANDARD

STANDARD では visualFocus を最小限に使う。

```txt
table
↓
closingBets
↓
highSpeedSpin
↓
winnerReveal
↓
tableReturn
↓
table
```

#### FULL

FULL では細かく使う。

```txt
table
↓
closingBets
↓
wheelZoomIn
↓
highSpeedSpin
↓
suspenseSpin
↓
rattleDrop
↓
winnerReveal
↓
tableReturn
↓
table
```

#### REDUCED

REDUCED ではほぼ table 固定でもよい。

```txt
table
↓
closingBets
↓
winnerReveal
↓
table
```

---

## 6. AnimationEvent との対応

既存の AnimationEvent の順序は変更しない。

```ts
NO_MORE_BETS
SPIN_START
BALL_LAND
MARK_WINNER
COLLECT_LOSING?
PAY_WINNING?
RESULT_BANNER
```

UI側で visualFocus を重ねる。

### 6.1 NO_MORE_BETS

```txt
visualFocus = closingBets

表示:
- 盤面操作をロック
- "NO MORE BETS" を一瞬表示
- 盤面を少し暗くする
- 置いたチップは消さない
```

### 6.2 SPIN_START

#### STANDARD

```txt
visualFocus = highSpeedSpin

表示:
- ホイールを少し強調
- ホイール時計回り
- ボール反時計回り
- 軽い暗転
```

#### FULL

```txt
visualFocus = wheelZoomIn
↓
visualFocus = highSpeedSpin

表示:
- 盤面、racetrack、controls を暗く奥へ引く
- ホイールを画面中央へ拡大
- ホイールを斜め上から見た2.5Dにする
- ホイール時計回り
- ボール反時計回り
- ボールに短い光の軌跡を付ける
- 外周リングに金属感とゴールドの光を付ける
```

### 6.3 BALL_LAND

#### STANDARD

```txt
visualFocus = winnerReveal に近い短い着地演出

表示:
- ボールを短く減速させる
- result.number のポケットへ着地させる
- 着地後に当選ポケットを軽く光らせる
```

#### FULL

```txt
visualFocus = suspenseSpin
↓
visualFocus = rattleDrop

表示:
- ボール速度を徐々に落とす
- カメラをさらに少し寄せる
- 背景の明るさを少し絞る
- ボールが外周から内側へ落ちる
- 2〜4個のポケットをかすめる
- 仕切りに当たったように小さく跳ねる
- 最後は必ず result.number のポケットへ着地
- 着地時に小さい光を出す
```

重要:
- `BALL_LAND` 完了前に当選番号をテキスト表示しない。
- `BALL_LAND` 完了前に履歴、盤面ハイライト、勝敗ハイライト、ResultBannerを出さない。
- `BALL_LAND.result.number` は、ボールの最終着地角度の計算にのみ使う。

### 6.4 MARK_WINNER

```txt
visualFocus = winnerReveal
↓
visualFocus = tableReturn

表示:
- 当選ポケットを約0.8〜1.3秒アップで見せる
- ポケットを金色に光らせる
- ドリー/マーカーを置く
- その後、ホイールを元の位置へ戻す
- 盤面を明るく戻す
- 盤面の当選セルをハイライト
- racetrack の該当数字もハイライト
- 勝ちベットがある場合は勝ちチップを軽く光らせる
```

### 6.5 COLLECT_LOSING

```txt
visualFocus = table

表示:
- 盤面側で負けチップをディーラー側へスライドアウト
- positionTotals を使って位置決め
- stagger を入れて少し順番に回収
```

### 6.6 PAY_WINNING

```txt
visualFocus = table

表示:
- 勝ち位置へ配当チップが飛来
- 勝ちチップの上で軽く弾む
- 最後に残高表示へ吸い込まれる
```

### 6.7 RESULT_BANNER

```txt
visualFocus = table

表示:
- 当選番号
- 色
- 奇偶
- LOW/HIGH
- ダズン
- カラム
- BET
- RETURNED
- PROFIT
- REBET / NEW BETS
```

---

## 7. durationFor の変更

既存の `durationFor(event, reducedMotion)` を、モード対応に拡張する。

```ts
export function durationFor(
  event: AnimationEvent,
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
): number {
  if (reducedMotion || mode === "reduced") {
    return REDUCED_DURATIONS[event.type];
  }

  if (mode === "full") {
    return FULL_DRAMA_DURATIONS[event.type];
  }

  return STANDARD_DURATIONS[event.type];
}
```

### 7.1 STANDARD_DURATIONS

```ts
export const STANDARD_DURATIONS = {
  NO_MORE_BETS: 500,
  SPIN_START: 1600,
  BALL_LAND: 2200,
  MARK_WINNER: 700,
  COLLECT_LOSING: 700,
  PAY_WINNING: 800,
  RESULT_BANNER: 1200,
} as const;
```

合計目安: 約6〜8秒。

### 7.2 FULL_DRAMA_DURATIONS

```ts
export const FULL_DRAMA_DURATIONS = {
  NO_MORE_BETS: 700,
  SPIN_START: 3000,
  BALL_LAND: 5000,
  MARK_WINNER: 1300,
  COLLECT_LOSING: 900,
  PAY_WINNING: 1100,
  RESULT_BANNER: 1600,
} as const;
```

合計目安: 約12〜14秒。

### 7.3 REDUCED_DURATIONS

```ts
export const REDUCED_DURATIONS = {
  NO_MORE_BETS: 100,
  SPIN_START: 150,
  BALL_LAND: 200,
  MARK_WINNER: 100,
  COLLECT_LOSING: 100,
  PAY_WINNING: 150,
  RESULT_BANNER: 400,
} as const;
```

合計目安: 約1〜2秒。

### 7.4 注意

- イベントオブジェクト自体に duration を持たせない。
- queue 側のタイマー ack 駆動を維持する。
- `animationend` に依存しない。
- event head が同じ間は incidental re-render でタイマーを潰さない。

---

## 8. 先バレ防止

最重要。

`spin()` 実行時点でロジック上は `settlement` が確定している。
しかし UI は `BALL_LAND` 完了まで結果を見せてはいけない。

### 8.1 BALL_LAND 完了前に禁止

```txt
- 当選番号のテキスト表示
- HistoryStrip の更新表示
- 盤面の当選セルハイライト
- racetrack の当選数字ハイライト
- 勝敗チップの表示
- ResultBanner
- totalReturned / profit の表示
```

### 8.2 BALL_LAND 完了前に許可

```txt
- BALL_LAND event payload の result.number を、ボールの最終着地角度の計算にのみ使う
```

### 8.3 実装方針

`useRouletteAnimationQueue.ts` は `resultRevealed` を持つ。

```ts
resultRevealed = false;
```

`BALL_LAND` の timer ack が完了したタイミングでのみ true にする。

```ts
if (event.type === "BALL_LAND") {
  setResultRevealed(true);
}
```

`NO_MORE_BETS` で毎回 false に戻す。

---

## 9. ホイールの2.5D表現

### 9.1 採用する表現

```txt
- SVGで37ポケットを描画
- WHEEL_ORDER を使う
- 赤/黒/緑のポケット
- 外周は金属リング
- 中央はゴールドのハブ
- 数字は白または薄金
- ボールは白銀
- ボールにハイライト
- ボールの影をポケット上に落とす
- ホイール全体に楕円影
- 当選ポケットは金色グロー
```

### 9.2 使ってよいCSS表現

```txt
- perspective
- transform
- translate
- scale
- rotateX
- rotateZ
- filter: drop-shadow
- radial-gradient
- conic-gradient
- box-shadow
- CSS variables
```

### 9.3 使用禁止

```txt
- Three.js
- WebGL
- 3Dモデル読み込み
- 物理シミュレーション
- framer-motion
```

理由:
- 現在のハブ規約は純CSS + Tailwind 方針。
- WebGLは実装負荷、バグ、パフォーマンスリスクが大きい。
- まずはCSS/SVGの2.5Dで本格感を出す。

---

## 10. カメラ・ズーム設定

### 10.1 PC

```txt
通常時ホイールサイズ: 260〜320px
FULLズーム時ホイールサイズ: 560〜660px
FULL scale: 1.9〜2.3
FULL rotateX: 58deg〜64deg
背景 blur: 2〜4px
背景 brightness: 45〜60%
```

### 10.2 モバイル

```txt
通常時ホイールサイズ: 180〜220px
FULLズーム時ホイールサイズ: 320〜380px
FULL scale: 1.45〜1.75
FULL rotateX: 55deg前後
```

モバイルのスピン中は、盤面が一部隠れてもよい。
スピン中はホイール主役でよい。

---

## 11. ボール軌道

### 11.1 基本ルール

- ホイールは時計回り。
- ボールは反時計回り。
- 最終着地点は `BALL_LAND.result.number` から算出する。
- 角度から結果を読まない。
- 結果をUI側で再計算しない。

### 11.2 angleOf

```ts
function angleOf(n: number): number {
  return WHEEL_ORDER.indexOf(n) * (360 / 37);
}
```

### 11.3 FULL のラトル表現

FULLでは、最終着地前に「かすめる」演出を入れる。

```txt
- 最終角度の手前/奥に数ポケット分のオフセットを加える
- 2〜4個のポケットをかすめるような keyframe を作る
- 最後に result.number の角度へ収束させる
- ボール半径を外周から内側へ縮める
- 着地時だけ小さい bounce を入れる
```

注意:
- かすめる演出中に別の番号をテキスト表示しない。
- 当選番号を誤認させる強いハイライトはしない。
- 最後は必ず result.number に落とす。

---

## 12. UI操作部

### 12.1 演出モード切り替え

`RouletteControls` または `ChipSelector` 付近に演出モード切り替えを追加する。

PC:

```txt
演出モード
[STANDARD] [FULL]
```

モバイル:

```txt
演出: 通常 / 映画
```

内部値:

```txt
通常 → standard
映画 → full
```

`reduced` は基本的に OS の reduced motion または開発/sandbox用。
通常UIで常時見せる必要はないが、sandbox では選べるようにする。

### 12.2 表示文言案

```txt
STANDARD: 通常
FULL: 映画
```

ツールチップ:

```txt
通常: テンポ重視の短いスピン演出
映画: ホイールへズームして落下まで見せる演出
```

---

## 13. sandbox 追加

`/sandbox/roulette` に以下を追加する。

```txt
- animationMode 切り替え
  - standard
  - full
  - reduced
- prefers-reduced-motion 強制トグル
- visualFocus 表示
- resultRevealed 表示
- 現在再生中の AnimationEvent 表示
- durationFor の戻り値表示
```

強制出目で以下を確認できるようにする。

```txt
0:
  アウトサイド全敗、緑ポケット着地、0のハイライト

17:
  Orphelins 二重当選、17ポケット着地、勝ちチップ複数支払い
```

---

## 14. サウンド用フック

v1で実際の音源を入れなくてもよい。
ただし、後から音を足しやすくするため、空のサウンドフックだけ用意してよい。

```ts
export function playRouletteSound(
  eventType: AnimationEvent["type"],
  mode: RouletteAnimationMode,
): void {
  // v1では no-op でよい
}
```

将来入れる音の例:

```txt
NO_MORE_BETS: 低いベル
SPIN_START: ホイール回転音
BALL_LAND前半: ボールが転がる音
BALL_LAND後半: カチカチとポケットに当たる音
MARK_WINNER: 小さいヒット音
PAY_WINNING: チップ音
```

---

## 15. テスト・確認項目

### 15.1 必須

```txt
- STANDARD と FULL を切り替えられる
- localStorage に保存される
- リロード後も同じモードになる
- OS reduced motion 時は短縮演出になる
- AnimationEvent の順序が変わらない
- timer ack が必ず走る
- animationend 依存になっていない
- BALL_LAND ack 前に resultRevealed が true にならない
- BALL_LAND ack 前に履歴/結果/勝敗が表示されない
- FULL でホイールへズームする
- FULL でボールがラトル/ドロップする
- STANDARD でテンポよく進む
- COLLECT_LOSING / PAY_WINNING で盤面側に戻っている
```

### 15.2 見た目確認

```txt
PC 1280x820:
- ホイールがFULL時に主役になる
- 盤面、racetrack、controlsが暗く奥に引く
- チップと数字が暗背景に埋もれない
- 当選ポケットが見やすい

Mobile 390px:
- 横スクロールしない
- FULL時にホイールが中央で見える
- スピン終了後に盤面へ戻る
- controls が破綻しない
```

---

## 16. 実装時の禁止事項

```txt
- ロジック層で勝敗判定を変更しない
- UI側で配当計算をしない
- UI側で当選結果を再計算しない
- angle から結果番号を決めない
- resultRevealed を無視しない
- animationend に ack を依存させない
- Three.js / WebGL / framer-motion を導入しない
- 既存の AnimationEvent union を勝手に変更しない
- `clear` と `newBets` の意味を混ぜない
```

---

## 17. 完了報告に含める内容

完了時は以下を報告する。

```txt
1. 作成/変更ファイル一覧
2. STANDARD / FULL / REDUCED の実装内容
3. localStorage キー
4. sandbox での確認手順
5. 強制出目 0 / 17 の確認結果
6. resultRevealed 先バレ防止の確認結果
7. reduced motion の確認結果
8. テスト結果
9. 仕様との差分があれば明記
```

---

## 18. Claude Code 実行プロンプト

以下をそのままClaude Codeに渡す。

```txt
# CASINO HUB — Roulette Cinematic Spin / Animation Mode 実装

あなたは CASINO HUB リポジトリ内にいる。
既存仕様書: docs/Roulette_仕様書_v1.0.0_FINAL.md
追加仕様書: docs/Roulette_Cinematic_Spin_追加仕様_v1.0.md

本タスクは Claude Code 担当範囲のみ。
ロジック層は変更せず、ルーレットのUI演出を拡張してください。

## 目的

ルーレットのスピン演出に animationMode を追加する。

- STANDARD: 元々の簡易演出。テンポ重視。
- FULL: シネマティック演出。ホイールへズームし、ボールの減速・ラトル・落下までしっかり見せる。
- REDUCED: reduced motion 向けの短縮演出。

デフォルトは STANDARD。
FULL はユーザーが選べるようにする。
選択値は localStorage に保存する。

## 重要

- ロジック層は変更しない
- AnimationEvent の順序は変更しない
- 勝敗判定や配当計算をUI側で再計算しない
- resultRevealed による先バレ防止は全モードで守る
- BALL_LAND 完了前に結果番号、履歴、勝敗、ResultBannerを表示しない
- BALL_LAND.result.number はボール着地角度の計算にのみ使う
- ack/liveness を壊さない
- animationend 依存にしない
- durationFor のタイマー駆動を維持する
- WHEEL_ORDER を使ってホイールを描画する
- Three.js / WebGL / framer-motion は使わない

## 実装対象

主に以下を変更する。

- src/components/roulette/useRouletteAnimationQueue.ts
- src/components/roulette/motion.ts
- src/components/roulette/RouletteGame.tsx
- src/components/roulette/RouletteWheel.tsx
- src/components/roulette/RouletteControls.tsx
- src/pages/sandbox/RouletteSandbox.tsx

必要なら UI 専用の補助ファイルを追加してよい。

## 追加する型

```ts
export type RouletteAnimationMode = "standard" | "full" | "reduced";

export type RouletteVisualFocus =
  | "table"
  | "closingBets"
  | "wheelZoomIn"
  | "highSpeedSpin"
  | "suspenseSpin"
  | "rattleDrop"
  | "winnerReveal"
  | "tableReturn";
```

## duration

durationFor を以下の形に拡張する。

```ts
export function durationFor(
  event: AnimationEvent,
  mode: RouletteAnimationMode,
  reducedMotion: boolean,
): number
```

STANDARD は 6〜8秒程度。
FULL は 12〜14秒程度。
REDUCED は 1〜2秒程度。

## FULL 演出

SPIN後、盤面が暗く奥へ引き、ホイールが中央へズームインする。
ホイールは時計回り、ボールは反時計回り。
BALL_LAND ではボールが外周から内側へ入り、2〜4個のポケットをかすめるように減速し、最後は必ず result.number のポケットに着地する。
着地後は当選ポケットを約1秒アップで見せ、盤面へ戻ってからチップ回収/支払い演出へ進む。

## STANDARD 演出

盤面から大きくズームせず、ホイールとボールの回転、短い減速、当選ハイライトをテンポよく見せる。

## UI

RouletteControls または ChipSelector 付近に演出モード切り替えを追加する。

表示:
- 通常 = standard
- 映画 = full

sandbox では standard / full / reduced をすべて選べるようにする。

## 完了報告

作成/変更ファイル一覧、確認手順、強制出目 0 / 17 の確認結果、resultRevealed の確認結果、reduced motion の確認結果、テスト結果、仕様との差分を報告してください。
```
