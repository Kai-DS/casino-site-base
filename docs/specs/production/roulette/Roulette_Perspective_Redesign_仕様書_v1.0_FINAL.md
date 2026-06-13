# CASINO HUB — Roulette Perspective Redesign 仕様書 v1.0 FINAL

> **送信先: Claude Code**（/model opusplan、plan mode、/effort high）
> 本書は単独で完結する。Codex 版リデザイン文書の**レイアウト制約（§1）はそのまま遵守**し、
> 見た目を参考画像（NetEnt 風ヨーロピアンルーレット卓）の品質に引き上げるための
> 具体仕様（トークン / ジオメトリ / SVG レシピ / 落とし穴）を全て本書で確定する。
>
> **今回は UI リデザインのみ。ロジック・契約・演出順序は一切変更しない**（§11 変更禁止リスト）。
> 機能は実装済み・テスト済み（仕様書 `Roulette_仕様書_v1.0.0_FINAL.md` 準拠）である前提。

---

## §0 進め方（plan mode）

1. **参考画像を最初に見る**：
   - `docs/reference/roulette-target.jpg` … 目標の見た目(NetEnt風)。**方向性の参照のみ**。ロゴ・文字配置・HOT/COLDパネルは再現しない（§8.2 相当の取捨は §13 に記載）
   - `docs/reference/roulette-before.png` … 現状（あれば）。「避けるもの」の基準
