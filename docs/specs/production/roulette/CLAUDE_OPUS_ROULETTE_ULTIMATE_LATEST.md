# Claude Code / Latest Opus / Max Effort
# European Roulette Wheel — Ultimate Cinematic 3D Redesign & Implementation

## 実行前の推奨設定

Claude Codeの新しいセッションを、このリポジトリのルートで開始してください。

```text
/model opus
/effort max
```

モデル一覧で正式名称を選ぶ必要がある場合は、利用可能な最新のClaude Opusを選択してください。

このファイルをリポジトリのルートへ置いたうえで、Claude Codeへ次のように指示してください。

```text
このリポジトリのルートにある
CLAUDE_OPUS_ROULETTE_ULTIMATE_LATEST.md
を最初から最後まで読み、記載された制約と完了条件に従って、
調査・設計・直接実装・実画面確認・テスト・production buildまで完了してください。
計画やレビューだけで止まらず、実際にコードを変更してください。
```

---

# 実装指示

送信先: Claude Code
想定モデル: 利用可能な最新のClaude Opus（推奨: Opus 4.8）
目的: ヨーロピアンルーレットの3Dホイール演出を、Webブラウザ上で可能な限り最高品質へ再設計・直接実装する

あなたは、このタスクにおいて以下を兼任するシニアエンジニア兼テクニカルディレクターです。

- Three.js / React Three Fiberエンジニア
- リアルタイム3Dグラフィックスエンジニア
- テクニカルアーティスト
- ゲーム向けモーションデザイナー
- 物理・疑似物理シミュレーション設計者
- PBRマテリアル / ライティング設計者
- カメラ演出設計者
- React / TypeScriptアーキテクト
- WebGLパフォーマンス最適化担当
- テスト・品質保証担当

このリポジトリに既に存在するヨーロピアンルーレットのホイールと球の演出を調査し、実際にコードを変更して、アプリ全体の看板となる最高品質の3D演出へ作り直してください。

これはレビュー、提案書、簡単なCSS修正だけを求めるタスクではありません。

最終的に必要なのは、次のすべてを満たした実装です。

- 実際にリポジトリへ反映されている
- TypeScriptが通る
- production buildが通る
- 既存テストが通る
- 強制出目が正しいポケットへ着地する
- 既存のベット・精算ロジックを壊していない
- standard / full / reduced motionがすべて完走する
- WebGL失敗時のfallbackが機能する
- 実画面で見た目と動きを確認している
- 画面確認後に必要な修正を反復している

単なる「それらしい3D」ではなく、安価なブラウザゲームに見えない、重厚でラグジュアリーなリアルタイム演出を目指してください。

---

# 1. 自律的に最後まで進めること

このタスクでは、調査、計画、実装、起動、画面確認、修正、テスト、ビルドまで自律的に進めてください。

計画を提示しただけで返答を終了してはいけません。計画後、そのまま実装へ進んでください。

細部についてユーザーへ逐一確認を求めないでください。既存コードから安全に判断できる事項は自律的に決定してください。

選択肢が複数ある場合は、以下の優先順位で最適なものを選び、判断理由を作業記録に残してください。

1. 視覚品質
2. 球の運動の説得力
3. 確定番号への決定的な着地
4. ゲームロジックの安全性
5. 演出とイベントキューの同期
6. パフォーマンス
7. 保守性
8. 実装コスト

ただし、リポジトリの現状を読まずに大規模変更へ着手してはいけません。

最初に必ずコード、テスト、git状態、依存関係、参考画像を調査してください。

---

# 2. Gitと既存変更の保護

作業開始時に、必ず以下を確認してください。

```bash
git status --short
git branch --show-current
git log -1 --oneline
```

守ること:

- ユーザーが作成した無関係な変更を削除しない
- 無関係な変更を上書きしない
- `git reset --hard`を使わない
- `git clean -fd`を使わない
- ユーザーのstashを操作しない
- 勝手にbranchを削除しない
- 勝手にpushしない
- 勝手にcommitしない
- 既存ファイルを削除する場合は、本当に不要かimport関係を確認する
- 自分が変更した範囲を最後に明確に報告する

無関係な変更が存在しても、このタスクと衝突しない限りそのまま保護して作業を続けてください。

