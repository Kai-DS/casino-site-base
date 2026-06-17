# Claude Code Prompt: Roulette Ball Motion Realism Implementation

送信先: Claude Code

目的: Codexが実装した速度モデルと仕様を前提に、Three.js/R3F側の見た目を確認し、必要な視覚表現だけを安全に仕上げる。

## 0. 必読

先に読むこと:

- `docs/roulette-ball-motion-realism-spec.md`
- `src/components/roulette/wheel3dAnimation.ts`
- `src/components/roulette/wheel3dAnimation.test.ts`

Codexが決定した速度値・角度契約・同期契約は勝手に変更しないこと。

## 1. 対象ファイル

主対象:

- `src/components/roulette/RouletteWheel3D.tsx`
- `src/components/roulette/wheel3dAnimation.ts`
- `src/components/roulette/wheel3dGeometry.ts`
- `src/components/roulette/wheel3dMaterials.ts`
- `src/components/roulette/wheel3dAnimation.test.ts`

原則として、速度モデルは `wheel3dAnimation.ts` の `WHEEL_MOTION_PROFILES` と `WheelAnimator` がsingle source。

## 2. 変更してはいけない契約

- `animationEvents` の契約
- `BALL_LAND` 完了までsettlementを表示しない契約
- `onLandingComplete(eventId)` は視覚収束後に呼ぶ契約
- forced result: 0, 5, 10, 17, 26
- European roulette order
- standard/full/reduced modes
- fallback SVGの進行
- 基本カメラをstandard/fullで共通にする仕様
- `WHEEL_MOTION_PROFILES` の速度値
- `relativeDeg mod 360 == angleOf(result.number)` の終端条件
- `relativeVelocityDegPerSec == 0` の終端条件
- `ballVelocityDegPerSec == 0` / `rotorVelocityDegPerSec == 0` の終端条件

## 3. 使用するモーションモデル

Codex実装済み:

```text
ballDeg = rotorDeg + relativeDeg
relativeVelocity = ballVelocity - rotorVelocity
```

BALL_LAND捕獲時:

```text
relativeDeg mod 360 = angleOf(result.number)
relativeVelocity = 0
ballVelocity = rotorVelocity
```

球はポケットに収まった後、短時間だけrotorと一緒に運ばれ、その後ball+rotorを同じカーブで共同減速してworld座標上でも完全停止する。BALL_LAND終端では `relativeVelocity = 0` / `ballVelocity = 0` / `rotorVelocity = 0`。

## 4. Committed Values

standard fallback/base:

```ts
spin: { rotorTurns: 0.94, ballTurns: -1.78, rotorEndRps: 0.43, ballEndRps: -0.58 }
land: { desiredRelativeTurns: 1.0, rotorTurns: 1.55, syncRps: 0.22, syncHoldMs: 190, finalBrakeMs: 520 }
```

full:

```ts
spin: { rotorTurns: 3.0, ballTurns: -3.7, rotorEndRps: 0.75, ballEndRps: -0.65 }
land: { desiredRelativeTurns: 3.2, rotorTurns: 4.0, syncRps: 0.28, syncHoldMs: 300, finalBrakeMs: 700 }
```

Do not tune result/angle/final-stop contracts casually. Current live motion uses
`ROULETTE_MOTION_VARIANTS`; `WHEEL_MOTION_PROFILES` remains as fallback/base context.

## 5. Standard / Full Difference

standard:

- total spin+land: 4.4s
- SPIN_START: 1.8s
- BALL_LAND: 2.6s
- peak relative speed: about 123-133rpm depending on variant
- land start relative speed: about 58-61rpm depending on variant
- pocket-band angular hops: 3.6 / 1.45 / 0.75 / 0.18 pockets
- sync hold: variant-specific, around 0.18-0.20s
- final brake: variant-specific, 0.50-0.54s
- final stop: 0rps

full:

- total spin+land: 8.0s
- peak relative speed: about 183rpm
- land start relative speed: 84rpm
- pocket-band angular hops: 3.6 / 1.45 / 0.75 / 0.18 pockets
- sync hold: variant-specific, 0.28-0.33s
- final brake: variant-specific, 0.65-0.71s
- final stop: 0rps

After the standard slowdown, standard is the lower-speed short-distance mode. Full remains the longer
8.0s cinematic path and is not merely a stretched standard.

## 5.1 Motion Variants

Standard variants:

- `standard_direct`: short stable orbit, clear drop, normal deflector hit
- `standard_high_hop`: earlier exit, stronger first hop, rapid later settle
- `standard_shallow_hit`: longer hang, lower contact, stronger radial knock than vertical hop

Full variants:

- `full_long_track`: long trackable orbit
- `full_suspense_hang`: longer instability/hang with wheel flowing under the ball
- `full_high_deflector`: clearer high deflector hit
- `full_low_fast_settle`: low sharp hit and crisp settle

Variant is selected once in `WheelAnimator.startSpin()` via a deterministic shuffle bag. For standard,
each 3-spin bag contains direct/high_hop/shallow_hit exactly once, the order is seeded, and the bag
boundary avoids repeating the previous bag's last variant. It must not be reselected in render or
`sample()`. Debug fixed QA can use `WheelAnimator.setMotionVariantOverride(id)` or `?rouletteVariant=<id>`
in the browser. Browser debug motion is resolved in this order:

```text
explicit ?rouletteMode=
→ mode inferred from ?rouletteVariant=
→ UI-selected mode
→ default mode
```

So `?rouletteVariant=full_long_track` alone must run full-mode motion. If explicit mode and variant mode
disagree, fall back to that mode's default (`standard_direct` / `full_long_track`). Query absence must keep
normal UI mode and deterministic shuffle-bag selection.

`?rouletteDebugMotion=1` shows the selected variant/phase/pocket stage/spin sequence/bag slot and adds
matching root attributes: `data-motion-mode`, `data-motion-variant`, `data-motion-phase`,
`data-pocket-stage`, `data-motion-stage`, `data-spin-sequence`, `data-motion-bag-index`, and
`data-motion-bag-slot`. These debug labels are written imperatively from sampled frame state because short
hop stages can be skipped by React state batching even when `sample()` itself visits all stages.

Variant may alter only predefined-safe values: trackable/hang/drop/deflector timing, hop height, radial
knock, roll sign/amplitude, rattle scale, and small final-brake differences. It must not alter result,
European wheel order, `angleOf`, final pocket, `relativeDeg mod 360`, ACK/reveal gate, winner frame,
camera, geometry, materials, or full-stop immutability.

## 6. Visual Phase Intent

R3F側で視覚確認するフェーズ:

- LAUNCH: 急に最高速へ飛ばない
- HIGH_SPEED_ORBIT: 外周を高速に回るが旧実装ほど速くない
- TRACKABLE_ORBIT: fullでは球を追える時間を長く見せる
- LOSS_OF_STABILITY: 外周離脱前に一度かなり遅く感じる
- INWARD_DROP: 半径/高さを滑らかに変え、直線吸着に見せない
- DEFLECTOR_IMPACT: 角速度を増やさず、半径/高さ/方向変化で激しく見せる
- POCKET_TRAVERSE: ポケット帯進入後の角度移動も 3.6 → 1.45 → 0.75 → 0.18 pockets へ急速に縮小する
- POCKET_BOUNCE: 2-4回程度の見かけ上のバウンド。高さ/半径/rollの振幅も角度ステージと同期して急速に減衰
- POCKET_SETTLE: ポケット内の小揺れ。ゴム球のように長く跳ねない
- ROTOR_SYNC: 球がrotorと同速で短時間運ばれる
- FINAL_BRAKE: 球とrotorが同じ角速度のまま共同減速する
- FULL_STOP: 球とrotorがworld座標上でも完全停止する

## 7. 半径と高さ

現在Codex側で `landRadius(p)` / `landHeight(p)` を用意済み。

Claude側で変更する場合:

- 終端値 `R.ballRestR`, `R.ballRestY` は維持
- p=1でラトルが完全に0になること
- radius/heightの揺れで角度の逆戻りを隠さないこと
- 角度ノイズは入れないこと
- seed差は見た目のラトルに限定すること

## 8. ディフレクター衝突の表現

実装してよい視覚表現:

- ballRの小さな内外揺れ
- ballYの短いhop
- material highlightやshadow変化
- 将来の音イベント用hook追加

禁止:

- result numberの変更
- angleOfの変更
- relativeDegへランダム角度揺れを入れる
- BALL_LAND開始直後の再加速
- カメラ変更で速度をごまかすこと

## 9. ポケットバウンド

表現方針:

- 最初のbounceだけ大きめ
- 次は半分以下
- 最後はポケット内部のみ
- p=1では完全に静止、かつrelativeVelocity=0

角度方向の大きな往復は入れない。`relativeDeg` 本体は `DEFLECTOR_EXIT → POCKET_HOP_1 → POCKET_HOP_2 → POCKET_HOP_3 → POCKET_SETTLE`
でC1連続に進み、ポケット帯では 3.6 / 1.45 / 0.75 / 0.18 pockets の固定予算で結果中心へ収束する。

## 10. BALL_LAND ACK

現在の契約:

- `WheelAnimator.sample()` が `landed=true` を返すのはFULL_STOP成立後のみ
- R3F側で最終transformを適用
- 次paint後に `onLandingComplete(eventId)` を呼ぶ

これを維持すること。

force finalize時:

- `forceFinalize()` がp=1状態へsnap
- radius/heightも最終値
- 次paint後にACK

## 11. Camera

カメラを変更しない。

- standard/fullは同じ基本カメラ
- closeUpやmodeでカメラ差を復活させない
- 速度差はmotion modelで表現する

## 12. Visual QA

確認すること:

- standardで速すぎない
- standardがfullの早送り版に見えない
- fullで球を追える時間が増えた
- debug固定でstandard 3種 / full 4種の差が分かる
- BALL_LAND開始時に速度が跳ねない
- 着地前に吸着して見えない
- 球がrotorと同期した後、共同減速してworld停止する
- result revealが着地前に出ない
- forced 0/5/10/17/26 が正しく入る
- hidden tab / low FPSで破綻しない
- reduced motionでイベント進行が止まらない

## 13. Tests To Run

必須:

```bash
npm run typecheck
npm run test
npm run build
```

特に見るテスト:

```bash
npm run test -- src/components/roulette/wheel3dAnimation.test.ts
npm run test -- src/components/roulette/useRouletteAnimationQueue.test.tsx
npm run test -- src/components/roulette/wheel3dGeometry.test.ts
npm run test -- src/components/roulette/wheel3dResources.test.tsx
npm run test -- src/components/roulette/RouletteWheelFallback.test.tsx
```

## 14. Completion Report Format

報告には以下を含めること。

1. 変更ファイル
2. `WHEEL_MOTION_PROFILES` を変更していないか
3. standard/fullの視覚確認結果
4. forced 0/5/10/17/26確認結果
5. BALL_LAND ACK確認結果
6. hidden tab / low FPSに関する確認
7. 実行したテストと結果
8. 残リスク

## 15. Do Not

- Codexが決めた速度値を好みで変更しない
- 旧 `easeOutQuint` の角度lerpへ戻さない
- ballだけをworld座標で先に停止させない
- 結果ポケットへ直接lerpしない
- 角度ノイズで衝突を表現しない
- カメラ変更でfullを演出し直さない
- テストを削除して通さない

## 16. Endgame Choreography（実装必須）

接地影の追加だけでは完了としない。`docs/roulette-ball-motion-realism-spec.md` §17/§18 を実装必須仕様として
満たすこと。要約：

```text
高速周回 → trackableへ減速 → 外周離脱直前のhang（球が留まり、下を番号リングが流れる）
→ 内側へ落下 → ディフレクター衝突（角速度は再加速しない／半径・高さ・影・姿勢で激しく見せる）
→ 複数ポケットをまたぐ → 角度方向も跳ね幅が 3〜4 / 1〜2 / 隣接 / ポケット内 の順に急速収束
→ ポケット内で小揺れ → rotorと同期 → 共同減速 → full stop
→ 着地完了+ACK後にのみ 当選ポケット枠を発光
```

実装契約：

- 角速度・角度・Hermite・結果収束・終端・BALL_LAND判定は不変。Variantは安全範囲のタイミング/半径/高さ/rollだけ。
- 「激しさ」は `ballR`/`ballY`/接地影/球roll・姿勢の短時間変化で出す（角速度の再加速は禁止）。
- 段階バウンドは決定的ゲイン列 `BOUNCE_STAGE_GAINS`（中心 `BOUNCE_STAGE_CENTERS`）で表現し、
  `g2≤0.5·g1, g3≤0.25·g1, g4≤0.1·g1`、p=1で全ラトル0。均等減衰・ゴム球反復は禁止。
- 多ポケット通過は `DEFLECTOR_EXIT` までで消化し、ポケット帯では `relativeDeg` 本体を固定予算で段階収束させる。
  表示専用 `visualAngularOffset` で隠す対応は不要。
- 当選強調は丸マーカー廃止 → **当選ポケット枠の発光**（数字に重ねない）＋任意の弱いソフトライト。
  表示は `resultRevealed`（=ACK後）ゲートより前に出さない。full stop後に当選ポケット上で静止。
- standard は 4.4s、full は 8.0s。fullの長さを衝突後バウンドへ押し込まない。standardはfullの一律倍率版にしない。

## 17. Completion Report（追加）

§14 に加えて以下も報告：終盤フェーズ別の表現方法、段階収束(3-4/1-2/隣接/ポケット内)の実現、rotor同期とfinal brake、
full stop後の不変性、丸→枠への変更、当選強調の開始タイミング、full延長の有無と前後値、未確認項目。