2. 現状の `src/components/roulette/*` と `tableLayout.ts` を読み、ヒット領域・チップ描画・キュー接続の現状構造を把握する
3. `Roulette_仕様書_v1.0.0_FINAL.md` の §3.4–3.6 / §6 を再読（**契約は不変**。本書はその上の見た目だけを差し替える）
4. 実装計画を提示してから着手。ブランチ：

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feature/roulette-perspective-redesign
```

---

## §1 ハードレイアウト制約（Codex 版を遵守 — 変更不可）

```txt
左 28〜30% = ルーレットホイール（直径 320〜360px、左カラムの主役）
右 70〜72% = 横長ベッティングテーブル
視点       = 手前から斜めに見下ろす（perspective + rotateX）
PC 1280×820 で縦横スクロールなし（header 込みで収める）
下部操作エリア = 高さ 110〜150px、画面外に出ない
盤面 max-height = 360〜430px 目安（盤面だけで縦を使い切らない）
モバイル 390px = 縦積み可・横スクロール禁止・大崩れ禁止・チップ/SPIN は操作可能
```

### 1.1 No Scroll の実装方針（Codex 版の意図を採用）

```css
.roulette-page-shell {
  height: calc(100dvh - var(--app-header-height, 72px));
  min-height: 0;
  overflow: hidden;
}
```

- AppShell のヘッダー実高を計測して `--app-header-height` を定義（固定でなければ実体に合わせる）
- 内部は flex/grid の子に **`min-h-0` / `min-w-0` を連鎖**させ、どの子も親を押し広げないようにする
- 盤面・ホイール・racetrack は **SVG（viewBox）**なのでコンテナに合わせて自動スケールする。
  「コンテナに固定高 → SVG が fit」の方向で組み、px 直書きの高さ積み上げで溢れさせない

### 1.2 ピクセル予算（1280×820、header 72px → 可用 748px）

**合計 ≤ 748px を厳守**。迷ったら盤面ゾーンを縮める（チップ操作帯を絶対に削らない）。

| 領域 | 高さ | 幅 | 備考 |
|---|---|---|---|
| 上マージン | 12 | — | |
| **卓サーフェス**（wood枠＋felt面、§3 で一括チルト） | **580** | 1232（左右 24 マージン） | 角丸・木枠込み |
| ├ 左カラム | — | **368**（=28.7%） | ホイール ⌀340 ＋ HISTORY 48 |
| ├ ギャップ | — | 20 | |
| └ 右カラム | — | **844** | 補助行 140 ＋ gap 12 ＋ 盤面ゾーン 396 |
| ギャップ | 12 | — | |
| **下部操作レール** | **132** | 1280（full-bleed） | 110–150 の範囲内 |
| 予備 | 12 | — | 安全マージン |

検算：12 + 580 + 12 + 132 + 12 = **748** ✓ ／ 左 368px は 1280 の 28.75% ✓ ／ 盤面ゾーン 396 ≤ 430 ✓

---

## §2 デザインシステム（`index.css` に追加するトークン）

### 2.1 トーン

**目標**：高級オンラインカジノ。深緑フェルト／黒革／ダークウッド／ゴールド／落ち着いた赤／白〜薄金ライン。
**避ける**：現状の赤背景全面、開発用グリッド感、単調な長方形カード、巨大すぎる盤面。

### 2.2 CSS 変数（`.roulette-theme` スコープで `index.css` に追加）

```css
.roulette-theme {
  /* felt */
  --rl-felt-1: #1E6F4C;  /* 中央・光が当たる */
  --rl-felt-2: #175A3D;
  --rl-felt-3: #0E3B2A;  /* 外周ビネット */
  /* wood / leather */
  --rl-wood-1: #52331D; --rl-wood-2: #33200F; --rl-wood-3: #1C1108;
  --rl-leather-1: #241A12; --rl-leather-2: #130D09;
  /* gold */
  --rl-gold-hi: #F6E27A; --rl-gold: #D4AF37; --rl-gold-lo: #8C6B1F;
  --rl-line: rgba(247, 238, 214, 0.85);     /* 盤面罫線（白〜薄金） */
  /* cells */
  --rl-red: #A1242E;   --rl-red-hi: #C0303C;
  --rl-black: #171A21; --rl-black-hi: #232733;
  --rl-zero: #1E7A4C;  --rl-zero-hi: #2C9B64;
  /* text */
  --rl-ink: #F4EAD2;        /* 数字・主要文字（白〜薄金） */
  --rl-ink-dim: #9D9480;    /* disabled でも読める明度を保証 */
  /* page */
  --rl-room-1: #1A120C; --rl-room-2: #0B0807;  /* 卓の外＝暗い部屋 */
  --app-header-height: 72px;
}
```

- ページ背景は**暗い部屋**（`radial-gradient(120% 100% at 50% 0%, var(--rl-room-1), var(--rl-room-2))`）。
  現状の「赤背景全面」は廃止。フェルトは**卓サーフェスの上だけ**
- 文字：UI 部品はハブ既存のフォントトークンを踏襲。盤面・ホイール内の数字は SVG `<text>` で
  serif 系（既存ハブ見出しフォント → 無ければ `Georgia, 'Times New Roman', serif`）に統一

### 2.3 質感レシピ（ラスタ画像は使わない — 付録Aに完全版）

| 質感 | 作り方（要点） |
|---|---|
| フェルト | radial-gradient（felt-1→2→3）＋ SVG `feTurbulence` の微細グレイン（opacity 0.04–0.06）を重ねる |
| ゴールド金属 | 75° linearGradient：`#FFF3B0 → #F6E27A → #D4AF37 → #9A7A2A → #F1DD8C` ＋ 細いハイライト弧 |
| ダークウッド | radial/linear の brown 系多段（wood-1〜3）＋ ごく薄い縞（repeating-linear 2–3% opacity） |
| 黒革 | leather-1→2 の縦 gradient ＋ `inset 0 1px 0 rgba(255,255,255,.04)` ＋ 上面に金の細線 |
| ガラス光沢 | 白の斜め楕円（opacity 0.05–0.08、blur）を最前面に。`pointer-events: none` |

---

## §3 構造と透視変換（★今回の技術的本丸）

### 3.1 DOM 構造（PC）