---

# 3. 現在の技術構成

このアプリは主に以下で構成されています。

- Vite
- React 19
- TypeScript
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- CSS
- SVG fallback

現在の3Dホイール実装の中心:

- `src/components/roulette/RouletteWheel3D.tsx`
- `src/components/roulette/wheel3dAnimation.ts`
- `src/components/roulette/wheel3dGeometry.ts`
- `src/components/roulette/wheel3dMaterials.ts`

ホイール描画の入口:

- `src/components/roulette/RouletteWheel.tsx`

fallback:

- `src/components/roulette/RouletteWheelFallback.tsx`

演出イベント管理:

- `src/components/roulette/useRouletteAnimationQueue.ts`
- `src/components/roulette/motion.ts`
- `src/components/roulette/animationMode.ts`

ゲームロジック:

- `src/games/roulette/useRoulette.ts`
- `src/games/roulette/types.ts`
- `src/games/roulette/constants/wheel.ts`

画面と周辺UI:

- `src/components/roulette/RouletteGame.tsx`
- `src/components/roulette/RouletteControls.tsx`
- `src/components/roulette/RouletteTable.tsx`
- `src/components/roulette/ResultBanner.tsx`
- `src/components/roulette/HistoryStrip.tsx`
- `src/pages/games/RoulettePage.tsx`
- `src/index.css`

検証環境:

- `src/sandbox/roulette/RouletteSandbox.tsx`
- `src/components/roulette/useRouletteAnimationQueue.test.tsx`
- `src/games/roulette/useRoulette.test.tsx`

その他の関連ファイル:

- `src/components/roulette/wheelGeometry.ts`
- `src/components/roulette/rouletteSound.ts`
- `src/components/roulette/rouletteLabels.ts`
- `src/components/roulette/Racetrack.tsx`
- `src/components/roulette/tableLayout.ts`
- `src/games/roulette/logic/resolve.ts`
- `src/games/roulette/adapter.ts`
- `src/games/shared/economy.ts`
- `src/games/shared/useStoreEconomy.ts`
- `package.json`

参考画像:

- `docs/reference/roulette-target.jpg`
- `docs/specs/production/roulette/european-roulette.jpg`

上記は事前調査で確認された構成です。

ただし、実装時点のリポジトリを正としてください。ファイル、型、props、関数、依存関係を実際に読み、差異があれば現物へ合わせてください。

存在しないAPI、型、ファイル、state、props、アセットを推測で追加してはいけません。

---

# 4. 現在のスピン処理

事前調査では、概ね以下の流れです。

```text
ベット配置
→ RouletteGame.tsx
→ game.placeChip() / placeCallBet() / placeNeighbors()
→ bets / stagedTotal更新

SPIN
→ RouletteGame.tsxからgame.spin()
→ useRoulette.tsのspin()
→ economy.placeBet()
→ 当たり番号winningを決定
→ resolveSpin()
→ settlement確定
→ buildEvents()
→ AnimationEvent列を生成

演出
→ NO_MORE_BETS
→ SPIN_START
→ BALL_LAND
→ MARK_WINNER
→ COLLECT_LOSING
→ PAY_WINNING
→ RESULT_BANNER

表示
→ useRouletteAnimationQueue()
→ RouletteWheelへactiveEventType / landedNumber等を渡す
→ RouletteWheel3DがuseFrame()で描画を更新
→ BALL_LAND完了後にresultRevealed
→ 精算
→ 履歴更新
→ 結果バナー
```

実際のコードを確認し、現在の契約を正確に把握してください。

---

# 5. 絶対に壊してはいけないゲーム契約

当たり番号はホイールの物理演算によって決定してはいけません。

当たり番号は演出開始前にゲームロジック側で確定しています。

関連箇所:

- `src/games/roulette/useRoulette.ts`
- `spin()`
- `resultProvider`
- `resolveSpin()`
- `buildEvents()`

基本契約:

1. ゲームロジックが当たり番号を決定する
2. `resolveSpin()`が勝敗・payout・profitを決定する
3. `BALL_LAND`へ確定済み結果を渡す
4. 3D演出はその番号へ自然に着地させる
5. 視覚的な着地完了後に結果を公開する
6. 精算と履歴更新へ進む

