# Roulette Ball Motion Realism Spec

## 1. 調査済みの現在値

旧3Dモデルは `src/components/roulette/wheel3dAnimation.ts` で次の回転数を使っていた。

| mode | spinMs | landMs | rotor spin turns | ball spin turns | spin relative speed | land start relative speed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| standard | 1600ms | 2200ms | 6 | 9 | 562.5rpm | 873-1005rpm |
| full | 3000ms | 5000ms | 11 | 14 | 500rpm | 600-658rpm |

問題は、fullでも相対速度がstandardの約89%あり、BALL_LAND開始時にはさらに相対速度が跳ね上がることだった。

## 2. 現在の問題原因

- world角度を `lerp(startAngle, targetAngle, easeOutQuint(t))` に近い形で直接補間していた。
- `easeOutQuint` は開始時微分が大きく、BALL_LAND開始直後の速度が増えた。
- ballとrotorの相対角速度ではなく、world角度の最終位置だけを主に合わせていた。
- 最終状態が `ballAngularVelocity -> 0` に近く、ポケットに入った球がrotorに運ばれる状態ではなかった。
- テストは最終角度と単調性中心で、速度上限、速度連続性、FPS非依存性を見ていなかった。

## 3. 新しいモーションモデル

角度を次の2つへ分離する。

```text
rotorDeg = rotor world angle
relativeDeg = ball angle in rotor-local coordinates
ballDeg = rotorDeg + relativeDeg
relativeAngularVelocity = ballAngularVelocity - rotorAngularVelocity
```

BALL_LANDの捕獲状態は次の通り。

```text
relativeDeg mod 360 == angleOf(result.number)
relativeAngularVelocity == 0
ballAngularVelocity == rotorAngularVelocity
```

これにより、球はポケット内でrotorローカル座標へ固定される。その後、短時間だけrotorと同速で運ばれ、最後に球とrotorを同一カーブで共同減速してworld座標上でも完全停止する。BALL_LANDの最終状態は次の通り。

```text
relativeDeg mod 360 == angleOf(result.number)
relativeAngularVelocity == 0
ballAngularVelocity == 0
rotorAngularVelocity == 0
```

## 4. Signed Angular Velocity

符号は既存Three.js座標系に合わせる。

- `rotorAngularVelocity > 0`
- `ballAngularVelocity < 0` during orbit
- `relativeAngularVelocity < 0` while the ball crosses pockets
- after capture: `relativeAngularVelocity = 0`
- after capture: `ballAngularVelocity = rotorAngularVelocity`

## 5. Relative Angular Velocity

相対速度を主契約にする。

- SPIN_START中はballとrotorが逆方向へ動くため、相対速度の絶対値は大きい。
- BALL_LAND開始時はSPIN_START終端と同じ相対速度にする。
- BALL_LAND中は相対速度の絶対値を増やさない。
- POCKET_SETTLE終端で相対速度を0へ落とす。

## 6. 使用する補間式

角度は cubic Hermite curve を使う。

```text
x(p) =
  (2p^3 - 3p^2 + 1) x0
  + (p^3 - 2p^2 + p) T v0
  + (-2p^3 + 3p^2) x1
  + (p^3 - p^2) T v1
```

`x0`, `x1`, `v0`, `v1` を明示するため、位置だけでなく速度もC1連続にできる。

半径と高さは `smootherstep` を使う。角度の微小ランダム揺れは入れない。衝突/ラトルは半径と高さのdecay振動だけで表現する。

## 7. Standard Values

Nominal event duration:

- SPIN_START: 1.8s
- BALL_LAND: 2.6s
- total wheel/ball motion before reveal: 4.4s

Standard is no longer a compressed copy of full. The base `WHEEL_MOTION_PROFILES.standard` remains as a
fallback, while real standard spins choose one of the predefined `ROULETTE_MOTION_VARIANTS` at spin start.

```ts
standard_direct
standard_high_hop
standard_shallow_hit
```

Measured nominal metrics, sampled from `WheelAnimator` at 1ms intervals for result 17:

| variant | peak ball | peak rotor | peak relative | land-start relative | pre-pocket ball turns | pre-pocket relative turns | full ball turns | full relative turns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| standard_direct | 489.020deg/s / 1.358rps / 81.503rpm | 502.714deg/s / 1.396rps / 83.786rpm | 740.308deg/s / 2.056rps / 123.385rpm | 363.600deg/s / 1.010rps / 60.600rpm | 2.234 turns / 82.641 pockets | 3.622 turns / 134.020 pockets | 2.957 turns / 109.391 pockets | 3.784 turns / 140.000 pockets |
| standard_high_hop | 440.458deg/s / 1.223rps / 73.410rpm | 358.759deg/s / 0.997rps / 59.793rpm | 798.762deg/s / 2.219rps / 133.127rpm | 345.600deg/s / 0.960rps / 57.600rpm | 1.908 turns / 70.580 pockets | 3.622 turns / 134.020 pockets | 2.106 turns / 77.934 pockets | 3.784 turns / 140.000 pockets |
| standard_shallow_hit | 492.569deg/s / 1.368rps / 82.095rpm | 504.915deg/s / 1.403rps / 84.152rpm | 753.059deg/s / 2.092rps / 125.510rpm | 356.400deg/s / 0.990rps / 59.400rpm | 2.213 turns / 81.890 pockets | 3.622 turns / 134.020 pockets | 2.976 turns / 110.130 pockets | 3.784 turns / 140.000 pockets |

Compared with the previous 4.4s standard implementation, the tracked standard metrics are held to roughly
45-55% for peak ball speed, peak relative speed, land-start relative speed, pre-pocket ball travel, and
pre-pocket relative travel. Rotor peak is held to roughly 50-60% per variant. The total duration remains
4.4s, so the standard mode is shorter because it travels less distance at lower speed, not because full
motion was compressed.

Pocket-band angular hops remain fixed:

```text
HOP1:  3.6 pockets
HOP2:  1.45 pockets
HOP3:  0.75 pockets
SETTLE: 0.18 pockets
```

After pocket capture, `syncHoldMs` and `finalBrakeMs` are variant-specific. Full stop still requires
`ballVelocity = rotorVelocity = relativeVelocity = 0`, and samples after full stop remain fixed.

## 8. Full Values

Nominal event duration:

- SPIN_START: 3.0s
- BALL_LAND: 5.0s
- total wheel/ball motion before reveal: 8.0s

Full keeps the 8.0s total, but also uses variants so the long mode is not merely a stretched standard.
The base `WHEEL_MOTION_PROFILES.full` remains as fallback.

```ts
full_long_track
full_suspense_hang
full_high_deflector
full_low_fast_settle
```

Measured nominal metrics:

- max spin relative speed: 3.053rps / 183.196rpm
- SPIN_START end relative speed: -1.4rps / 84rpm
- BALL_LAND max relative speed: 1.4rps / 84rpm
- BALL_LAND representative relative travel for result 17: 3.084 turns
- pocket-band angular hops: 3.6 → 1.45 → 0.75 → 0.18 pockets
- sync hold: ball=rotor=0.28rps, relative=0
- final stop: ball=rotor=relative=0rps

Full keeps the longer 8.0s cinematic path and its existing velocity profile. After the standard slowdown,
full can have a higher peak/trackable relative speed than standard, but it spends the extra time on a
longer outer-track and hang/drop path rather than stretching the pocket hops.

## 8.1 Motion Variants

Variant is selected once in `startSpin()` and remains fixed for the spin. It is deterministic and uses a
shuffle bag per mode:

```text
chooseRouletteMotionVariant(mode, seedOverride ?? sessionSeed, debugOverride, spinSeq)
```

For standard, each bag contains exactly one `standard_direct`, one `standard_high_hop`, and one
`standard_shallow_hit`. Bag order is seeded, every third spin reshuffles, and the bag boundary is adjusted
so the last variant of one bag is not repeated as the first variant of the next bag. The same seed and
spin sequence always produce the same order. Full uses the same mechanism with its four variants.

`setMotionVariantOverride(id)` and the browser query parameter `?rouletteVariant=<id>` can force a
variant for debug/QA. Browser debug mode resolves motion in this priority order:

```text
explicit ?rouletteMode=
→ mode inferred from ?rouletteVariant=
→ UI-selected mode
→ default mode
```

This means `?rouletteVariant=full_long_track` alone runs full-mode motion. If explicit mode and variant
mode disagree, the same-mode default is used (`standard_direct` / `full_long_track`). Invalid variant ids
also fall back to the selected/inferred mode default. Query absence keeps normal UI mode and shuffle-bag
selection. `sample()` never calls `Math.random()` and never reselects a variant, so FPS, hidden-tab jumps,
and React re-renders cannot change the variant mid-spin.