```
.roulette-page-shell（no-scroll、暗い部屋背景）
├─ .table-surface ……… 卓サーフェス（wood枠 + felt面、角丸 24px）
│    ★ ここに一括チルト: transform: perspective(1400px) rotateX(7deg) rotateZ(-0.6deg);
│      transform-origin: center bottom;
│   ├─ .wheel-column（左 368px）
│   │   ├─ .wheel-stage（映画モードのズームはこの層の transform）
│   │   │   └─ .wheel-tilt（ホイール専用の強い俯瞰: scaleY(0.84) ほか §5）
│   │   │       └─ RouletteWheel（既存の rotor / ball 構造を維持して再スキン）
│   │   └─ HistoryStrip
│   └─ .board-column（右 844px）
│       ├─ .aux-row（高さ140: Racetrack コンパクト ＋ LAST / TRENDS）
│       └─ .board-zone（高さ396）
│           └─ RouletteTable（横長 SVG。チップ/ドリー/プレビューも全て内側 §4.6）
├─ .control-rail ……… 下部操作レール（高さ132、★チルトの外）
└─ .overlay-layer …… ResultBanner / トースト / NO MORE BETS プレート（★チルトの外）
```

### 3.2 ★落とし穴（全項目必須対応）

1. **整列**：チップ・ドリー・ホバープレビュー・当選ハイライトは**必ず `.table-surface`（チルト）内・盤面と同一座標系**に置く。チルトの外に絶対配置すると確実にズレる。クリック座標はブラウザが transform を逆写像するので、**内側に置く限り何もしなくて良い**
2. **`position: fixed` 禁止（チルト内）**：transform 祖先内の fixed は壊れる。ResultBanner・トーストは `.overlay-layer`（チルト外）に置く
3. **文字ぼけ**：rotateX は 6–8° に留める。チルト層に `will-change: transform` を付け、**縮小→拡大のスケール往復をしない**。盤面 SVG はネイティブ解像度で fit させる
4. **stacking context**：transform はスタッキングコンテキストを作る。オーバーレイ類の z-index は `.overlay-layer` 側で一元管理
5. **ホイールの変換順**：`zoom（映画モード） → tilt（俯瞰squash） → rotor（回転）`の入れ子順を厳守（§5.3）。**回転・着地の角度計算には一切触れない**（squash は外側ラッパーなのでポケット整合は自動で保たれる）
6. 装飾レイヤ（光沢・グレイン・影）は全て `pointer-events: none`
7. `min-h-0` / `min-w-0` の連鎖（§1.1）。1px でも溢れたら盤面ゾーンを縮める
8. reduced motion / 演出モード（通常・映画・短縮）の既存挙動を壊さない。イベント消化は省略しない（契約どおり）

---

## §4 RouletteTable — 横長盤面（縦型 3列×12行は廃止）

### 4.1 配置（Codex 版どおり）

```txt
左端:   0（3段ぶち抜き）
右方向: 1〜36 を 3段 × 12列（下段 = 1,4,7,… / 中段 = 2,5,8,… / 上段 = 3,6,9,…）
右端:   2:1 / 2:1 / 2:1（カラムベット）
下段:   1st 12 / 2nd 12 / 3rd 12
最下段: 1-18 / EVEN / ◆(RED) / ◆(BLACK) / ODD / 19-36
```

### 4.2 推奨ジオメトリ（SVG viewBox = `0 0 940 360`）

| 要素 | 座標・サイズ（SVG単位） |
|---|---|
| 外周マージン | 左右 26、上下 20 |
| 0 セル | x=26, y=20, w=64, h=216（3段ぶち抜き。ホイール側へ窄まる台形パスにしても良い） |
| 数字セル | w=64, h=72。12列 × 3段（x=90 起点） |
| 2:1 セル | x=858, w=56, h=72 × 3 |
| ダズン行 | y=236, h=52。各セル w=256（4列ぶん） |
| イーブンマネー行 | y=288, h=52。6セル × w=128 |

- 表示は `.board-zone`（高さ396）に **width-fit** で収める（844px 幅 → 約 810×310 に縮尺）。
  盤面の印刷がフェルトより一回り小さくなり、周囲にフェルトの余白が見える＝実卓らしさが出る
- セル番号は **3段×12列の標準ルーレット配列**（既存 positionId と完全一致させる。§4.6）

### 4.3 見た目（フェルトに印刷された盤面）

