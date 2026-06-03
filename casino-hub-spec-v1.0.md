# 総合カジノゲームアプリ 仕様書 v1.0 — **CASINO HUB**

> 元仕様（総合カジノゲームアプリ 仕様書）を全面レビューし、矛盾・技術的問題を解消した「完成版」。
> ロビーのポーカーテーブル世界観（緑テーブル＋トランプカード型ゲーム選択）は意図的に**維持**している。
> それ以外は技術的妥当性を優先して整理・変更した。変更の根拠は本文中および **付録A** を参照。

---

## 0. 変更サマリ（元仕様からの主な差分）

| # | 元仕様 | 完成版での判断 | 理由 |
|---|--------|----------------|------|
| 1 | Next.js App Router | **Vite + React + React Router** | NEON JACKが既にVite製。Next.jsだと統合が「移動」でなく「ビルドツールごと書き換え」になる。全クライアント＋localStorageでSSR/RSCの恩恵がほぼ無い |
| 2 | Zustand と repository の両方が永続化を持つ（矛盾） | **永続化はrepositoryに一本化**。storeはrepository経由 | 「将来repositoryだけ差し替え」を成立させるため |
| 3 | 汎用スロットのBET/MAXBET＋レート | NEON JACKは**コイン単価（チップ⇔メダル換算）**で橋渡し | NEON JACKはJuggler系パチスロ＝BET固定3枚・払い出しメダル。実機モデルを壊さない |
| 4 | レートの「必要チップ」が多義（Rate型に`minBet`+`entryCost`） | `minBalance`（入場ゲート）＋`betUnit`（賭けスケール）に整理 | 意味を一本化し、ゲーム別アダプタで解釈 |
| 5 | 破産時の救済なし | **bailout（救済チップ）**を追加 | Low(100)すら無い＋デイリー受領済みで詰むのを防ぐ |
| 6 | `ChipTransaction` と `GameResult` の役割重複 | 台帳と「1プレイ記録」の関係を定義、更新経路を`applyGameResult`に一本化 | 二重管理と残高ドリフトを防ぐ |
| 7 | localStorageスキーマの変更耐性なし | `schemaVersion` ＋ migrate を追加 | 仕様改訂で旧保存データが壊れないように |
| 8 | テスト方針なし | **Vitest**で純ロジックを単体テスト | UI/ロジック分離の利点を実利化。ポートフォリオ価値も上がる |
| — | ロビーの緑テーブル＋トランプカード | **そのまま維持** | コンセプトの核なので変更しない |

---

## 1. アプリ概要

複数のカジノ風ゲームを1つのロビーから遊べるブラウザ向け総合ゲームアプリ。

- 最初の実装では既存スロット **NEON JACK** をメインゲームとして統合する。
- 将来的に Video Poker → Texas Hold'em → Omaha Poker を追加できる構成にする。
- **現金・換金要素は一切なし。アプリ内の無料チップのみを使うシミュレーションゲーム**として運用する。

---

## 2. コンセプト / 世界観

### 基本コンセプト（**維持**）
ポーカーテーブル上に配られたカードから各ゲームへ入場する「総合ゲームロビー」。
単なるゲーム一覧ではなく、カジノに入場してテーブルに座る体験を作る。

### 世界観（**維持**）
- ホーム画面は王道のカジノ感を重視。
- 背景：深い赤・ワインレッド系
- 中央：緑色のポーカーテーブル
- アクセント：金・白・黒
- ゲームカード：トランプカード風UI
- NEON JACK画面：既存の黒×青ネオン系デザインを活かす

---

## 3. 対象ユーザー

- ブラウザで手軽に遊べるゲームを求めるユーザー
- ポーカー・スロット・カジノ風UIが好きなユーザー
- スマホ・PCどちらでも短時間で遊びたいユーザー
- ポートフォリオ閲覧者・採用担当者

---

## 4. 技術選定と判断

### 4.1 技術スタック（採用）

| 区分 | 採用 |
|------|------|
| ビルド/開発 | **Vite** |
| 言語 | **TypeScript** |
| UI | **React** |
| ルーティング | **React Router**（`createBrowserRouter`） |
| スタイル | **Tailwind CSS** |
| 状態管理 | **Zustand** |
| アニメーション | CSS Animation 中心、必要箇所のみ **Framer Motion** |
| 永続化（初期） | **localStorage**（repository経由） |
| テスト | **Vitest** |
| デプロイ | **Vercel**（Viteプリセット） |

### 4.2 なぜNext.jsではなくViteか（判断）

元仕様はNext.js App Routerを想定していたが、本アプリでは **Vite + React Router** を採用する。

