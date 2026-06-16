# Claude Code / Roulette Wheel Focused Fix Prompt

## 実行前設定

Claude Code をこのリポジトリのルートで開き、必要なら次を設定してください。

```text
/model opus
/effort max
```

そのうえで、このファイルの内容を作業指示として扱ってください。

---

# 実装指示

送信先: Claude Code
想定モデル: 利用可能な最新の Claude Opus
目的: 既存のルーレット3Dホイールについて、**仕切り（frets / separators）の造形修正**と、**球が一度通過したポケットへ逆戻りする不自然な挙動の解消**を、現在の高品質な3D演出を維持したまま実装する。

これは設計メモではなく、**実際のコード修正**を求める指示です。調査、設計、実装、テスト、build、可能な実画面確認まで行ってください。

---

# 1. 最優先の修正対象

今回の修正対象は大きく2つです。

1. **ルーレットホイール自体の仕切り形状の修正**
2. **球が過ぎた場所へ戻ってまた過ぎる不自然な着地挙動の修正**

現在の3D品質や、これまで直してきた同期・lifecycle・安全性は維持したまま、この2点を改善してください。

---

# 2. 仕切り（frets / separators）の造形修正

## 現状の問題

現在のホイールは、数字と数字の間の仕切りが以下のように見えます。

- 高すぎる
- 長すぎる
- 外周の数字エリア近くまで伸びすぎている
- 各数字ポケットが壁で強く区切られすぎている
- 重く、ゴツく、安っぽく見える

特に、**中心から外周へ向かって長い高い仕切りが各数字の近くまで届いている**のが問題です。

## 目標イメージ

欲しい造形は次です。

- 仕切りは**中央寄りだけに存在**する
- 仕切りは**短い放射状フィン**として見える
- 外周の数字帯・数字プレート付近には、仕切りの主張を出しすぎない
- 数字の近くには「高い縦壁で完全に区切られている印象」を持たせない
- 全体として、**中心側には放射状の構造があるが、外周の数字エリアはもっと開放的で滑らか**に見える

## 必須要件

- 仕切りは外周の数字エリア近くまで伸ばさない
- 仕切りの高さを今より下げるか、少なくとも視覚的主張を弱める
- 必要なら、仕切りは中央側で高く、外周へ向かうにつれて低くなる形状にしてよい
- 必要なら、中央側だけに存在し、途中で自然に終わる形状にしてよい
- 「各数字ポケットが深い壁で完全に区切られている」印象を弱める
- ただし、ホイールの高級感、素材感、全体の構造感は損なわない

## 実装の方向性

以下を調査し、最も自然な修正方法を採用してください。

- `wheel3dGeometry.ts`
- `RouletteWheel3D.tsx`
- frets / separators の長さ・高さ・位置・断面形状
- numbers / pocket floor / rotor の相対配置

実装候補:

- frets の半径方向の長さを短くする
- frets を中央側だけに配置する
- frets の高さを抑える
- frets を外周側で細く / 低く / 消失させる
- pocket wall と fret の責務を分離する

## 禁止事項

- 単に scale を雑に縮めて、球の着地や見た目を壊すこと
- 数字やポケット位置関係を崩すこと
- WHEEL_ORDER と見た目の整合を壊すこと
- 中央構造まで安っぽくすること

---

# 3. 球の逆戻り挙動の修正

## 現状の問題

現在、当たり番号を先に決めている関係で、球が着地直前に不自然な補正を受け、次のような挙動になることがあります。

1. 球が目標ポケット付近を一度通過する
2. その後、目標角度へ合わせるために戻される
3. 再び同じポケット付近を通過する
4. 最終的に着地する

つまり、**一度過ぎたボールが戻ってきて、また過ぎる**感じの不自然な動きです。

## 原則

当たり番号を先に決める方式自体は維持して構いません。

ただし、以下は絶対に守ってください。

- 球の主たる周回方向を途中で反転させない
- 一度通過した番号へ大きく引き戻さない
- shortest path 的な補間で逆戻りさせない
- 最終番号へ磁石のように吸着させない
- 角度補正による瞬間移動や往復を起こさない

## 目標

球は、着地まで**一方向に連続して進み続ける**べきです。