- セルは**塗り潰しタイルにしない**。フェルト地の上に：
  - 罫線：`--rl-line` の 2px（SVG 単位）。外周は二重線（金 1px ＋ line 2px）
  - 赤/黒セル：セル内側に 6px インセットした**角丸矩形をやや透過で**塗る（red/black に `opacity 0.92`、上端に `rgba(255,255,255,.05)` の艶 1 本）→「ベタ塗り UI」ではなく「フェルトに刷った色」に見える
  - 0：`--rl-zero` ＋ 中央に大きめ「0」
- ★ **数字は楕円の細枠付き**（参考画像の最重要ディテール）：各数字の周りに `ellipse rx=21 ry=25`、
  `stroke: var(--rl-line) 1.5px, fill: none`。数字は `--rl-ink`、font-size 26、serif
- 2:1 / ダズン / イーブンマネーは塗りなし（罫線＋文字のみ）。文字は `--rl-ink`、イタリック serif 可
- ★ RED / BLACK は文字でなく**菱形シンボル**：`◆`（赤菱 `--rl-red-hi` / 黒菱 `--rl-black-hi`、金の細枠）。ヒット領域・positionId（`red` / `black`）は不変
- 任意（加点）：盤面左の余白に小さな金枠プレートで `MIN {betMin} / MAX {betMax}`（config から取得）

### 4.4 チップ / ドリー / プレビュー（全て盤面 SVG 内）

- チップ：`positionTotals` を各ポジションのアンカー座標に集約描画（従来どおり）。
  円＋エッジの破線リング＋中央に額面。額面色は ChipSelector と同一トークン。積層は y を 3px ずつずらして最大5枚表現＋合計ラベル
- ドリー（MARK_WINNER）：金のシリンダー（楕円2枚＋胴体グラデ）＋当選セルに金グロー
- ホバー/長押しプレビュー：対象 `coveredNumbers` セルに `--rl-gold` 8% の面＋金 1px 枠。
  split/corner/sixLine の境界ヒット帯は**不可視のまま**（hover 時だけ薄金で示す）
- `cappedPositionIds` は彩度を落として dim。`isAnimating` 中は盤面全体に 35% の暗幕＋`pointer-events:none`

### 4.5 ヒット領域（機能は現状維持）

- ヒット帯の生成規則は現行仕様（境界帯 t ≈ セル幅の 22–28%、交点 t×t）を**横長グリッドで再生成**
- ストリート＝各列の外側エッジ帯、シックスライン＝隣接列エッジの交点、トリオ/ファーストフォーは 0 と1列目の境界（横長化に伴う位置の読み替えのみ）

### 4.6 `tableLayout.ts` の扱い（変更可・ただし条件付き）

- `tableLayout.ts` は UI レイヤなので**今回変更してよい**（変更対象 §11 に追加）
- ★ 条件：**positionId の集合（全157件）と意味を 1mm も変えない**。出力するのは「同じ positionId に対する新しい座標」だけ
- 推奨：`buildTableLayout(orientation: "landscape" | "portrait")` として**転置パラメータ化**。
  PC＝landscape（本書の主役）、モバイル＝portrait（既存縦型ジオメトリを流用 §10）

---

## §5 RouletteWheel — 高級ホイール再スキン

### 5.1 配置・サイズ

- 左カラムの**主役**。`.wheel-stage` 内で中央配置、**直径 340px**（左カラムを圧迫するなら 300px まで縮小可）
- フェルト上の落ち影（ぼかし楕円）で「卓に置いてある」感を出す。盤面と同じチルト空間内なので空間の一体感は自動で出る

### 5.2 SVG レイヤ構成（下から順）