- **NEON JACKが既にVite製**。Next.jsに移すと「games/neonjackへ移動」が *移動* ではなく *Vite→Next規約への書き換え*（`import.meta.env`→`process.env`、アセット参照、全コンポーネントの`"use client"`化など）になり、「既存NEON JACKを壊さない」要件と真っ向から衝突する。
- 本アプリは**全機能がクライアント側＋localStorage**。サーバーが無いため Next.js の主目的（SSR / RSC / API Routes / SEO）の恩恵がほぼ無い。
- Vite SPA も **Vercelでそのままデプロイ可能**（Framework Preset = Vite）。
- 結果として、ディレクトリ構成の大半（`components/` `games/` `store/` `repositories/` `types/` `utils/` `constants/`）はフレームワーク非依存でそのまま使える。変わるのは**ルーティング/エントリ層だけ**で、移行コストが最小。

> **Next.jsを選ぶ場合の差分（任意）**：Next.js学習自体が目的、あるいは将来 Server Actions / API Routes で本物のバックエンドを持つ計画があるなら、Next.js移行は妥当。ただしその場合は **ロビー整備とは別の独立フェーズ**として実施し、NEON JACK移植を巻き込まないこと。`pages/`→`app/`、`router.tsx`→ファイルベースルーティング、各ゲームページに`"use client"`、`utils/`の環境変数参照を置換、で対応できる。

### 4.3 デプロイ（Vercel）
- GitHub連携で `main` push時に本番、PRごとにプレビューURL。
- Build Command `vite build` / Output `dist`。
- `BrowserRouter` 利用のため、SPAフォールバック（全パスを `index.html` に）を設定（Vercelは自動だが念のため `vercel.json` で明示してもよい）。

---

## 5. アーキテクチャ

### 5.1 レイヤー構成

```
UI (React components / pages)
        │  呼び出すだけ。判定・計算・保存はしない
        ▼
store (Zustand: 実行時状態 + アクション)
        │  入出力は必ずここから
        ▼
repository (localStorage I/O のみ。将来Supabase差し替え点)
```

並行して、各ゲームの純ロジックは独立：

```
games/<game>/logic/*.ts   ← 純粋関数。UIにもstoreにも依存しない。Vitestで単体テスト
games/<game>/adapter.ts   ← Rate→ゲーム引数 変換 と GameResult 生成（統合の継ぎ目）
```

**鉄則：** ゲームロジックをReactコンポーネントに直接書かない（元仕様 10.2 を踏襲）。

```ts
// 悪い例
chips = chips - bet;

// 良い例
casinoStore.placeBet(gameId, betAmount);
```

### 5.2 状態管理の境界

| 共通状態（`casinoStore`） | ゲーム固有状態（各 `games/<game>` 内） |
|---|---|
| user / chips / profile | slot reels（NEON JACK） |
| transactions（台帳） | poker hand / community cards / pot |
| dailyBonus | current turn / CPU state |
| currentRate（選択中レート） | 演出フラグ など |

ゲーム固有状態は**グローバルstoreに混ぜない**。各ゲームは自前の小さなstoreまたはコンポーネント状態で持ち、結果が確定したときだけ `casinoStore.applyGameResult()` を呼ぶ。

### 5.3 永続化の責務（**repositoryに一本化**）

- **localStorageに直接触れてよいのは `repositories/` だけ**。コンポーネントやstoreから `localStorage.xxx` を呼ばない。
- Zustandの `persist` ミドルウェアは**移行対象データには使わない**（使うとrepository抽象を貫通して「差し替え点が1か所」が崩れる）。`persist`を使うのは純粋なUI設定（例：sound on/off）に限る。
- 将来のSupabase移行が同期→非同期になっても呼び出し側を変えずに済むよう、**repositoryのメソッドは初めから `async`（Promise）で設計**する（localStorageは同期だが構わない）。

```ts
// repositories/storage.ts ─ localStorage 薄ラッパ + schemaVersion + migration
const ROOT_KEY = "casino-hub";
const CURRENT_SCHEMA_VERSION = 1;

type PersistedRoot = {
  schemaVersion: number;
  user: UserProfile | null;
  transactions: ChipTransaction[];
  results: GameResult[];
  dailyBonus: DailyBonus;
  // 注意: chips は user.chips に持つ（単一の真実）。chipRepository は作らない
};

export async function loadRoot(): Promise<PersistedRoot> {
  try {
    const raw = localStorage.getItem(ROOT_KEY);
    if (!raw) return createDefaultRoot();
    const parsed = JSON.parse(raw) as PersistedRoot;
    return migrate(parsed); // 旧バージョンを最新へ
  } catch {
    // 読み込み失敗 → 初期データ再生成（元仕様 10.6）
    return createDefaultRoot();
  }
}

export async function saveRoot(root: PersistedRoot): Promise<void> {
  localStorage.setItem(ROOT_KEY, JSON.stringify({ ...root, schemaVersion: CURRENT_SCHEMA_VERSION }));
}

function migrate(root: PersistedRoot): PersistedRoot {
  let r = root;
  // if (r.schemaVersion < 2) { r = { ...r, /* v2への変換 */ }; }
  return { ...r, schemaVersion: CURRENT_SCHEMA_VERSION };
}
```