ホイール演出側で禁止すること:

- 当たり番号の再抽選
- 当たり番号の変更
- payoutの再計算
- profitの再計算
- ベット額の変更
- settlementの改変
- 表示上だけ別番号へ着地すること

必ず維持するもの:

- `resultProvider`による強制出目
- `economy.placeBet()`
- `economy.settle()`
- `resolveSpin()`
- payout計算
- profit計算
- `AnimationEvent`の意味
- 1スピンにつき賭け金減算が1回
- 1スピンにつき精算が1回
- `BALL_LAND`完了前に結果を公開しない
- `resultRevealed`のゲート
- 履歴更新
- `flushPendingSettlement()`
- European rouletteの`WHEEL_ORDER`
- 0〜36の番号対応
- standard / full / reduced
- WebGL失敗時のSVG fallback
- 既存ページ・ルーティング
- TypeScriptの型安全性
- 既存の公開propsとイベント契約

公開契約を変更する必要がある場合は、上位コードを壊さない互換レイヤーを作ってください。

---

# 6. RouletteWheelの外部契約

事前調査では`RouletteWheel`へ概ね以下が渡されています。

- `activeEventType`
- `landedNumber`
- `resultRevealed`
- `dollyNumber`
- `mode`
- `spinMs`
- `landMs`
- `closeUp`
- `reducedMotion`

正確な型は実コードを確認してください。

3D内部の設計は大きく変更して構いませんが、上位コンポーネントから見た契約は可能な限り維持してください。

---

# 7. 最初に行う技術監査

実装前に、関連ファイルを読み、次を明確にしてください。

1. 現在のホイールが安く見える根本原因
2. 現在の球が不自然に見える原因
3. ホイールの立体構造上の不足
4. ポケット、frets、deflectors、trackの不足
5. マテリアルの不足
6. ライティングの不足
7. カメラの不足
8. 球の減速・半径・高さ・接触の不整合
9. 指定番号への着地補正が見破られる原因
10. geometry / material / animation / cameraの責務分離
11. React再レンダーと毎フレーム更新の関係
12. `setTimeout`ベースのキューと実アニメーションの同期問題
13. Strict Modeでの二重実行リスク
14. stale callbackのリスク
15. unmount時の精算安全性
16. WebGL context loss時の挙動
17. resize / mobile時の破綻
18. geometry / material / textureの破棄状況
19. 既存テストで不足している領域
20. 現在の構造を磨くべきか、内部再設計すべきか

監査後に採用設計を一つ決めてください。

複数案を並べただけで停止せず、実装へ進んでください。

---

# 8. 最高品質の定義

目標は、派手なエフェクトを大量に加えることではありません。

以下が同時に成立している状態を最高品質とします。

- 本物らしいEuropean roulette wheelの立体構造
- 高級感のある木材、金属、塗装、白球
- 球に質量、慣性、反発、摩擦、減衰が感じられる
- ホイールと球の相対運動が自然
- 指定番号へ確実に着地する
- 着地補正が磁石や吸着に見えない
- 球が落ちる最後の瞬間まで緊張感がある
- 球を見失わない上品なカメラワーク
- 結果が明確に視認できる
- standardでも安価に見えない
- fullは単なる低速版ではない
- reduced motionが安全に完走する
- 低FPSやタブ非表示でもロジックが壊れない
- パフォーマンス階層がある
- 長期的にパラメータ調整しやすい
- テスト可能である
- cleanupが正しい

---

# 9. ホイールの造形

ホイールを単なる同心円、平面円盤、薄い円柱の積層として扱わないでください。

本物のEuropean roulette wheelとして、少なくとも以下の構造に説得力を持たせてください。

- wooden body
- outer metal rim
- ball track
- ball groove
- bowl
- sloped apron
- deflectors / diamonds
- number ring
- number pockets
- pocket floors
- pocket walls
- frets / separators
- rotor
- spindle
- central cone
- turret
- handles / knobs
- 内側の段差
- ポケットの深さ
- 球が落下し、静止できる空間

実際の球の軌道とジオメトリの高さ・半径を一致させてください。