| # | レイヤ | レシピ |
|---|---|---|
| 1 | 落ち影 | 黒楕円 blur 18 / opacity 0.45、ホイール下端から下へ 14px オフセット |
| 2 | 木製ボウル外周 | wood-1→3 の radial。外径 = 直径いっぱい |
| 3 | ボウル内壁（疑似深さ） | 下方向へ 10px ずらした暗色楕円（`#120B06` 80%）。これで「皿の奥行き」が出る |
| 4 | ゴールドリム | 太いリング（幅 ≈ 直径の 7%）。§2.3 の金属 gradient ＋ 上下に細いハイライト弧 2 本 |
| 5 | **rotor（回転層・既存）** | 37 ポケット扇形（`WHEEL_ORDER` 生成・既存ロジック維持）。各ポケットに内側 1px の影線、数字は `--rl-ink` で現状より +20% 大きく |
| 6 | コーン | 中央へ向かう radial（`#241608 → #0E0903`）＋ 金の細リング 2 本 |
| 7 | ハブ／ターレット | 金の球（radial: gold-hi → gold → gold-lo）＋ 十字ハンドル（細い金バー4本）＋ 白の鏡面楕円（opacity 0.5） |
| 8 | **ball（回転層・既存）** | radial `#FFFFFF → #C9CDD6 → #6E7480` の白銀。直径 12px ＋ 小さな落ち影 |
| 9 | ガラス光沢 | 斜めの白楕円 opacity 0.06。`pointer-events:none` |

- 赤ポケットは `--rl-red`、黒は `--rl-black`、0 は `--rl-zero`（盤面と同トークンで統一感を出す）

### 5.3 ★俯瞰（2.5D）の作り方 — 変換順を厳守

```
.wheel-stage   …… 映画(FULL)モードのズーム演出（既存の transform をここへ）
  └ .wheel-tilt …… transform: scaleY(0.84);  /* 必要なら rotateX(26deg) + perspective でも可 */
      └ rotor / ball …… 既存の回転アニメ（角度計算・BALL_LAND 着地ロジックは不変更）
```

- squash（tilt）は**回転の外側**に置く。これで楕円に見えつつ、ポケットとボールの整合は数学的に自動で保たれる
- レイヤ 1–4（静止部）も同じ tilt 内に置く（皿ごと傾く）
- **既存の standard / 映画 / reduced の3演出モードを壊さない**。ズームは `.wheel-stage`、傾きは `.wheel-tilt`、回転は内側 — 役割を混ぜない

---

## §6 Racetrack — コンパクト版（右カラム上段 `.aux-row` 内）

- 表示サイズ目安：**460×136**（viewBox は別途、例 `0 0 520 154`）。盤面と SPIN を圧迫しない
- 楕円トラック＋数字ノード（`WHEEL_ORDER` 順・既存）。ノードは ⌀22 に拡大し**読みやすさ優先**。金の細枠＋ポケット色塗り＋白文字
- 中央ゾーン：VOISINS DU ZÉRO（上弧）/ TIERS（下弧）/ ORPHELINS（左右2弧）/ JEU ZÉRO（内側）。
  ラベルは小さめ大文字＋**コスト表示は必ず残す**（例 `9 × 50 = 450`。現状機能の維持）
- Neighbours セレクタ（1–4、既定2）はトラック右肩に現状どおり常設。選択状態は金枠
- ホバー/長押しプレビューの「トラック＋盤面の両方ハイライト」も現状機能を維持
- 領域が苦しい場合：コールベット4種のコスト付きボタンをトラックの下に 1 行で並べる現方式を維持してよい（ただし §1.2 の `.aux-row` 高さ 140 に収める）

---

## §7 下部操作レール（`.control-rail`、高さ132・チルトの外）

### 7.1 構成（左 → 右）

```txt
[演出モード切替（通常/映画/短縮） + BET TOTAL] │ [ChipSelector（中央・横並び）] │ [UNDO CLEAR REBET NEW BETS] [SPIN]
```

### 7.2 見た目

- レール背景＝**黒革**：`linear-gradient(180deg, var(--rl-leather-1), var(--rl-leather-2))`、
  上辺に金の細線（`rgba(212,175,55,.35)` 1px）、`box-shadow: 0 -8px 24px rgba(0,0,0,.45)`。
  「卓の手前の革張りレール」に見せる
- ChipSelector：カジノチップ風を強化 — エッジ破線リング＋二重縁＋radial の艶。額面色は現行（例 ×1=白銀 / ×2=赤 / ×5=緑）を維持。**選択中＝金リング＋わずかに浮く（translateY(-3px) + 影）**
- **SPIN は最も目立たせる**：⌀88px の円形ボタン。金属金 radial ＋ 外周 conic 風ハイライト、serif で「SPIN」。
  活性時はラベル下に小さく合計（`SPIN — 450` 相当の現行表示は維持）。hover で輝度+、押下 scale(0.97)