> **複数タブ前提**：localStorageはオリジン共有のため、複数タブでチップがズレ得る。MVPは**単一タブ前提**とし、将来 `window.addEventListener("storage", ...)` で同期する（後回しでよい）。

### 5.4 チップ経済モデル

- **チップの真実は `UserProfile.chips` の1か所**。`ChipTransaction.balanceAfter` は常にその時点の `chips` と一致させる。
- **更新経路を1本化**：チップ増減・累計更新・台帳追記・プレイ記録追記を**1つのstoreアクション内で原子的に**行う。

```ts
// casinoStore の主要アクション（疑似）
placeBet(gameId, amount): boolean        // 残高チェック→減算→type:"bet" の transaction 追記。不足ならfalse
applyGameResult(result: GameResult): void // 払い戻し加算→totalPlays/totalProfit更新→type:"win"のtx→results追記→saveRoot
claimDailyBonus(): boolean                // 当日未受領なら +amount → type:"bonus" → 受領日更新
rescue(): boolean                         // 破産救済（下記）
```

#### 破産救済（bailout, 追加仕様）
- 条件：`chips < LOWのminBalance(=100)`（=最安テーブルにも入れない）。
- 付与：`chips` を **1,000** に引き上げ（`type:"refund"` ではなく `type:"bonus"` の派生として記録、`source:"rescue"`）。
- 連打防止：**60分クールダウン**（`lastRescuedAt` を保存）。
- 位置づけ：無料シミュのための救済であり、経済の中心機能ではない。UI上は控えめに（例：チップ不足モーダル内の「Rescue Chips」）。

#### デイリーボーナス（明確化）
- 判定は**ローカルのカレンダー日（YYYY-MM-DD）**で比較。`lastClaimedAt` の日付が今日と異なれば受領可。
- 付与額 **1,000 chips**。
- 端末時計の改変で多重取得できる点はMVPでは許容（無料シミュ）。将来サーバー時刻へ移行できるよう `utils/date.ts` に日付判定を集約。

### 5.5 NEON JACK 統合方針（**既存ロジック不変**）

NEON JACK は Juggler系パチスロ（BET固定・払い出しはメダル/コイン、設定値でBIG等の確率が変わる）。汎用Vegasスロット的な可変BETを被せると実機モデルが壊れる。そこで：

- **NEON JACK内部の通貨は「コイン（メダル）」**のまま。スピン回し・抽選・払い出しは既存ロジックを**一切変更しない**（既存 `games/neonjack/logic/*` `data/*` `types.ts` をそのまま移植）。
- **カジノ共通通貨「チップ」とは“コイン単価”で橋渡し**する。レートが `betUnit = チップ/メダル` を与える（5円/20円スロの発想）。

```ts
// games/neonjack/adapter.ts
// NEON JACKの1ゲームをカジノ経済に接続する“継ぎ目”。内部ロジックは触らない。
export function buildNeonJackResult(spin: NeonJackSpinOutput, rate: Rate): GameResult {
  const chipsPerMedal = rate.betUnit;
  const betMedals = spin.betMedals;       // 通常3
  const payoutMedals = spin.payoutMedals; // 既存payout結果
  const bet = betMedals * chipsPerMedal;
  const payout = payoutMedals * chipsPerMedal;
  return {
    id: uuid(), userId, gameId: "neonjack",
    bet, payout, profit: payout - bet,
    playedAt: new Date().toISOString(),
  };
}
```

- **BET/MAXBETの扱い**：元仕様5.1の汎用BET/MAXBETは NEON JACK には**適用しない**。BETは実機どおり固定3枚（既存仕様準拠）。レート層がチップ⇔メダル換算だけ担当する。
- **`SlotSymbol` 等の型は再定義しない**。NEON JACK側の既存型を正とする。統合層が知るのは `{ bet, payout, profit }` の結果インターフェースだけ。

**移植チェックリスト（既存NEON JACKリポジトリ → 本アプリ）**
1. `src/games/neonjack/` に `components/ logic/ data/ types.ts` をコピー。
2. import パスを新構成に合わせて修正。
3. PNG筐体/リール等のアセットを `public/neonjack/...` 等へ移動し、参照URLを更新（Vite→Viteなので仕組みは同じ）。
4. ゲーム開始/終了のフックだけ `adapter.ts` 経由に差し込む（内部ロジックは不変）。
5. 既存の単体動作（スピン→停止→払い出し）が壊れていないことを確認してからコミット。

---

## 6. 画面構成 / ルーティング（React Router版）

```
/            タイトル画面
/login       ゲストログイン
/lobby       ロビー（緑テーブル＋カード）
/profile     プロフィール
/games/neonjack
/games/holdem
/games/omaha
/games/video-poker
```

> **命名規約**：URLは kebab-case（`video-poker`）、コード/`GameId`は camelCase（`videoPoker`）。両者の対応は `constants/games.ts` の `path` で持つ。