Debug QA can enable `?rouletteDebugMotion=1`, which adds a small overlay and root `data-*` attributes:
`data-motion-mode`, `data-motion-variant`, `data-motion-phase`, `data-pocket-stage`,
`data-motion-stage`, `data-spin-sequence`, `data-motion-bag-index`, and `data-motion-bag-slot`. The
overlay/data attributes are written imperatively from the sampled frame state so React batching cannot
drop short-lived pocket labels. High-density `sample()` checks must still observe
`pocket_hop_1 → pocket_hop_2 → pocket_hop_3 → pocket_settle` for every standard/full variant.

| variant | total | trackable | loss | hang | inward | deflector approach | HOP1 | HOP2 | HOP3 | settle | sync | final brake | visual intent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| standard_direct | 4.4s | 720ms | 310ms | 360ms | 430ms | 260ms | 260ms | 190ms | 150ms | 240ms | 190ms | 520ms | plain readable drop/hit |
| standard_high_hop | 4.4s | 680ms | 300ms | 300ms | 420ms | 390ms | 250ms | 185ms | 145ms | 230ms | 180ms | 500ms | stronger first hop |
| standard_shallow_hit | 4.4s | 760ms | 340ms | 440ms | 430ms | 125ms | 270ms | 200ms | 155ms | 240ms | 200ms | 540ms | longer hang, lower radial hit |
| full_long_track | 8.0s | 1500ms | 650ms | 1100ms | 1000ms | 940ms | 300ms | 220ms | 160ms | 280ms | 300ms | 700ms | long trackable orbit |
| full_suspense_hang | 8.0s | 1360ms | 760ms | 1450ms | 900ms | 700ms | 290ms | 215ms | 155ms | 280ms | 330ms | 680ms | long instability/hang |
| full_high_deflector | 8.0s | 1420ms | 620ms | 950ms | 1000ms | 1060ms | 315ms | 225ms | 165ms | 285ms | 290ms | 710ms | clearer high impact |
| full_low_fast_settle | 8.0s | 1460ms | 600ms | 1050ms | 950ms | 1165ms | 285ms | 210ms | 150ms | 260ms | 280ms | 650ms | low sharp settle |

Variant may change only safe visual/timing values: trackable/hang/drop/approach timing, hop height,
radial knock strength, roll sign/amplitude, rattle scale, and small final-brake differences. It must not
change result number, wheel order, `angleOf`, final pocket, `relativeDeg mod 360`, ACK timing gate,
result reveal timing, camera, geometry, material, or full-stop immutability.

| phase | duration | ballVelocityStart | ballVelocityEnd | rotorVelocityStart | rotorVelocityEnd | relativeVelocityStart | relativeVelocityEnd | additionalBallTurns | additionalRotorTurns | radiusStart | radiusEnd | heightStart | heightEnd | interpolation | notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| LAUNCH | 0.42s | 0 | -0.75 | 0 | 0.56 | 0 | -1.30 | -0.16 | 0.12 | 4.50 | 4.51 | 0.51 | 0.50 | Hermite | slower launch than standard |
| HIGH_SPEED_ORBIT | 1.08s | -0.75 | -1.69 | 0.56 | 1.31 | -1.30 | -3.00 | -1.44 | 1.10 | 4.51 | 4.49 | 0.50 | 0.51 | Hermite | cinematic but not frantic |
| TRACKABLE_ORBIT | 1.02s | -1.69 | -1.28 | 1.31 | 1.13 | -3.00 | -2.41 | -1.62 | 1.32 | 4.49 | 4.50 | 0.51 | 0.51 | Hermite | longer than standard, lower relative speed |
| LOSS_OF_STABILITY | 0.48s | -1.28 | -0.65 | 1.13 | 0.75 | -2.41 | -1.40 | -0.47 | 0.46 | 4.50 | 4.50 | 0.51 | 0.51 | Hermite | visibly slow before drop |
| INWARD_DROP | 1.60s | -0.65 | 0.13 | 0.75 | 0.97 | -1.40 | -0.84 | -0.36 | 1.42 | 4.50 | 4.50 | 0.50 | 0.50 | Hermite + smootherstep | no speed spike; relative speed decays |
| DEFLECTOR_IMPACT | 1.30s | 0.13 | 0.43 | 0.97 | 0.89 | -0.84 | -0.47 | 0.39 | 1.24 | 4.50 | 4.07 | 0.50 | 0.31 | smootherstep + damped rattle | visual impact by radius/height |
| POCKET_TRAVERSE | 1.00s | 0.43 | 0.45 | 0.89 | 0.68 | -0.47 | -0.22 | 0.46 | 0.80 | 4.07 | 3.46 | 0.31 | -0.04 | Hermite | result range narrows |
| POCKET_BOUNCE | 0.70s | 0.45 | 0.37 | 0.68 | 0.44 | -0.22 | -0.08 | 0.29 | 0.40 | 3.46 | 3.30 | -0.04 | -0.10 | damped rattle | not stretched artificially |
| POCKET_SETTLE | within land | -0.65 | 0.28 | 0.75 | 0.28 | -1.40 | 0 | 0.73 | 3.82 | 4.50 | 3.26 | 0.50 | -0.12 | Hermite + smootherstep | relative capture completes before final brake |
| ROTOR_SYNC | 0.30s | 0.28 | 0.28 | 0.28 | 0.28 | 0 | 0 | 0.08 | 0.08 | 3.26 | 3.26 | -0.12 | -0.12 | linear hold | ball is briefly carried by rotor |
| FINAL_BRAKE | 0.70s | 0.28 | 0 | 0.28 | 0 | 0 | 0 | 0.10 | 0.10 | 3.26 | 3.26 | -0.12 | -0.12 | Hermite | ball and rotor brake together |
| FULL_STOP | post | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3.26 | 3.26 | -0.12 | -0.12 | constant | all angles remain fixed |