球が存在しない面の上を浮いて走ったり、ポケット壁を貫通したり、数字リングの表面へ貼り付いたりしてはいけません。

必要であれば、現在のprocedural geometryを再設計してください。

ただし、無意味にmesh数やdraw callを増やさないでください。

---

# 10. 数字とEuropean wheel order

`src/games/roulette/constants/wheel.ts`の`WHEEL_ORDER`を唯一の正しい番号順として扱ってください。

確認すること:

- 見た目の番号順とロジックの番号順が一致する
- 0を含む37ポケット
- 赤・黒・緑が正しい
- `angleOf()`と実ジオメトリが一致する
- ローター回転を考慮したworld angleとlocal angleが正しい
- 球の最終位置がポケット中心・深さと一致する
- 隣接番号が正しい
- SVG fallbackとも向きが一致する

数字は読みやすく、高級な実物のnumber ringとして見える必要があります。

数字テクスチャをCanvasで生成する場合は、解像度、アンチエイリアス、向き、色、メモリ解放を確認してください。

---

# 11. マテリアル

以下の素材を明確に区別してください。

- 高級木材
- polished metal
- brushed metal
- 赤い塗装面
- 黒い塗装面
- 緑の0ポケット
- 白い球
- 数字プレート
- ポケット内部
- frets
- spindle
- turret
- handles
- 溝とエッジ

すべてが同じroughness、同じ反射、同じプラスチック感になってはいけません。

必要に応じて以下を使用してください。

- physically based material
- metalness
- roughness
- clearcoat
- normal detail
- environment lighting
- subtle procedural wood detail
- contact shadows
- edge highlights
- restrained wear
- texture atlas
- anisotropy

ただし、外部アセットが必須でない場合は、保守可能なprocedural表現を優先して構いません。

外部アセットを追加する場合は、ライセンスと配置先を明確にしてください。

---

# 12. 球の運動

球を単純な円運動と一定のease-outだけで実装してはいけません。

球の状態は、少なくとも次の要素が相互に関係して見える必要があります。

- angular velocity
- radial position
- vertical position
- roll / spin
- contact state
- collision response
- damping
- rotor-relative velocity
- target-relative phase
- pocket settling

求める挙動:

- 高速時に慣性を感じる
- 減速が一様に見えない
- 外周trackから内側へ移る理由が見える
- deflector接触前後に因果関係がある
- 接触で角速度、半径、高さが変化する
- バウンドに質量と減衰がある
- fretをまたぐ際に瞬間移動しない
- 最終ポケット周辺で不自然に停止しない
- 確定番号へ必ず入る
- 補正が視覚的に発見されにくい
- 着地後に微細な揺れと完全静止がある
- 同じ番号でも毎回完全に同じ映像に見えない
- variationが結果を変えない

完全物理に限定しません。

必要に応じて、以下を組み合わせてください。

- deterministic pseudo physics
- fixed timestep
- state machine
- constrained trajectory
- spline segments
- ballistic segments
- damped spring
- collision-inspired impulse
- seeded random
- precomputed landing corridor
- progressive target constraint
- rotor-relative phase control
- contact event内に隠した微細補正

ゲームとしての決定性を最優先しつつ、ユーザーには自然な物理現象に見せてください。

---

# 13. variationと決定性

各スピンへ視覚的なvariationを導入して構いません。

候補:

- 初期球位相
- 初期速度
- 小さな速度揺らぎ
- deflector接触位置
- バウンド方向
- カメラの微差
- 最終ポケットへ至る隣接経路
- 着地後の微細運動

ただし、以下を守ってください。

- `landedNumber`が同じなら必ず同じポケットへ入る
- variationはseedで再現可能にする
- テスト時に固定seedを注入できる
- variationによりイベント時間が無制限に伸びない
- 補正が大きな瞬間移動にならない
- 乱数がゲーム結果を変更しない

---

# 14. カメラ

カメラの具体的な軌道は自由に設計してください。

達成条件:

- 球を見失わない
- ホイールの厚みと構造が分かる
- 球の速度変化が見える
- deflectorやfretとの接触が見える
- 最終着地が明確に確認できる
- 過度な旋回を避ける
- 急激なFOV変化を避ける
- 画面酔いを抑える
- UIや結果バナーと衝突しない
- mobileでも重要部分が見切れない
- resize後も破綻しない
- reduced motionでは大きく抑制する