```ts
// routes/router.tsx
import { createBrowserRouter } from "react-router-dom";
export const router = createBrowserRouter([
  { path: "/", element: <TitlePage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <AppShell />,            // ヘッダー等の共通レイアウト
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/lobby", element: <LobbyPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/games/neonjack", element: <NeonJackPage /> },
      { path: "/games/holdem", element: <ComingSoonOrPage id="holdem" /> },
      { path: "/games/omaha", element: <ComingSoonOrPage id="omaha" /> },
      { path: "/games/video-poker", element: <ComingSoonOrPage id="videoPoker" /> },
    ],
  },
]);
```

---

## 7. 主要機能

### 7.1 タイトル画面
- 表示：アプリタイトル `CASINO HUB` / サブ `Free Casino Game Simulator` / スタート / ゲストログイン / 所持チップ / 簡単な説明 / **注意文**。
- 注意文には「本アプリは無料チップのみを使うシミュレーションであり、現金・換金・実際の賭博要素は一切ありません」を明記（ポートフォリオ的にも誠実さが伝わる）。
- 本格的なログイン認証は入れない。名前入力＋localStorageのゲストログイン。

### 7.2 ゲストログイン
- 入力：プレイヤー名のみ。
- `UserProfile` を生成（初期チップ `10000`）。
- 保存は `userRepository` 経由。ユーザー管理ロジックは将来のSupabase/Firebase認証に差し替えられるよう独立。

### 7.3 ロビー画面（**世界観維持**）
- 中央に緑のポーカーテーブル、その上に配られたトランプカードがゲーム選択ボタン。
- 表示：タイトル / 所持チップ / プロフィール導線 / デイリーボーナス / ランキング導線 / ゲーム選択カード / ユーザー切替。

| カード | ゲーム |
|--------|--------|
| A♠ | NEON JACK |
| K♥ | Texas Hold'em |
| Q♦ | Omaha Poker |
| J♣ | Video Poker |
| Joker | Coming Soon |

```
┌──────────────────────────────┐
│ CASINO HUB        Chips 10000 │
├──────────────────────────────┤
│        緑のポーカーテーブル        │
│   [A♠ NEON JACK] [K♥ HOLD'EM] │
│   [Q♦ OMAHA]     [J♣ VIDEO]   │
│          [JOKER SOON]         │
├──────────────────────────────┤
│ Daily Bonus / Profile / Rank  │
└──────────────────────────────┘
```

### 7.4 カード配布演出
- 初回表示時にカードを1枚ずつ配る → クリック可能 → ホバーで浮き上がる → 未実装は Coming Soon。
- **CSSアニメーション中心**で軽量に。スマホでも動くこと。重い演出はFramer Motionに限定。

### 7.5 レート選択
- ゲームカードをクリック → `RateSelectModal` で4段階から選択（§8）。
- すべてのゲームはこのレート選択を通って開始する。

### 7.6 共通チップ機能
- チップ加減算・残高表示・プレイ履歴保存・不足時警告・デイリー付与。
- **チップ処理は各ゲームに直接書かず、必ず `casinoStore` のアクションを通す**（§5.4）。

### 7.7 プロフィール
- 表示：名前 / 所持チップ / 総プレイ回数 / 総収支 / 勝利回数 / レベル / 作成日。
- **`level` のルール（暫定）**：`level = floor(totalPlays / 50) + 1`（XP系統は将来拡張。MVPでは死にデータにしないための単純式）。
- 累計値（`totalPlays` `totalProfit` `wins`）は `applyGameResult` でのみ更新（ドリフト防止）。

### 7.8 ランキング（**バックエンド依存・MVP外**）
- localStorageは端末/ブラウザ単位のため、真のユーザー間ランキングは成立しない。
- MVPでは導線のみ or 自己ベスト表示に留める。所持チップ/総勝利/ゲーム別/デイリー/週間ランキングは**Supabase等の導入後**に実装。

---

## 8. レート仕様（明確化版）

元仕様の「必要チップ」が多義だったため、**2つの明確な軸**に分離する。

- `minBalance`：そのテーブルに**座るための最低残高（ゲートのみ。減算しない）**。
- `betUnit`：**賭けのスケール**。各ゲームが自分の流儀で解釈する（slot=コイン単価、poker=ベース賭け額/ブラインド）。

| id | label | `minBalance` | `betUnit` | NEON JACK: チップ/メダル | Poker: ベース賭け |
|----|-------|-------------:|----------:|------------------------:|------------------:|
| low | LOW | 100 | 1 | 1 | 1 |
| middle | MIDDLE | 1,000 | 10 | 10 | 10 |
| high | HIGH | 5,000 | 50 | 50 | 50 |
| vip | VIP | 10,000 | 100 | 100 | 100 |