許容する動き:

- 半径方向の変化
- 上下バウンド
- deflector / fret 接触による微細な揺れ
- capture 後のポケット内微小振動

禁止する動き:

- ホイール上で見て分かる逆戻り
- 同じ番号付近の前後往復
- 通過後の大きな引き戻し
- 最終番号への露骨な目標補正

---

# 4. 修正方針（第一案）

## 採用方針

**第一案として、現在の「結果先決め」方式を維持したまま、球の軌道設計を修正してください。**

ここでは、ライブ物理で当たり番号を決める方式へは変えません。

## 必須方針

### 4.1 unwrapped angle を使う

球の角度を毎フレーム 0〜360° や 0〜2π に正規化せず、**連続角度**として扱ってください。

例:

```text
30°
390°
750°
1110°
```

またはラジアンで同等の値。

以下を明確に分けてください。

- `ballAngleUnwrapped`
- `rotorAngleUnwrapped`
- `ballWorldAngle`
- `ballRotorRelativeAngle`
- `targetPocketLocalAngle`
- `targetPocketWorldAngle`
- `travelDirection`

正規化は表示やポケット判定など必要箇所だけで使ってください。

### 4.2 target angle を途中で逆方向へ取り直さない

着地フェーズ開始時点で、現在角度・進行方向・最終ポケットから、**進行方向の先にある連続目標角度**を一度決めてください。

- 追加周回数もこの時点で決める
- shortest path に切り替えない
- 終盤に target を反対側へ再設定しない
- target を通過後に引き戻さない

### 4.3 角速度の符号を維持する

球の主角速度の符号を、着地完了まで維持してください。

```ts
Math.sign(ballAngularVelocity) === travelDirection
```

減速で 0 に近づくのは許容しますが、逆符号へ反転してはいけません。

### 4.4 capture 後は角度補正を止める

球が最終ポケットの capture zone に入った後は、main angle の大きな補正を止めてください。

capture 後は以下だけで表現してください。

- 半径方向の小さな動き
- 上下の減衰振動
- ポケット内の微細な接線方向揺れ
- fret / wall への局所反発
- 完全静止への減衰

capture 後に隣の番号へ戻ることは禁止です。

### 4.5 scatter / rattle を見直す

scatter、radial、hop が角度方向へ強く効きすぎて、球が往復している可能性を調査してください。

推奨:

- 主角度は常に単調
- rattle は小さい局所変位として扱う
- 一度越えた fret を大きく逆戻りしない
- capture 後は揺れを急速に減衰

---

# 5. 第二案（どうしても第一案で自然にできない場合のみ）

第一案で十分自然にならない場合に限り、**決定論的な事前物理シミュレーション**を設計候補として検討してください。

ただし、勝手に全面移行してはいけません。まずは第一案で解決を試みてください。

## 第二案の考え方

```text
SPIN
→ economy.placeBet
→ fixed timestep の seeded simulation を画面外で実行
→ 落ちたポケットを winning とする
→ resolveSpin
→ 同じ軌道を3Dで再生
→ 着地後に result reveal / settle
```

## 必須条件

- live FPS で結果を決めない
- fixed timestep
- seeded random
- 同じ入力なら同じ結果
- resultProvider / forced outcome に対応
- payout / profit / 1スピン1精算 を維持

**ライブ描画のその場物理だけで結果を決める方式は禁止**です。

---

# 6. 既存品質・既存安全性は維持する

以下は壊してはいけません。

- 現在の高級感ある3Dホイール造形
- 木・金属・球のマテリアル
- ライティング
- カメラ
- BALL_LAND handshake
- hidden / visible 制御
- force-finalize / safety / escape の安全設計
- fallback
- resource ownership
- unmount safety
- deterministic landing
- WHEEL_ORDER
- resultProvider
- payout / profit
- 1スピン1減算
- 1スピン1精算
- history
- unmount settlement
- standard / full / reduced
- type safety
- lazy chunk 分割

また、以下の既存ロジックは原則無改変か、少なくとも意味を変えないでください。

- `src/games/**`
- `resolveSpin()`
- `economy.placeBet()`
- `economy.settle()`
- `WHEEL_ORDER`