Velocities are signed turns/second.

## 9. Spin To Land Velocity Continuity

SPIN_START終端のサンプルをBALL_LAND開始時の始点として使う。

```text
land.rotor.v0 = spin.rotor.v1
land.relative.v0 = spin.relative.v1
land.ball.v0 = land.rotor.v0 + land.relative.v0
```

テストでは以下を保証する。

- rotor velocity continuity: exact within floating error
- ball velocity continuity: exact within floating error
- relative velocity continuity: exact within floating error
- BALL_LAND開始時 relative rpm < 300
- BALL_LAND中のrelative speedは開始時の105%を超えない

## 10. Result Pocket Convergence

結果ポケットは `angleOf(result.number)` からのみ計算する。アニメーションは結果を決めない。

手順:

1. `currentRelativeDeg = currentBallDeg - currentRotorDeg`
2. `targetRelativeDeg mod 360 = angleOf(result.number)`
3. 最終ポケット中心から `POCKET_HOP_1 / 2 / 3 / SETTLE` の角度予算を逆算する
4. ポケット帯進入後は `3.6 → 1.45 → 0.75 → 0.18 pockets` の段階移動に固定する
5. その直前の `DEFLECTOR_EXIT` で必要な残り角度を消化し、開始速度の105%を超えない候補を優先する
6. 各区間はHermiteでC1連続にし、終端は `relativeVelocity = 0`

これにより、結果ポケットへ直接lerpせず、外周/ディフレクター後に必要な相対移動を消化し、ポケット帯では
3〜4 / 1〜2 / 隣接 / ポケット内部へ急速に収束する。

## 11. Rotor Sync

BALL_LAND終端のrotorはwhole turnへ丸める。

```text
rotorTarget = ceil((currentRotor + minRotorTurns * 360) / 360) * 360
```

sync hold後は以下の共同ブレーキで停止する。

```text
rotorDeg = Hermite(syncStart, finalRotorTarget, v0=syncVelocity, v1=0)
relativeDeg = targetRelativeDeg
ballDeg = rotorDeg + relativeDeg
```

`landed=true` は共同ブレーキ完了後のみ返す。完了後は `rotorDeg`, `ballDeg`, `relativeDeg`, `ballR`, `ballY`, 各velocityが以後変化しない。

## 12. Codex側の変更内容

- `WheelSample` に `relativeDeg`, signed velocity fields, `phase` を追加。
- `WHEEL_MOTION_PROFILES` を追加。
- world ball angle直接補間を廃止。
- `rotorDeg + relativeDeg` モデルへ変更。
- cubic Hermiteで角度と速度をC1連続化。
- BALL_LAND targetをrotor-localで選ぶよう変更。
- `forceFinalize()` はp=1の半径/高さへ即時スナップ。
- `relativeDeg` のポケット帯ステージを追加し、角度方向も `3.6 → 1.45 → 0.75 → 0.18 pockets` で収束。
- `ROULETTE_MOTION_VARIANTS` と決定的seed選択/debug固定を追加し、standardをfullの単純圧縮から分離。
- testsに速度上限、速度連続、full/standard差、variant選択、全variant×全37番号、ポケット帯の角度収束、
  rotor sync、final brake、full stop、FPS非依存を追加。