- 設計上の比率：NEON JACK の1スピン=3メダル なので 1スピン費用 = `3 × betUnit`。`minBalance` は各段で **約33スピン分のバッファ**になる（100/3 ≒ 1000/30 ≒ 5000/150 ≒ 10000/300 ≒ 33）。どの段でも同じ感覚で遊べる。
- **buy-in/cash-outは作らない**：チップが普遍通貨で、テーブルでは直接賭ける。ポーカーは「自分の残高＝スタック」のキャッシュゲーム扱い（モデルを単純化）。各ゲームの `adapter.ts` が `Rate` をゲーム引数に変換する。

```ts
// constants/rates.ts
export const RATES: Rate[] = [
  { id: "low",    label: "LOW",    minBalance: 100,   betUnit: 1 },
  { id: "middle", label: "MIDDLE", minBalance: 1000,  betUnit: 10 },
  { id: "high",   label: "HIGH",   minBalance: 5000,  betUnit: 50 },
  { id: "vip",    label: "VIP",    minBalance: 10000, betUnit: 100 },
];
```

---

## 9. ゲーム別仕様

### 9.1 NEON JACK（最初に完成させるメイン）
- デザイン：黒基調×青ネオン、実機スロット風筐体、赤い停止ボタン、レバー、3リール。
- 機能：SPIN（BETは実機どおり固定3枚）／リール回転・停止／配当判定／チップ増減／リザルト。
- **配当・抽選は既存ロジックを不変で移植**。UIから分離（`logic/slotEngine.ts` `logic/payout.ts` `data/reels.ts`）。
- カジノ経済との接続は `games/neonjack/adapter.ts`（§5.5）。

### 9.2 Video Poker（最初の追加候補・推奨）
- 1人用。5枚配布 → 任意Hold → 残り交換 → 最終役で配当。Hold'emより軽く、ポーカー系の役評価ロジックを先に整備できる。
- **配当表（Jacks or Better / 9-6, `betUnit` 倍）**：

| 役 | 配当（×betUnit） |
|----|-----------------:|
| Royal Flush | 250 |
| Straight Flush | 50 |
| Four of a Kind | 25 |
| Full House | 9 |
| Flush | 6 |
| Straight | 4 |
| Three of a Kind | 3 |
| Two Pair | 2 |
| Jacks or Better | 1 |
| 役なし | 0 |

### 9.3 Texas Hold'em
- プレイヤー1人＋CPU3人、手札2枚＋共通5枚、Fold/Check/Call/Raise、役判定、勝敗、チップ増減。
- 将来拡張：オンライン対戦／トーナメント／チャット／CPU思考レベル／オールイン演出。
- **CPU AI はMVPでは単純ルールベース**（弱い→Fold、普通→Call、強い→Raise）でよい。思考レベルは後フェーズ。

### 9.4 Omaha
- プレイヤー1人＋CPU3人、手札4枚＋共通5枚、**手札からちょうど2枚＋共通からちょうど3枚**を使用。
- **役判定の共有方針（重要）**：Hold'emの役判定を“そのまま”流用はしない、が、**5枚ハンドのランク付け（ストレート/フラッシュ等）は共通化**する。違うのは**組合せ生成だけ**。

```ts
// 共通: 5枚を評価
rankFiveCardHand(cards: Card[5]): HandRank

// Hold'em: 7枚から最良5枚 → C(7,5)=21通り
// Omaha:   手札4から2(C=6) × 共通5から3(C=10) = 60通り を rankFiveCardHand で評価し最良を採用
bestHand(hole: Card[], community: Card[], game: "holdem" | "omaha"): { rank: HandRank; cards: Card[5] }
```

> ポーカーの `Suit/Rank/Card`（§10）と、ロビーのトランプ装飾カード（`GameInfo.cardSuit` に `"joker"` を含む）は**別物**。前者はゲームロジック用、後者はロビー表示用の装飾型。混在させない。

---

## 10. 共通型定義（修正版）

```ts
// types/user.ts
export type UserProfile = {
  id: string;
  name: string;
  chips: number;          // ← チップの単一の真実
  level: number;
  totalPlays: number;
  totalProfit: number;
  wins: number;           // 追加（プロフィールの勝利回数の出所を明確化）
  createdAt: string;      // ISO8601
  updatedAt: string;
};

export type DailyBonus = {
  lastClaimedAt: string | null; // YYYY-MM-DD で比較
  amount: number;
  lastRescuedAt: string | null; // 破産救済クールダウン用
};
```

```ts
// types/game.ts
export type GameId = "neonjack" | "holdem" | "omaha" | "videoPoker";

export type GameInfo = {
  id: GameId;
  title: string;
  description: string;
  status: "available" | "comingSoon";
  cardRank: string;                 // 表示用 "A" "K" など
  cardSuit: "spade" | "heart" | "diamond" | "club" | "joker"; // ロビー装飾用（gameplay Suitとは別）
  path: string;                     // "/games/video-poker"
};

export type GameResult = {          // 1プレイの結果（履歴・統計用）
  id: string;
  userId: string;
  gameId: GameId;
  bet: number;
  payout: number;
  profit: number;                   // payout - bet
  playedAt: string;
};
```