- UNDO / CLEAR / REBET / NEW BETS：ピル型、金の細枠（alpha .5）＋ `--rl-ink` 文字。CLEAR のみ赤系枠
- ★ **disabled の可読性**：`opacity` で潰さず、**文字 `--rl-ink-dim` / 枠 `rgba(212,175,55,.18)`** に切り替える方式にする（「暗すぎて読めない」を禁止）。reason ツールチップ/トーストは現状機能を維持
- BET TOTAL：金の数字（タブラー数字推奨）。演出モード切替は現行の2〜3値トグルをそのまま革レール上のセグメントコントロールとして再スキン

---

## §8 補助情報（HISTORY / LAST / TRENDS）

- **HistoryStrip**：ホイール下（左カラム内）。直近12件を**ポケット色のコイン**（⌀26、金細枠、白数字）で新しい順に横並び。最新の1枚だけ少し大きく＋金グロー
- **LAST RESULT プレート**：`.aux-row` 左側。最新の `SpinResult` を「番号（色コイン大）＋ RED/ODD/2nd12/COL2」のメタ行で表示。0 のときメタは「—」（現行ロジックどおり）
- **TRENDS（Hot/Cold「風」— 正直仕様）**：データ源は `state.history`（最大12件）のみ。
  - 表示1：赤/黒/緑の比率バー（LAST 12）
  - 表示2：HOT = 直近12回の頻出上位3（同数なら新しい方優先）
  - ★ **COLD は実装しない**：12 サンプルでは「出ていない番号」が25個以上あり統計として嘘になる。参考画像の HOT/COLD パネルの**見た目だけ**借り、中身は誠実に「LAST 12」と明記する
- 3 つとも `resultRevealed` ゲートの**後**にしか更新されない（現行どおり。先バレ禁止）

## §9 ResultBanner / オーバーレイ（`.overlay-layer`、チルトの外）

- ダークガラスのプレート（`rgba(10,8,6,.78)` + `backdrop-filter: blur(6px)` + 金枠 1px）を盤面中央上に重ねる
- 構成：当選番号の大コイン（ポケット色・⌀72）／メタ行（color・odd/even・low/high・dozen・column）／
  totalBet → totalReturned → **profit**（正=金、負=くすみ赤）／ [REBET] [NEW BETS]（CasinoButton 再スキン）
- NO_MORE_BETS：金文字の小プレート「NO MORE BETS」をレール上端に短くスライドイン（現行イベント時間内）
- トースト（reasonText）も `.overlay-layer`。現行文言・発火条件は不変

## §10 モバイル（390px）

- `<768px` は**縦積み**：ヘッダー → ホイール（⌀220、tilt なし or 3°）→ HISTORY → 盤面 → racetrack（ドロワー/タブ現行方式）→ 操作レール（下固定）
- 盤面は `buildTableLayout("portrait")` で**既存の縦型ジオメトリを流用**し、配色・罫線・楕円数字枠だけ新トークンに差し替える（横長盤を 390px に縮めるとヒット帯が操作不能になるため）
- ページ全体の縦スクロールは**モバイルでは許可**（PC のみ no-scroll が必須要件）。横スクロールは禁止
- チルト・グレイン等の重い装飾はモバイルで簡略化してよい（`prefers-reduced-motion` とは独立の判断で可）

---

## §11 変更対象 / 変更禁止

### 変更してよい（今回の対象）

```
src/components/roulette/RouletteGame.tsx
src/components/roulette/RouletteTable.tsx
src/components/roulette/RouletteWheel.tsx
src/components/roulette/Racetrack.tsx
src/components/roulette/ChipSelector.tsx
src/components/roulette/RouletteControls.tsx
src/components/roulette/ResultBanner.tsx
src/components/roulette/HistoryStrip.tsx
src/components/roulette/tableLayout.ts   ← 横長ジオメトリ化（positionId 集合は不変 §4.6）
src/components/roulette/motion.ts        ← 色/影トークン追加のみ可。duration は原則維持
src/index.css                            ← .roulette-theme トークン追加
（必要なら roulette 専用の layout/style helper を追加してよい）
```