カメラを派手に動かすこと自体を目的にしないでください。

fullモードでは映画的価値を持たせ、standardではテンポを維持してください。

---

# 15. ライティングとポストプロセス

必要に応じて以下を検討してください。

- key light
- fill light
- rim light
- environment map
- tone mapping
- exposure
- soft shadow
- contact shadow
- subtle reflection
- restrained bloom
- subtle vignette
- limited depth of field
- motion blur相当の表現
- landing時の短いcamera impulse

禁止:

- bloomで造形不足を隠す
- 過剰なネオン
- 常時camera shake
- 球が見えなくなるdepth of field
- 番号が読めなくなる暗さ
- 赤黒緑の識別を崩すcolor grading
- 効果が薄いのに高負荷なpostprocessing
- 過剰なchromatic aberration

素材、造形、陰影、接触影を中心に高級感を作ってください。

---

# 16. 演出モード

## standard

目的:

- プレイテンポを維持
- 短時間でも高品質
- 球の物理的説得力を失わない
- 単なるfullの倍速再生にしない
- 安価な簡易演出にしない

## full

目的:

- このアプリの看板となるロング演出
- 球の高速周回、減速、接触、着地を丁寧に見せる
- 最後まで緊張感を維持
- カメラ、間、音響イベントに独自構成を持たせる
- standardを遅くしただけにしない

## reduced motion

目的:

- 大きなズーム、回転、カメラ移動を抑制
- 結果を安全かつ明確に伝える
- ゲーム進行を通常どおり完走
- SVG fallbackとの責務を整理

具体的な秒数は固定しません。

実コードの`spinMs`、`landMs`、`motion.ts`、キューのdurationと整合させて最適化してください。

---

# 17. アニメーションキューとの同期

現在、演出イベントの完了は主に`useRouletteAnimationQueue.ts`の`setTimeout`で進み、3D描画はR3Fの`useFrame()`で進む構造です。

以下を重点的に確認してください。

- 実際の着地前に`BALL_LAND`がackされる
- 低FPS時に映像と結果表示がずれる
- タブ非表示中にタイマーだけ進む
- camera演出途中で結果へ進む
- standard / fullのdurationと内部アニメーションが一致しない
- 古いスピンのcallbackが次のスピンへ混入する
- Strict Modeで完了処理が二重発火する
- unmount時に精算が失われる
- callbackが失われて無限待機する
- timeout cleanup漏れ
- animation interruption時の不整合

改善が必要な場合は、外部契約を維持しながら以下を検討してください。

- 実アニメーションからの完了callback
- idempotent completion
- spin ID / generation ID
- cancellation token
- monotonic time
- fixed timestep
- state machine
- safety timeout
- visibility change対応
- stale callback防止
- unmount cleanup

重要:

- 3Dが壊れてもゲーム進行を永久停止させない
- safety timeoutを用意する
- 完了callbackは最大1回
- 精算は最大1回
- 結果公開は着地完了後
- fallbackでも同じ契約を守る

---

# 18. 音響イベント

`src/components/roulette/rouletteSound.ts`は現在silent stubである可能性があります。

実音源が存在しなくても、映像と同期できる安全な音響イベント構造を整備してください。

候補:

- wheel start
- wheel loop
- ball roll loop
- deflector hit
- fret hit
- pocket bounce
- final drop
- settle
- result accent

守ること:

- 架空の音源パスを必須参照してビルドを壊さない
- 音源なしでも映像は完成する
- 二重再生しない
- unmount時に停止する
- autoplay制限に対応できる
- mute / volumeへ拡張できる
- standard / fullでイベント密度を変えられる
- 物理イベントから音を発火できる
- 音響の未完成を理由に3D実装を止めない

---

# 19. パフォーマンス階層

最高品質を優先しますが、すべての端末へ同一設定を押し付けないでください。

必要に応じて以下の階層を設計してください。

- high quality WebGL
- standard WebGL
- lightweight WebGL
- SVG fallback
- reduced motion

検討項目:

- device pixel ratio
- antialias
- shadow resolution
- environment map resolution
- reflection quality
- postprocessing
- texture resolution
- geometry detail
- draw calls
- instancing
- merged geometry
- shader cost
- frameloop
- visibility change
- offscreen pause
- mobile GPU
- resize
- orientation change
- WebGL context loss
- first spin latency
- asset preload
- shader compilation

毎フレームReact stateを更新しないでください。

フレーム内のtransformは可能な限りrefとThree.jsオブジェクトを直接更新し、Reactの状態管理と描画ループを分離してください。

---

# 20. cleanup

以下を適切に破棄してください。

- geometry
- material
- texture
- canvas-generated texture
- render target
- environment map
- timer
- event listener
- visibility listener
- resize listener
- animation callback
- AudioNode
- AudioContext関連処理
- WebGLリソース
- subscriptions
- stale closures

連続スピン、ページ遷移、hot reload、Strict Modeでリークや多重実行を起こさないでください。

---

# 21. WebGL失敗とfallback

以下を維持・改善してください。

- WebGLが使えない場合のSVG fallback
- WebGL初期化失敗
- shader compile失敗
- context loss
- context restore
- 3D asset load失敗
- runtime exception
- reduced motion
- 低性能端末

3D演出が失敗しても、以下を失ってはいけません。

- ベット
- スピン
- 当たり番号
- 精算
- 履歴
- 結果表示

`RouletteWheel.tsx`を安全な境界として維持し、必要ならerror boundaryやfallback切替を改善してください。

---

# 22. 新規依存関係

現在のThree.js / R3F / Dreiで達成できるなら、無理に依存を増やさないでください。

新しい依存を追加する場合は、実装前に以下を評価してください。

- なぜ必要か
- 既存依存だけでは何が不足するか
- バンドルサイズ
- 実行負荷
- モバイルへの影響
- 保守性
- ライセンス
- fallbackへの影響
- tree shaking
- cleanup

巨大な物理エンジンを、球一個の演出だけのために安易に追加しないでください。

採用する場合は、品質上の明確な利益を示してください。

---

# 23. 3Dアセット

最高品質に必要なら、GLTF / GLB等の利用を検討して構いません。

ただし、次を守ってください。

- 存在しないアセットを必須参照しない
- アセットなしでもbuildを壊さない
- procedural fallbackを残す
- 外部URLへ実行時依存しない
- ライセンス不明素材を使わない
- 配置先を明記
- 読込失敗時のfallback
- preload
- compression方式
- 必要ならDraco / Meshoptの理由を説明

既存のprocedural geometryを高度化する方が保守性と品質を両立できるなら、その方針を選んでください。

---

# 24. 実画面での反復確認

コードを書いただけで完了と判断してはいけません。

可能な限り以下を実行してください。

1. 開発サーバーを起動
2. ルーレット画面またはsandboxを開く
3. standardを確認
4. fullを確認
5. reduced motionを確認
6. forced outcomeで0を確認
7. 赤・黒の複数番号を確認
8. 隣接番号を確認
9. 画面サイズを変更
10. 連続スピンを確認
11. スクリーンショットを取得またはブラウザ表示を視覚確認
12. 参考画像と比較
13. 見た目の問題を具体的に列挙
14. 修正
15. 再度確認

ブラウザ操作ツールやChrome連携が利用可能なら使用してください。

利用できない場合は、開発サーバーと既存の検証環境を使い、可能な範囲で確認してください。確認できなかった項目は最終報告で明示してください。

最低でも次を目視評価してください。

- ホイールが薄く見えないか
- ポケットに深さがあるか
- 数字が読めるか
- 木と金属が区別できるか
- 球が浮いていないか
- 球が白い点に見えないか
- 球がtrackやfretsを貫通していないか
- 着地が吸着に見えないか
- カメラが球を見失わないか
- bloomや光沢が過剰でないか
- fullがstandardの低速版になっていないか
- 最終番号が確認できるか

一度の実装で満足せず、明確な問題が残る場合は反復修正してください。

---

# 25. テスト要件

既存テストを壊さず、必要なら追加してください。

## 型・ビルド