```ts
// types/casino.ts
export type Rate = {
  id: "low" | "middle" | "high" | "vip";
  label: string;
  minBalance: number;               // 入場ゲート（減算しない）
  betUnit: number;                  // 賭けスケール（ゲーム別に解釈）
};

export type ChipTransaction = {     // 台帳（source of truth の増減ログ）
  id: string;
  userId: string;
  gameId: GameId | null;            // bonus/refund/rescue は null 可
  type: "bet" | "win" | "bonus" | "refund";
  source?: "daily" | "rescue";      // bonus の内訳（任意）
  amount: number;                   // 符号付き or 正値+typeで判断（実装で統一）
  balanceAfter: number;             // 適用後の chips と必ず一致
  createdAt: string;
};
```

```ts
// types/card.ts （ポーカー系ゲーム用）
export type Suit = "spade" | "heart" | "diamond" | "club";
export type Rank =
  | "A" | "K" | "Q" | "J" | "10"
  | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Card = { suit: Suit; rank: Rank };
```

> **GameResult と ChipTransaction の関係**：`GameResult` は「1プレイの記録（履歴/統計）」、`ChipTransaction` は「残高増減の台帳」。1つの `GameResult` は通常 `bet`（賭け時）と `win`（払い戻し時）の **2つの transaction** を生む。残高の真実は常に `UserProfile.chips`、台帳の `balanceAfter` がそれと一致する。

```ts
// utils/id.ts
export const uuid = () => crypto.randomUUID();
```

---

## 11. ディレクトリ構成（Vite版）

```
src/
├── main.tsx                  # ReactDOM + RouterProvider + store初期化(hydrate)
├── App.tsx
├── routes/
│   └── router.tsx            # createBrowserRouter
├── pages/
│   ├── TitlePage.tsx
│   ├── LoginPage.tsx
│   ├── LobbyPage.tsx
│   ├── ProfilePage.tsx
│   └── games/
│       ├── NeonJackPage.tsx
│       ├── HoldemPage.tsx
│       ├── OmahaPage.tsx
│       └── VideoPokerPage.tsx
├── components/
│   ├── common/   # Button, Modal, ChipDisplay, GameCard
│   ├── layout/   # AppHeader, AppShell, RouteErrorBoundary
│   └── casino/   # PokerTable, PlayingCard, RateSelectModal, DealAnimation
├── games/
│   ├── neonjack/  { components/, logic/, data/, adapter.ts, types.ts }
│   ├── holdem/    { components/, logic/, adapter.ts, types.ts }
│   ├── omaha/     { components/, logic/, adapter.ts, types.ts }
│   └── videoPoker/{ components/, logic/, adapter.ts, types.ts }
├── store/
│   └── casinoStore.ts        # user, chips, transactions, results, dailyBonus, currentRate
├── repositories/
│   ├── storage.ts            # localStorage薄ラッパ + schemaVersion + migrate
│   ├── userRepository.ts     # chipsはuserに含む（chipRepositoryは作らない）
│   └── historyRepository.ts  # transactions / results
├── types/    { card.ts, casino.ts, game.ts, user.ts }
├── utils/    { id.ts, date.ts, format.ts, random.ts }
└── constants/{ games.ts, rates.ts }
```

> 元仕様の `chipRepository` は**廃止**（チップは `user.chips` に持つため不要）。台帳/履歴は `historyRepository` に集約。

---

## 12. 運用・保守方針

### 12.1 ゲーム追加レシピ（ロビーを書き換えない）
新ゲーム追加は次の作業だけで完結させる：
1. `games/<新ゲーム>/` を追加（`components/ logic/ adapter.ts types.ts`）。
2. `constants/games.ts` に `GameInfo` を1件追加。
3. `routes/router.tsx` に1ルート追加。
4. `adapter.ts` で `Rate`→引数変換と `GameResult` 生成を実装し、`casinoStore.applyGameResult` に接続。

### 12.2 UIとロジックの分離
ロジックは `games/<game>/logic/*` の純粋関数へ。コンポーネントは「呼ぶだけ」。

### 12.3 共通処理を重複させない
チップ表示 / レート選択 / モーダル / ボタン / カードUI / 日付フォーマット / ランダム / 履歴保存 / 結果保存 は共通化。

### 12.4 データ保存処理の隔離
localStorageに触るのは `repositories/` のみ（§5.3）。Supabase移行時はrepository内部だけ変更。

### 12.5 型を先に決める
先に固める共通型：`UserProfile / GameId / GameInfo / Rate / Card / GameResult / ChipTransaction`。

### 12.6 エラー処理

| エラー | 対応 |
|--------|------|
| チップ不足 | 警告＋レートを下げる案内。下げても不足なら **Rescue** 提示 |
| localStorage読込失敗 | 初期データ再生成（`createDefaultRoot`） |
| 未実装ゲーム選択 | Coming Soon モーダル |
| 不正なBET額 | 最小BET（`betUnit`）に丸める |
| ゲーム中リロード | **MVPはロビーへ復帰し、進行中プレイは破棄**（後述） |
| Reactレンダリング例外 | `RouteErrorBoundary` で捕捉しロビー復帰導線を表示 |