## 13. Claude Code側の実装内容

Claude Codeへ残す内容:

- Three.js/R3Fの造形、材質、照明、カメラの微調整。
- ディフレクター衝突の見た目。
- ポケットバウンドの視覚密度。
- ラトル音/衝突音の同期。
- 半径/高さの曲線を見た目として微調整する場合の最終QA。

ただし、Codexが決めた速度プロファイルと角度契約は変更しないこと。

## 14. Test Items

追加/更新済み:

- 全37番号 x all modes x land durationで最終角度が一致。
- forced result: 0, 5, 10, 17, 26。
- `relativeDeg` が捕獲まで単調に進む。
- seed差は半径/高さにのみ影響し、最終角度に影響しない。
- spin->land境界で速度がC1連続。
- standard/fullの最大相対速度を上限内に抑制。
- BALL_LAND開始後の相対速度が増えない。
- standardのtrackable boundary速度がfullより低く、fullの単純圧縮ではない。
- sync holdでball velocityとrotor velocityが一致。
- pocket-band angular hopsがstandard/fullとも 3.6 / 1.45 / 0.75 / 0.18 pockets。
- standard速度/距離が前回standard実装値の45-55%帯、rotor peakが50-60%帯。
- standard shuffle bagが3回内で重複せず、バッグ境界でも同variantが連続しない。
- standard 3variantの `ballR`, `ballY`, `ballRoll`, `impactStrength`, `variantId` が実サンプルで異なる。
- pocket stage境界で角度・速度がC1連続。
- final brake後にball/rotor/relative velocityがすべて0。
- 終端後の角度・半径・高さが不変。
- 30fps/60fps/120fps相当で同時刻の状態が一致。
- 同じseedでは同じvariant、不正debug指定はmode default、variantは同一spin中に不変。
- 全variantでforced 0/5/10/17/26、および全37番号が最終ポケットへ一致。

## 15. Completion Conditions

- 旧speed spikeを数値で説明できる。
- standard/fullの新しい回転数と速度がコード化されている。
- standardがfullの早送り版ではなく、短距離・低速の独立モーションになっている。
- BALL_LAND開始時に600rpm以上の相対速度が発生しない。
- SPIN_STARTからBALL_LANDへ速度が連続。
- 結果ポケットへ正確に収束。
- ACKは視覚収束後の既存契約を維持。
- forced resultが壊れない。
- reduced motion/fallbackを壊さない。

## 16. Non-Regression Conditions

- `animationEvents` の契約を変更しない。
- settlement表示はBALL_LAND完了前に出さない。
- カメラ仕様を変更しない。
- 3D造形/材質/照明をCodex側で大規模変更しない。
- 結果をアニメーションから再抽選しない。
- テストを削除して通さない。

## 17. Endgame Choreography (Required)

接地影の追加だけでは不合格。以下の終盤の流れを、**実3D表示で読み取れること**を必須要件とする。

```text
高速周回
→ 球を目で追える速度へ減速（trackable）
→ 外周離脱直前に一度かなり遅く感じる（hang）
→ 球の下を逆回転する番号ホイールが流れる（主役が球→番号リングへ）
→ 球が内側へ落ちる（inward drop）
→ ディフレクター／仕切り衝突で再び激しく見える（角速度は再加速しない）
→ 数個のポケットをまたぐ
→ 跳ねる距離が段階的かつ急速に縮む
→ 最終ポケット内で小さく揺れる
→ rotorと同じ向き・同じ角速度へ同期する
→ 球とrotorを同一カーブで共同減速し、world座標でも完全停止する
```

### 17.1 角速度は再加速しない / 激しさは半径・高さで出す

`WHEEL_MOTION_PROFILES`・角度・相対速度・Hermite・結果収束・終端契約は不変。「再び激しく見える」のは
**角速度の再加速ではなく**、短時間の半径(`ballR`)・高さ(`ballY`)・接地影・球のroll/姿勢の急変で表現する。
`ballAngularVelocity` は基本的に減速を継続し、BALL_LAND開始時の速度ジャンプは禁止。