---

# 7. 調査対象

最低限、以下を確認してください。

- `src/components/roulette/RouletteWheel3D.tsx`
- `src/components/roulette/wheel3dGeometry.ts`
- `src/components/roulette/wheel3dMaterials.ts`
- `src/components/roulette/wheel3dAnimation.ts`
- `src/components/roulette/RouletteWheelFallback.tsx`
- `src/components/roulette/useRouletteAnimationQueue.ts`
- `src/components/roulette/useRouletteAnimationQueue.test.tsx`
- `src/components/roulette/wheel3dAnimation.test.ts`
- `src/components/roulette/wheel3dResources.test.tsx`
- `src/components/roulette/RouletteWheelFallback.test.tsx`
- `src/games/roulette/constants/wheel.ts`

---

# 8. テスト要件

## 8.1 仕切り造形

見た目の変更だけでなく、少なくとも以下を確認してください。

- frets が中央寄りのみになっている、または外周では主張が弱い
- 数字エリア近くまで長い壁が伸びていない
- 数字・ポケット・fret の位置整合が崩れていない
- ball の着地位置とポケット構造が矛盾しない

## 8.2 球の単調移動

全37番号、全モード、複数duration、複数seedで可能な限り確認してください。

- unwrapped angle が進行方向へ単調
- 主角速度の符号が反転しない
- target 通過後に大きく戻らない
- capture 後に隣接ポケットを越えない
- 最終番号へ正しく着地する
- NaN / Infinity なし
- 位置の瞬間移動なし
- 大きな不連続なし

## 8.3 既存保証

- typecheck 成功
- 全既存テスト成功
- build 成功
- reveal / handshake / safety / escape 契約維持
- unmount 後 report 無効
- hidden 中 reveal しない
- fallback 契約維持

必要に応じてテストを追加してください。

---

# 9. 実行コマンド

`package.json` を確認し、実在する script を使ってください。

最低限:

```bash
npm run typecheck
npm run test
npm run build
```

可能なら実画面でも確認してください。

- standard
- full
- reduced
- forced 0 / 5 / 10 / 17 / 26 / 32 / 36
- front / side / far 側番号
- 連続スピン
- 複数seed
- console例外なし
- 「通過後に戻る」挙動が解消している
- 仕切りが中央寄りだけになり、外周数字エリアが開放的に見える

---

# 10. 禁止事項

- 設計提案だけで止まること
- 擬似コードだけで終わること
- 3D造形全体を不必要に作り直すこと
- 結果ロジックを安易にライブ物理へ変更すること
- shortest-path補間で球を逆戻りさせること
- 仕切りを単に消して構造破綻させること
- 数字配置や WHEEL_ORDER を壊すこと
- テストを削除・弱体化すること
- `git reset --hard`
- `git clean -fd`
- 勝手な commit / push

---

# 11. 完了条件

以下をすべて満たしたら完了です。

- 仕切りの造形が中央寄りの短い放射フィンに近い見た目になっている
- 数字付近の長い高い仕切りが解消している
- 球が一度通過したポケットへ大きく逆戻りしない
- 主角度が一方向に進み続ける
- deterministic landing は維持
- WHEEL_ORDER は維持
- typecheck 成功
- 全テスト成功
- build 成功
- 可能な実画面確認を実施
- 変更差分を自己レビュー

---

# 12. 最終報告

以下を報告してください。

1. 仕切り造形の問題点
2. 仕切り造形をどう直したか
3. fret の長さ・高さ・配置の新方針
4. 球の逆戻りの根本原因
5. 修正前の角度設計
6. 修正後の角度設計
7. unwrapped angle の管理方法
8. 主角速度の符号を維持する方法
9. target angle の決め方
10. capture 後の処理
11. scatter / rattle の修正
12. 第一案で解決したか
13. 第二案が必要かどうか
14. 追加・更新したテスト
15. 変更ファイル一覧
16. 実行したコマンド
17. typecheck / test / build の正確な結果
18. 実画面確認結果
19. 残課題
20. `git status --short`
21. 次にCodexが監査すべき箇所

今から、既存コードを調査し、そのまま修正、テスト、build、可能な実画面確認まで進めてください。