#### リロード/中断の扱い（明確化）
- **1プレイのチップ変動は確定時に原子的にコミット**する。中断されたプレイは破棄され、**純チップ変動は0**（賭け前に戻る）。
- MVPはゲーム途中状態を保存しない（poker手札やpotの途中復元はしない）。リロード時はロビーへ。これは意図的なMVP簡略化。

### 12.7 パフォーマンス
- スロット演出を重くしない／画像は圧縮／アニメは必要箇所のみ／不要な再レンダリング削減（`memo` / セレクタ）。
- 初期段階は演出より**動作安定性を優先**。

### 12.8 レスポンシブ
- 対応：PC / タブレット / スマホ（優先 PC → スマホ → タブレット）。
- カジノテーブルUIは横長になりやすいので、スマホではカードを縦並びにしてよい。

### 12.9 テスト方針（追加）
UI/ロジック分離の利点を実利化する。
- **Vitest** で純ロジックを単体テスト：`neonjack/logic`（払い出し境界）、`videoPoker/logic`（役判定・配当表）、`holdem/omaha`（`rankFiveCardHand` と `bestHand` の組合せ）。
- `casinoStore` の `placeBet`/`applyGameResult`/`claimDailyBonus` のチップ整合（`balanceAfter === chips`）をテスト。
- ポートフォリオ的にも「ロジックにテストがある」は評価が高い。

### 12.10 Git運用
- ブランチ例：`main` / `develop` / `feature/lobby` / `feature/neonjack-integration` / `feature/chip-system` / `feature/video-poker` / `fix/mobile-layout`。
- `main` は常にデプロイ可能。新機能は `feature` ブランチ。**Claude Codeに大規模変更させる前に必ずGitで保存**。

### 12.11 今後の拡張に備える点
本格ログイン / クラウド保存 / ユーザーランキング / 実績 / ミッション / デイリーイベント / オンライン対戦 / アバター / チャット / サウンド設定 / 多言語。
ただし初期は入れすぎない。**ロビー・共通チップ・NEON JACK統合を最優先**。

---

## 13. 開発フェーズ

| Phase | 内容 |
|-------|------|
| 1 | 土台：タイトル / ゲストログイン / ロビー（緑テーブル） / カード配布演出 / ゲームカード / レート選択 / 共通チップ表示 / repository & store 整備 / schemaVersion |
| 2 | **NEON JACK統合**：既存をViteのまま `games/neonjack` へ移動 → `adapter.ts` で接続 → レート選択から開始 → 結果を履歴保存（既存動作を壊さない） |
| 3 | プロフィール・履歴：プロフィール画面 / 総プレイ・総収支・勝利 / 最近の履歴 / デイリーボーナス / 破産救済 |
| 4 | **Video Poker**：デッキ / 5枚配布 / Hold / 交換 / 役判定 / 配当（共通役評価コアをここで確立） |
| 5 | Texas Hold'em：CPU対戦 / ベットラウンド / 役判定 / 勝敗 |
| 6 | Omaha：Omaha専用の組合せ生成（手札2＋共通3）で共通役評価コアを再利用 |

---

## 14. MVPで完成とみなす条件

- タイトル画面がある
- ゲストログインできる
- ロビー（緑テーブル＋トランプカード）が表示される
- NEON JACK を選択できる
- レート選択ができる
- NEON JACK をプレイできる（既存動作のまま）
- チップが増減する／保存される（repository経由）
- デイリーボーナスが受け取れる
- 破産時に救済できる
- 未実装ゲームは Coming Soon
- Vercelで公開できる

---

## 15. Claude Code用プロンプト（更新版）