### 変更禁止（1 行たりとも）

```
src/games/roulette/        … types / constants / logic / adapter / useRoulette すべて
src/constants/games.ts     … 公開状態を動かさない
src/types/game.ts
勝敗判定・配当計算・economy / settlement
AnimationEvent の種類と順序・ack 駆動・resultRevealed の先バレ防止
availableActions の解釈（UI は読むだけ。再計算禁止）
reduced motion でイベント消化を省略しない規則
```

---

## §12 テスト・実機確認

### 12.1 自動

```bash
npx tsc -b --noEmit
npm test
npm run build
```

### 12.2 実機 — PC 1280×820（必須）

- 縦横スクロールが出ない（DevTools で 1280×820 固定にして確認）
- 左 28〜30% にホイール（⌀320–360）、右 70〜72% に横長盤面
- 盤面が斜め視点に見える／文字がぼけていない
- チップ・SPIN・全ボタンが画面内。SPIN が最も目立ち、押しやすい
- disabled ボタンの文字が読める

### 12.3 実機 — クリックマッピング行列（★リデザインの肝。sandbox `/sandbox/roulette` で）

チルト適用状態で、以下を**各1回ずつ**置き、置いたチップが正しい位置に表示され `BET TOTAL` が正しく増えること：

```
straight-17 / split-17-20（縦境界） / split-16-17（横境界） / corner-16-17-19-20 /
street-16-17-18 / six-13-…-18 / trio-0-2-3 / first4-0-1-2-3 /
red / odd / low / dozen-2 / column-3 / コールベット voisins / ネイバー 0±2
```

加えて：UNDO がグループまるごと戻る／ホバープレビューが境界帯で正しく出る／`cappedPositionIds` の dim 表示。

### 12.4 実機 — Gameplay 回帰

- lobby → rate select → RoulettePage 表示（公開状態は変更しないこと）
- チップ配置 → SPIN → 着地 → 回収/支払い → バナー → REBET / NEW BETS が一巡する
- 演出モード（通常/映画/短縮）3 種とも完走。映画モードのズームとチルトが干渉しない
- 強制出目 `0`（全アウトサイド負け表示）と `17`（Orphelins 二重当選）で精算表示が正しい
- `resultRevealed` の先バレなし：着地前に番号・勝敗・HISTORY・TRENDS が一切出ない

### 12.5 実機 — Mobile 390px

- 横スクロールなし／大崩れなし／チップと SPIN が操作できる／盤面（縦型）でベットできる

---

## §13 参考画像の取捨（Codex 版 §8.2 を踏襲）

**取り入れる**：横長テーブル（0＋3段×12列＋2:1）／下部チップ列／高級カジノ卓のトーン／ホイールと盤面の一体感／数字の楕円枠・菱形 RED/BLACK のフェルト印刷感
**変える**：ホイール位置は**画面左**（参考画像の上中央ではない）／背景・装飾・ボタン・チップは CASINO HUB 独自／HOT/COLD パネルは再現しない（§8 の TRENDS 正直仕様）／ロゴ・文字配置は使わない

---

## §14 完了報告（この順で）

1. 作成したブランチ名
2. 変更したファイル一覧
3. レイアウトをどう変えたか（before → after を一言で）
4. 左 28〜30% ホイール / 右 70〜72% テーブルになっているか（実測 px）
5. PC 1280×820 でスクロールなしになっているか
6. 斜め視点をどう表現したか（transform 値と構造）
7. ロジックを変更していないこと（`git diff --stat src/games/roulette/` が空であること）
8. `src/constants/games.ts` を変更していないこと
9. 実行したテストコマンドと結果
10. §12.3 クリックマッピング行列の結果
11. §12.4 / §12.5 の実機確認結果
12. 未実装・妥協点
13. スクリーンショット保存先（PC 通常時 / スピン中 / 結果バナー / モバイルの4枚以上）

---

## 付録A SVG / CSS レシピ集（コピペ可・ラスタ画像不使用）