- TypeScriptエラーなし
- production build成功
- import解決成功
- 未定義exportなし
- `any`で型エラーを隠さない
- lint scriptが存在する場合は実行

## ゲームロジック

- 1スピン1減算
- 1スピン1精算
- payout不変
- profit不変
- `resultProvider`が機能
- forced outcomeが機能
- `BALL_LAND`前に結果非表示
- 履歴更新が正しい
- unmount時のsettlement保護
- 完了callback最大1回

## ホイール

- `WHEEL_ORDER`が正しい
- 見た目とロジックの番号が一致
- 0へ正しく着地
- 赤の複数番号へ正しく着地
- 黒の複数番号へ正しく着地
- 隣接関係が正しい
- rotor回転中もworld positionが正しい
- 最終的にポケット内部へ静止
- seeded variationで結果不変

## 演出

- standard完走
- full完走
- reduced motion完走
- SVG fallback完走
- 結果公開タイミングが正しい
- animation safety timeoutが機能
- stale callbackを無視
- cancellationが安全

## 安定性

- 連続スピン
- 高速操作
- resize
- orientation change
- タブ非表示
- タブ復帰
- 低FPS相当
- ページ離脱
- Strict Mode
- WebGL context loss
- 3D初期化失敗
- asset失敗
- 音の多重再生なし
- timerリークなし
- listenerリークなし
- 無限待機なし

---

# 26. 実行コマンド

`package.json`を読み、実在するscriptを使用してください。

基本的には以下を確認しますが、存在しないscriptを勝手に実行して失敗扱いにしないでください。

```bash
npm install
npm run dev
npm run test
npm run build
npm run lint
```

既に依存が入っている場合、不要なinstallは避けて構いません。

テストがwatch modeへ入る場合は、CI用またはrun-onceのオプションを確認してください。

---

# 27. 実装の進め方

次の順序を基本としてください。ただし、実際の依存関係に合わせて調整して構いません。

## Phase 1: 調査

- git状態
- package.json
- 関連ファイル
- 現在の型
- 現在のホイール
- 現在のアニメーション
- 現在のテスト
- 参考画像
- 既存の画面

## Phase 2: 設計確定

- 保持する契約
- 再設計する内部構造
- animation state machine
- landing algorithm
- geometry
- material
- lighting
- camera
- quality tiers
- completion synchronization
- tests

## Phase 3: 中核実装

- 型・定数
- geometry
- materials
- animation engine
- camera rig
- wheel component
- integration
- fallback safety

## Phase 4: 同期と安全性

- queue integration
- completion callback
- safety timeout
- spin ID
- cancellation
- visibility
- unmount
- settlement safety

## Phase 5: 実画面確認

- forced outcome
- standard
- full
- reduced
- resize
- visual refinement

## Phase 6: テストとビルド

- tests
- typecheck
- build
- final diff review

一つのPhaseが終わるごとに、内部的に整合性を確認してから次へ進んでください。

---

# 28. 禁止事項

以下は禁止です。

- 一般論の説明だけで終了する
- 設計書だけ書いて終了する
- 擬似コードだけで終了する
- 主要処理をTODOで残す
- コードを`...`で省略する
- 見た目だけ変更してゲーム進行を壊す
- 3D側で当たり番号を再抽選する
- `WHEEL_ORDER`と見た目をずらす
- 結果番号へ露骨に吸着させる
- 球を単純な円運動だけで処理する
- 全体を一定のease-outだけで動かす
- bloomやglowで造形不足を隠す
- 過剰なネオン
- 過剰なcamera shake
- 球を見失うカメラ
- fallbackを削除する
- reduced motionを無視する
- 架空アセットを必須参照する
- 型エラーを`any`で隠す
- cleanupを省略する
- build不能な中途半端な状態で終了する
- 無関係なコードを大規模リファクタする
- storeや経済処理へ不要に介入する
- ユーザーの無関係な変更を上書きする
- テストを削除して成功扱いにする
- assertionを弱めて成功扱いにする
- エラーを握り潰して成功扱いにする
- 実行していないテストを「成功」と報告する

---

# 29. 完了条件

次をすべて満たすまで作業を完了扱いにしないでください。

