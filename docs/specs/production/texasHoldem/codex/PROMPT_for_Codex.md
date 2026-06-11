# Codex 実装指示 — Texas Hold'em（ロジック層）

> このプロンプトと一緒に `Texas_Holdem_仕様書_v1.2.0_FINAL.md` を添付して渡してください。

## あなたの役割
添付仕様書に従い、CASINO HUB の Texas Hold'em の **ロジック層とテスト** を実装する。
**UIと演出は一切作らない**（別エージェント = Claude の担当）。あなたは状態と数値の「真実」を握る側。

## 前提
- 既存 CASINO HUB（Vite + React Router + TypeScript）の構成を維持する。
- Video Poker の Rate / 持ち込み / tableStack / GameEconomy 設計を**そのまま流用**する（再発明しない）。
- 永続化は既存の `repositories/` 層の方針に合わせる。`UserProfile.chips` が真実値。
- 担当範囲は仕様書 §33.1。Claude との境界は §19.5（hook返り値）と §26（演出イベント契約）。

## 最初にやること：契約の確定 ★最重要
コードを書く前に、**共有型をすべて定義して export し、先にコミットする**。これが Claude 側UIの土台になるので、ここを最速で外してブロッカーを消す。

- `UseTexasHoldemReturn` … §19.5（特に `availableActions` / `animationEvents` / `onAnimationEventComplete`）
- `AvailableActions` / `ActionAvailability` … §9.3
- `AnimationEvent` … §26.1
- `HoldemSeat` / `SeatStatus` / `CpuStyle` … §18.2
- `Rate` / `RateId` / `HoldemRateConfig` … §4.3
- `HoldemPhase` … §7.1 ／ `HoldemAnimationPhase` … §25
- `ActionResult` / `HoldemActionError` … §19.1–19.2
- `Pot` / `BestHoldemHand` / `PreflopStrength` 等

→ `texasHoldem/types.ts` にまとめてコミット。**以降この型を変えるときは必ず先に宣言する。**

## 実装範囲（ファイル｜§33.1）
- `shared/poker/` … `deck.ts` / `cardTypes.ts` / `handEvaluator.ts`
- `logic/` … `holdemEvaluator.ts`(`rankBestOfSeven`) / `betting.ts`(pure reducer) / `pot.ts` / `showdown.ts` / `cpuStrategy.ts`
- `adapter.ts` … GameEconomy連携・Rate→HoldemRateConfig 変換
- `useTexasHoldem.ts` の **ロジック部分** … useReducer本体・state machine・`getHandContributionCap`・`availableActions`算出・**`animationEvents`のemit**・`isResolvingRef`ロック・全操作関数の合法判定と状態更新
- **全テスト**（§32）

## 絶対ルール（違反禁止）
- React state を直接ミューテーションしない。reducer内で immutable update（§21.1）。
- 操作関数は必ず `ActionResult` を返す。失敗は単に return せず `reason` + `message` を返す（§19）。
- **ブラインド徴収は `placeToPot` 経由**（§10.4）。`streetContribution` 等への直接代入禁止。
- `handContributionCap` は `getHandContributionCap` に集約（§12.2）。各アクションで個別計算しない。
- All-in は **残り tableStack 全額投入のみ** 許可（§14）。疑似All-in・`currentBet`超〜`minRaise`未満のAll-in Raise・`allInRaiseTo < currentBet` は `SIDE_POT_NOT_SUPPORTED` で拒否。
- チップ投入後は必ず `normalizeSeatStatusAfterContribution`（§5.1）。`active かつ tableStack=0` を残さない。
- **数値・勝敗・金額・役カテゴリはロジックで確定し、`animationEvents` に載せて渡す**（`potAfter` 等も含める）。UIに再計算させない。
- 演出は**再生しない**。`animationEvents` を emit し、`onAnimationEventComplete(id)` を受けて初めて次へ進める。**イベントが acknowledge されるまでフェーズを進めない。**
- §36 の不変条件を常に満たす。

## 進め方（順序厳守｜§34 Phase 1→4）
**UI/演出には絶対に着手しない。**
1. **Phase 1 コアロジック**：deck / Rate流用 / buy-in / tableStack / GameEconomy / `rankBestOfSeven` / pot / SB·BB / betting reducer / cap / Fold·All-in制限
2. **Phase 2 状態遷移**：startHand → … → result、nextHand完全初期化、`availableActions`算出、`animationEvents` emit
3. **Phase 3 CPU**：4人生成・スタイル別判断・プリフロップ評価・自動進行・ショート補充
4. **Phase 4 サンドボックス & テスト**：`/sandbox/texas-holdem` + 全テスト

## テストの重点（§32）
chips↔tableStack のロックステップ更新 / サイドポット非発生 / `handContributionCap` / All-in制限 / **PreflopのBBオプション（最後にCheck・Raiseできる）** / Fold処理 / 7枚評価（`usedHoleCardCount` 0·1·2）/ Split端数ルール / `animationEnabled=false` でも状態遷移成立 / **`animationEvents` の順序と `onAnimationEventComplete` 消化でフェーズが進む**こと。

## 完了条件
- 仕様書 §35 のロジック側項目を満たす。
- §36 の不変条件がテストで担保されている。
- `/sandbox/texas-holdem` で固定デッキ・任意手札テストができる。
- 全テストがグリーン。

## やらないこと
- `components/` 配下の実装、Framer Motion、CSS演出、卓の描画。
- 勝敗・金額のUI側再計算を前提とした設計。
- React state の直接書き換え。

## 最初の応答で
コードを書き始める前に、**仕様書を通読し、矛盾・曖昧点があれば箇条書きで挙げて確認**すること。
そのうえで、最初にコミットする `types.ts` の内容を提示してから着手すること。