### 17.2 hang（外周離脱直前）

- 球の周回半径がわずかに内側へ寄り始める。
- 高さがわずかに下がり始める。
- 小さな不安定さ（小振幅）。大きく跳ねない。角度ノイズ・逆戻りは禁止。
- world ball velocity が0付近を通過する区間（spec §7/§8 の INWARD_DROP）と一致させ、
  「球が空中に留まり、その下を番号リングが流れる」主従反転を成立させる。

### 17.3 ディフレクター衝突（最低1回は視認できること）

`ballR` の短い内外変化 / `ballY` の短いhop / 接地影の拡縮・濃淡 / 球の短い姿勢変化 / 短いhighlight。
結果番号・`angleOf`・`relativeDeg`・カメラは変更しない。衝突後はエネルギーを失う。

### 17.4 ポケット通過と段階的収束（急速減衰）

最終ポケットへ最初から吸着させない。番号帯に入った後の跳ね幅は、段ごとに急速に縮める。

```text
第1バウンド: 3〜4ポケット相当
第2バウンド: 1〜2ポケット相当（第1の50%以下）
第3バウンド: 隣接ポケット相当（第1の20〜25%以下）
最終揺れ:    ポケット内部のみ（第1の5〜10%以下）
p=1:        完全に0
```

実装契約：段階バウンドのゲインは決定的な定数列 `BOUNCE_STAGE_GAINS`（と中心 `BOUNCE_STAGE_CENTERS`）で
表現し、`g2 ≤ 0.5·g1`, `g3 ≤ 0.25·g1`, `g4 ≤ 0.1·g1` を満たす。減衰対象は 高さ・半径・影の大きさ／濃淡・
球の姿勢／rollの乱れ。均等減衰やゴム球のような同高さ反復は禁止。seed差は半径/高さのラトルにのみ出す。

`relativeDeg` 本体がポケット帯進入後に以下の段階予算で進む。これは表示専用オフセットではなく、最終結果から
逆算したrotor-local角度本体のステージである。

```text
DEFLECTOR_EXIT: 必要な残り角度を消化（結果へ直接吸着しない）
POCKET_HOP_1:  3.6 pockets
POCKET_HOP_2:  1.45 pockets
POCKET_HOP_3:  0.75 pockets
POCKET_SETTLE: 0.18 pockets
```

standard/fullともポケット帯の移動量は同じオーダーに固定し、fullの長さは主に外周/落下前側へ配分する。

### 17.5 終端（rotor sync → final brake → full stop）

`relativeVelocity=0` / `ballVelocity=rotorVelocity` になった後、短いsync holdを挟み、同一Hermiteカーブで
球とrotorを共同減速する。最終契約は `relativeVelocity=0` / `ballVelocity=0` / `rotorVelocity=0`。
半径・高さ・影・姿勢の揺れはすべて full stop で0。full stop後は `sample(end + dt)` でも角度・半径・高さが変化しない。

### 17.6 standard / full の配分

- standard: 上記すべてを省略せず、fullの一律早送りにはしない。合計は 4.4s
  （SPIN_START 1.8s / BALL_LAND 2.6s）。増加分は主にtrackable/hang/inward/deflector前へ配分し、
  ポケット帯の角度移動量は維持する。
- full: TRACKABLE_ORBIT / LOSS_OF_STABILITY / hang / 番号リング通過 / 落下直前の緊張を standard より明確に長く。
  衝突後やバウンドは引き延ばさない。合計 8.0s 維持。
- variant: standard 3種、full 4種。variant差は外周・hang・衝突・高さ/半径/rollで表現し、カメラ/造形/材質/照明は変えない。

## 18. Result Emphasis（丸マーカー廃止 → 枠／リム発光）

- 数字の上に重なる丸（disc/ring）マーカーは**廃止**。数字を隠す/重なる強調は禁止。
- 当選強調は **当選ポケットの枠（bay outline）発光**を主役にする（数字に重ならない）。任意で上空からの
  弱いソフトライト。過度なネオンにせず上品にフェードイン。
- 表示タイミングは BALL_LAND 完了（rattle/radius/height 収束 → rotor同期 → final brake → full stop → 最終transform → 次paint →
  `onLandingComplete(eventId)`）の **後**。`resultRevealed` ゲートより前には一切出さない。
- 枠はrotorに乗せ、full stop後に当選ポケット上で静止する。