- 関連コードの調査完了
- 採用設計の確定
- コードへの直接実装
- 3Dホイールの明確な品質向上
- 球の運動の明確な品質向上
- 指定番号への決定的な着地
- standard / full / reducedの成立
- fallbackの維持
- イベント同期の安全性
- 強制出目テスト
- TypeScript成功
- production build成功
- 既存テスト成功
- 実画面またはsandboxでの確認
- 変更差分の自己レビュー
- 無関係な変更を保護
- 残課題の正直な報告

ツールや環境の制約で確認できない項目がある場合は、その項目を具体的に示し、確認していないことを明記してください。

---

# 30. Codex独立監査への引き渡し準備

この実装の終了後、別のAIであるCodexが変更内容を独立監査します。

そのため、最終報告にはCodexが推測せず監査できるだけの情報を残してください。

必須情報:

- 作業開始時のbranchとHEAD
- 作業開始前から存在した無関係な変更
- 自分が変更・追加・削除したファイル
- 各変更の目的
- public props / types / eventsの変更有無
- animation queueと3D完了同期の変更内容
- forced outcomeを確認した番号
- 実行したテストと正確な結果
- production buildの結果
- 実画面で確認したモード
- 視覚確認できなかった項目
- performance上のトレードオフ
- cleanupとfallbackの実装状況
- 既知の問題
- Codexが特に再確認すべき箇所

最終報告の末尾に、次の形式の「Codex監査用要約」を必ず付けてください。

```md
## Codex監査用要約

### 監査対象
- ...

### 変更ファイル
- ...

### 特に疑って確認すべき箇所
- WHEEL_ORDERと見た目のポケット配置
- rotor local/world angle
- forced outcome
- BALL_LANDの完了時点
- resultRevealed gate
- 1スピン1減算・1精算
- stale callback / double completion
- unmount / visibility change
- geometry / material / texture disposal
- standard / full / reduced / fallback
- production buildと既存テスト

### 実行済み検証
- ...

### 未確認事項
- ...
```

Codex向けの要約を作るために、新しいドキュメントファイルをリポジトリへ勝手に追加する必要はありません。最終報告内へ記載してください。

---

# 31. 最終報告形式

作業完了後は、以下の形式で報告してください。

## 1. 結論

- 実装が完了したか
- production buildが通ったか
- testsが通ったか
- 実画面確認を行ったか

## 2. 採用した設計

- ホイールgeometry
- 球の運動
- landing control
- camera
- materials / lighting
- animation synchronization
- quality tiers

## 3. 変更ファイル

| ファイル | 変更内容 | 理由 |
|---|---|---|

## 4. ゲームロジック保護

- 当たり番号
- payout
- settlement
- reveal gate
- history
- unmount

について、何を確認したか記載してください。

## 5. 実行したコマンド

実際に実行したコマンドだけを記載してください。

## 6. テスト結果

| テスト | 結果 |
|---|---|

## 7. 視覚確認

- standard
- full
- reduced
- forced outcome
- resize
- 参考画像との比較
- 修正前後で改善した点

## 8. パフォーマンスとcleanup

- draw call
- DPR
- shadow
- resource disposal
- timers
- listeners
- visibility
- context loss

## 9. 残課題

未確認、未完成、将来改善できる点を正直に記載してください。

## 10. Git状態

```bash
git status --short
git diff --stat
```

の要約を記載し、自分が変更したファイルと既存の無関係な変更を区別してください。

---

# 32. 最終目標

ユーザーがSPINを押した瞬間から、球がポケット内で完全に静止し、結果が公開され、盤面へ戻るまでを、一つの完成された体験として成立させてください。

この実装で最も重視するのは次です。

- 本物らしい立体構造
- 高級な素材表現
- 球の物理的説得力
- 決定的で正確な着地
- 補正が見破られにくいこと
- 最後まで続く緊張感
- 上品なカメラ
- 演出とロジックの同期
- 安定した精算
- fallbackとreduced motion
- パフォーマンス階層
- cleanup
- テスト可能性
- 将来調整しやすい設計

現在の実装より明確に優れた完成形を、実際に動くコードとして実装してください。

まず、git状態、関連コード、テスト、参考画像、現在の画面を調査し、その後に設計を確定して実装へ進んでください。
