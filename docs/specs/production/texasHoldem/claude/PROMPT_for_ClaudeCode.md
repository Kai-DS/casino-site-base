# Claude Code 実装指示 — Texas Hold'em（UI・演出層）

> このプロンプトと一緒に `Texas_Holdem_仕様書_v1.2.0_FINAL.md` を添付して渡してください。

## あなたの役割
添付仕様書に従い、CASINO HUB の Texas Hold'em の **UIと疑似3D演出** を実装する。
**ゲームロジックと状態管理は作らない**（別エージェント = Codex の担当）。あなたは hook が公開する状態を「魅せる」側。

## 前提
- 既存 CASINO HUB（Vite + React Router + TypeScript + Framer Motion）の構成を維持する。
- 既存の casino 系コンポーネント（`CardFace` / `ChipStack` / `CasinoButton` 等）と Video Poker のUIを参考にトーンを揃える。
- 担当範囲は仕様書 §33.2。Codex との境界は §19.5（hook返り値）と §26（演出イベント契約）。

## 契約に対して作る ★重要
あなたは Codex が export する型に対してUIを作る：
- `UseTexasHoldemReturn` … §19.5（`availableActions` / `animationEvents` / `onAnimationEventComplete` を含む）
- `AnimationEvent` … §26.1
- `HoldemSeat` / `Rate` … §18.2 / §4.3

**実物の hook がまだ無い場合は、固定の `AnimationEvent` 列を返す「モック `useTexasHoldem`」を自作し、それに対して演出を先行実装する**。後で実物に差し替える。これで Codex を待たずに進められる。

## 実装範囲（ファイル｜§33.2）
- `components/` … `TexasHoldemGame.tsx` / `PokerTable.tsx` / `HoldemSeat.tsx` / `CommunityCards.tsx` / `HoleCards.tsx` / `HoldemControls.tsx` / `PotDisplay.tsx` / `ActionLog.tsx` / `ResultBanner.tsx` / `RebuyModal.tsx`
- `components/casino/` … `CardFace.tsx` / `ChipStack.tsx` / `CasinoButton.tsx`
- モーション基盤 … `DURATION` / `EASING` / `SPRING`（§22.2）、カラートークン（§22.1）
- `animation.test.ts` の **演出ロック系**

## 絶対ルール（違反禁止）
- **状態は読み取りのみ**。`seat` / `pot` / `phase` を直接書き換えない（§21.3）。勝敗・金額を自前計算しない（イベントの値をそのまま表示）。
- **演出時間・easing は §22 のトークンを必ず使う**。マジックナンバーを散在させない。
- **卓は緑**（§23.1）。ベタ塗り禁止 — radial-gradient + 金/真鍮レール + 内側 soft shadow + 微フェルト質感 + vignette。
- **`availableActions` だけで** 操作ボタンの活性/非活性とツールチップ理由を決める（§9.3 / §27）。UI側で合法判定をしない。**「押せるのに弾かれる」を作らない。**
- **各 `AnimationEvent` の再生が終わったら必ず `onAnimationEventComplete(id)` を呼ぶ**（§26.2）。呼ばないとロジックが止まる。
- 派手さは **Straight Flush / Royal Flush に集中**（§24.8）。敗北は上品に、**シェイクしない**（§24.9）。
- `prefers-reduced-motion` / `animationEnabled=false` 対応（§24.12）。演出時間は短縮するが**状態遷移は省略しない**。
- アニメーション中は操作ロック（`isAnimating` で `ANIMATING`、§19.4 / §20）。

## 演出イベント再生ループ（§26.2）
`TexasHoldemGame.tsx` が hook を購読し：
1. `animationEvents` のキュー先頭を1件再生
2. 完了で `onAnimationEventComplete(event.id)` を呼ぶ
3. 次のイベントへ。キューが空になればロジックが次フェーズへ進む

各イベント（`DEAL_HOLE` / `REVEAL_FLOP` / `CHIP_TO_POT` / `FLIP_HOLE` / `AWARD_POT` / `RESULT_BANNER` 等）の duration・easing・軌道は §22・§24 に従って**あなたが決める**。数値（amount, potAfter, 勝者, 役）は**イベントから受け取るだけ**。

## 進め方（順序厳守｜§34 Phase 5→6）
**演出から作らない。**
1. **Phase 5 基本UI**：緑ポーカーテーブル / 自分の手札 / CPU席 / コミュニティ / 操作ボタン(availableActions連動) / pot表示 / action log / result。まず**静的に hook（またはモック）へ配線**して1ハンド通す。
2. **Phase 6 疑似3D演出**：ホールカード配布（アーチ+フリップ §24.2）/ コミュニティ公開（§24.3）/ チップ移動（§24.4）/ ターンインジケータ・呼吸glow（§24.5）/ CPUラベル（§24.11）/ ショーダウン振り付け（§24.7）/ 勝利演出の階層（§24.8）/ モーショントークン適用。

## 完了条件
- 仕様書 §35 のUI側項目を満たす（卓が緑、`availableActions` で活性制御、イベント再生でロジックが進む、各公開・チップ移動・ショーダウン演出、役階層の勝利演出、スマホ幅で崩れない、reduced motion 対応 等）。
- マジックナンバーが無く、全演出が §22 トークン経由。

## やらないこと
- ゲームロジック（betting / pot / showdown / cpuStrategy / 役判定）の実装。
- 勝者・金額・役カテゴリのUI側計算。
- React state の直接書き換え、duration のハードコード。

## 最初の応答で
コードを書き始める前に、**仕様書を通読し、矛盾・曖昧点や契約型に足りない情報があれば箇条書きで挙げて確認**すること。
そのうえで、モック `useTexasHoldem` の設計（返す固定イベント列）とコンポーネント依存ツリーを提示してから着手すること。