> 方針：**画像アセットは作らない**。金属・木・フェルトは全てグラデーションと SVG フィルタで再現する。
> 解像度非依存・テーマ変数で一括調整可能・ハブの純CSS+Tailwind 規約に適合するため。

### A.1 フェルトグレイン（盤面・卓サーフェスの最前面に薄く重ねる）

```svg
<filter id="rl-felt-grain" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
  <feColorMatrix type="matrix"
    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0"/>
</filter>
<!-- 使い方: <rect width="100%" height="100%" filter="url(#rl-felt-grain)" pointer-events="none"/> -->
```

### A.2 ゴールド金属（リム・枠・SPIN ボタン共通）

```svg
<linearGradient id="rl-gold-metal" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0"    stop-color="#FFF3B0"/>
  <stop offset="0.25" stop-color="#F6E27A"/>
  <stop offset="0.5"  stop-color="#D4AF37"/>
  <stop offset="0.75" stop-color="#9A7A2A"/>
  <stop offset="1"    stop-color="#F1DD8C"/>
</linearGradient>
```

### A.3 木製ボウル / ハブ球 / ボール

```svg
<radialGradient id="rl-wood-bowl" cx="0.5" cy="0.42" r="0.65">
  <stop offset="0" stop-color="#52331D"/><stop offset="0.7" stop-color="#33200F"/>
  <stop offset="1" stop-color="#1C1108"/>
</radialGradient>
<radialGradient id="rl-hub-gold" cx="0.38" cy="0.32" r="0.75">
  <stop offset="0" stop-color="#FFF3B0"/><stop offset="0.45" stop-color="#D4AF37"/>
  <stop offset="1" stop-color="#8C6B1F"/>
</radialGradient>
<radialGradient id="rl-ball" cx="0.35" cy="0.3" r="0.8">
  <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#C9CDD6"/>
  <stop offset="1" stop-color="#6E7480"/>
</radialGradient>
```

### A.4 卓サーフェス（CSS）

```css
.table-surface {
  border-radius: 24px;
  padding: 20px;
  background:
    radial-gradient(120% 90% at 50% 28%, var(--rl-felt-1), var(--rl-felt-2) 55%, var(--rl-felt-3) 100%);
  box-shadow:
    inset 0 0 0 2px rgba(212, 175, 55, .28),          /* 内側の金縁 */
    inset 0 0 60px rgba(0, 0, 0, .35),                 /* フェルトのビネット */
    0 18px 48px rgba(0, 0, 0, .55);                    /* 卓の落ち影 */
  border: 10px solid transparent;
  background-clip: padding-box;
  position: relative;
}
.table-surface::before {                               /* 木枠 */
  content: ""; position: absolute; inset: -10px; z-index: -1; border-radius: 30px;
  background: linear-gradient(160deg, var(--rl-wood-1), var(--rl-wood-2) 55%, var(--rl-wood-3));
}
```

### A.5 革レール（CSS）

```css
.control-rail {
  background: linear-gradient(180deg, var(--rl-leather-1), var(--rl-leather-2));
  border-top: 1px solid rgba(212, 175, 55, .35);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, .45), inset 0 1px 0 rgba(255, 255, 255, .04);
}
```

### A.6 チルト（CSS — §3 の構造で適用）

```css
.table-surface { transform: perspective(1400px) rotateX(7deg) rotateZ(-0.6deg);
                 transform-origin: center bottom; will-change: transform; }
.wheel-tilt    { transform: scaleY(0.84); transform-origin: center; }
@media (max-width: 767px) {
  .table-surface { transform: none; }                  /* モバイルは平面（§10） */
  .wheel-tilt    { transform: scaleY(0.92); }
}
```

---

*Roulette Perspective Redesign 仕様書 v1.0 FINAL — 2026-06-12*
*レイアウト制約（§1）は Codex 共同設計版を遵守。見た目の正は本書 §2〜§9 と参考画像 `docs/reference/roulette-target.jpg`。*
*ロジック・契約（`Roulette_仕様書_v1.0.0_FINAL.md` §3/§6）は本書では一切変更しない。*