```
現在、Vite / TypeScript / React / Tailwind CSS でNEON JACKというパチスロ風スロットゲームを
単体アプリとして制作しています（既存リポジトリあり）。
これを「複数のカジノ風ゲームを遊べる総合アプリ CASINO HUB」へ拡張したいです。
以下の仕様に沿って、既存のNEON JACKを壊さず段階的にリファクタリング/統合してください。

【最重要の前提】
- 現金・換金要素なし。無料チップのみのシミュレーション
- ビルドはNext.jsではなくViteのまま（NEON JACKがVite製のため。SSR不要）
- ルーティングは React Router（createBrowserRouter）
- localStorageに触れるのは repositories/ だけ。store/コンポーネントから直接触らない
- repositoryのメソッドは将来のSupabase移行に備え async で設計
- チップの真実は user.chips の1か所。増減・累計更新・台帳追記・結果追記は
  casinoStore の applyGameResult/placeBet/claimDailyBonus の中で原子的に行う
- NEON JACKの抽選・払い出し等の内部ロジックは一切変更しない。
  カジノ経済との接続は games/neonjack/adapter.ts でのみ行い、
  レート(betUnit)を「チップ/メダル」の換算として使う（BETは実機どおり固定3枚）

【画面】タイトル / ゲストログイン / ロビー / レート選択 / NEON JACK / プロフィール

【ロビー（変更しない世界観）】
- 背景は赤系カジノ風、中央に緑のポーカーテーブル
- テーブル上にトランプカード型のゲーム選択カード
  A♠:NEON JACK / K♥:Texas Hold'em / Q♦:Omaha / J♣:Video Poker / Joker:Coming Soon
- 未実装は Coming Soon モーダル

【チップ】初期10000 / localStorage(repository経由) / 不足時警告 / 破産時はRescue(残高<100で1000へ, 60分CD) / デイリー1000(ローカル日付判定)

【レート】minBalance(入場ゲート)とbetUnit(賭けスケール)の2軸:
  LOW 100/1, MIDDLE 1000/10, HIGH 5000/50, VIP 10000/100
  ゲーム選択後にレート選択モーダル。各ゲームのadapter.tsがbetUnitを解釈

【保守】UIとロジック分離 / games/配下に分離 / 共通UIはcomponents/ / 型はtypes/ /
  localStorageはrepositories/ / 純ロジックはVitestで単体テスト /
  mainで作業せず feature/lobby ブランチで作業

まず以下を実装してください（既存NEON JACKは触らずに新規土台を作る）：
1. ディレクトリ構成の整理（§11）と共通型の定義（§10）
2. repositories/storage.ts（schemaVersion + migrate）, userRepository, historyRepository
3. casinoStore（hydrate / placeBet / applyGameResult / claimDailyBonus / rescue）
4. タイトル画面・ゲストログイン
5. ロビー（PokerTable + PlayingCard/GameCard + カード配布演出 = CSS中心）
6. RateSelectModal
7. constants/games.ts, constants/rates.ts
8. /games/neonjack ルートの器（既存NEON JACKの移植先・adapter.tsの雛形）
```

---

## 付録A：元仕様の矛盾点・改善点と解消一覧

1. **ビルドツール矛盾**：Next.js移行が「NEON JACKを壊さない」と衝突 → **Viteのまま**＋React Router（§4.2）。
2. **永続化の二重所有**：Zustand persist と repository が両方localStorage → **repositoryに一本化**、persistは移行対象に使わない（§5.3）。
3. **パチスロ vs 汎用スロット**：BET/MAXBET＋可変レートがJuggler系と非整合 → レート＝**コイン単価**で橋渡し、内部不変（§5.5, §8）。
4. **レート多義**：「必要チップ」＝入場料/最低残高/最低BET? Rate型に`minBet`+`entryCost` → **`minBalance`＋`betUnit`**に分離（§8, §10）。
5. **破産で詰む**：Low(100)もデイリーも無いと進行不能 → **Rescue**追加（§5.4）。
6. **`ChipTransaction`/`GameResult`重複**：→ 台帳 vs プレイ記録の関係を定義、更新経路を`applyGameResult`に一本化（§5.4, §10）。
7. **スキーマ変更耐性なし**：仕様改訂で旧保存データ破損 → `schemaVersion`＋`migrate`（§5.3）。
8. **`UserProfile.level`にルールなし**：→ 暫定式を定義（§7.7）。
9. **`UserProfile`に勝利回数の出所なし**：→ `wins` を追加（§10）。
10. **NEON JACKの`SlotSymbol`再定義**：既存型と二重定義の恐れ → 統合層では**再定義しない**（§5.5）。
11. **状態の境界が曖昧**：共通状態とゲーム固有状態 → 明確に分離（§5.2）。
12. **ID生成方針なし**：→ `crypto.randomUUID()`（§10）。
13. **リロード/中断時の挙動が曖昧**：→ 原子的コミット＋中断は破棄、MVPはロビー復帰（§12.6）。
14. **Video Poker配当表なし**：→ Jacks or Better 9-6 を定義（§9.2）。
15. **Hold'em/Omahaの役評価関係が曖昧**：→ **5枚ランカは共有、組合せ生成だけ分離**（§9.4）。
16. **ロビー装飾Suit と gameplay Suit の混同**（`joker`含む）：→ 別型として明記（§9.4, §10）。
17. **CPU AI未定義**：→ MVPは単純ルールベース、思考レベルは後フェーズ（§9.3）。
18. **テスト方針なし**：→ Vitestで純ロジック＆store整合（§12.9）。
19. **複数タブのチップ整合**：→ MVPは単一タブ前提、将来`storage`イベント同期（§5.3）。
20. **ランキングの実態**：localStorageでは成立しない → **MVP外（backend依存）**と明記（§7.8）。
21. **`chipRepository`の不要性**：チップは`user.chips` → 廃止し`historyRepository`に集約（§11）。
22. **URL/コードの命名規約**：kebab vs camel → `path`で対応を一元化（§6）。
23. **無料シミュ明記**：注意文を強化（誠実さ・ポートフォリオ配慮）（§7.1）。
