## 重点監査項目

### 1. 当たり番号と3Dポケットの一致

以下を数式とコードの両方から確認してください。

* `WHEEL_ORDER`が唯一の番号順として使われているか
* `POCKET_DEFS`と`WHEEL_ORDER`が一致しているか
* `angleOf(number)`が正しいインデックスを返すか
* number plate、pocket floor、fret、球の着地点が同じ座標系を使っているか
* 0〜36すべてで表示番号と着地点が一致するか
* 赤・黒・緑の色が正しいか
* 隣接番号の位置関係が正しいか

一部番号だけの目視確認では不十分です。可能なら0〜36すべてを機械的に検証してください。

### 2. rotorのlocal angle / world angle

特に厳しく確認してください。

* Three.jsの正負の回転方向
* ローターの回転方向
* 球のlocal angle
* 球のworld angle
* `rotorTarget`が本当に整数周で終了するか
* 浮動小数点誤差によってrest時のローター角がidentityからずれないか
* `worldAngle = localAngle ± rotorAngle`の符号が正しいか
* standard / full / reducedのすべてで同じ番号へ着地するか

Claudeの報告にある式を前提にせず、実装から独立して導出してください。

### 3. 決定的着地

以下を確認してください。

* 3D側で当たり番号を再抽選していない
* seedやvariationが結果番号を変えない
* 0〜36すべてで最終角度が指定番号と一致する
* standard / full / reducedで一致する
* 非常に短い`landMs`でも破綻しない
* 大きな`landMs`でも破綻しない
* 再スピン時に前回の状態が混入しない
* Strict Modeの再マウントで結果が変わらない
* 球の最終半径と高さがポケット内部にある
* 球がpocket wallやfretを貫通していない

既存の5テストだけで不足する場合は、37番号×全モードを確認する追加テストを検討してください。

### 4. BALL_LANDと実アニメーション完了の同期

Claudeは「`landMs`とキューのタイマーが同一なので同期する」と報告していますが、これを重点的に疑ってください。

確認項目:

* `Math.max(80, landMs)`とキュー側durationが常に一致するか
* キュー側で別の丸め、倍率、モード補正がないか
* `useFrame()`側の開始時刻とsetTimeout開始時刻が同時か
* React effectの発火順によるずれがないか
* 低FPSで最後のフレームが描画される前に結果公開されないか
* background tabでsetTimeoutとR3F clockが同じ進み方をするか
* タブ復帰直後に着地フレームが描画される前に結果が表示されないか
* `landMs < 80`の場合に結果公開が先行しないか
* stale callbackや二重完了がないか

単に「両方とも時間ベース」であることを、完全同期の証明として扱わないでください。

必要なら、現在の外部契約を壊さずに実アニメーション完了callbackや安全な同期方法を提案してください。

### 5. ゲームロジック

以下を確認してください。

* `useRoulette.ts`が変更されていない
* `resolveSpin()`が変更されていない
* `economy.placeBet()`が1回だけ
* `economy.settle()`が1回だけ
* payoutとprofitが変わっていない
* `BALL_LAND`前に`resultRevealed`がtrueにならない
* 履歴更新が1回だけ
* unmount時に`flushPendingSettlement()`が機能する
* 連続スピンで前回のsettlementが混入しない

### 6. geometryと視覚的整合性

以下をコードと可能なら実画面で確認してください。

* ball trackの半径・高さ
* bowlとapronの断面
* deflectorの位置
* pocket floorの深さ
* fretの高さ・厚み・向き
* 球の半径
* 球の最終位置
* number plateの向き
* far側番号の視認性
* mobileでの見切れ
* z-fighting
* backface
* 透明度・depth sorting
* 球が浮いて見えないか
* 球が壁を貫通して見えないか

視覚評価ができる環境なら、forced outcomeで少なくとも以下を確認してください。

* 0
* 1
* 5
* 10
* 17
* 26
* 32
* 36

front、side、far側を含めてください。

### 7. resource disposal

Claudeの報告を信用せず、次を確認してください。

* 自作geometryが適切にdisposeされるか
* 自作materialが適切にdisposeされるか
* canvas texture 37枚が再マウントごとにリークしないか
* React Three Fiberが自動破棄する資源を手動で二重disposeしていないか
* Strict Modeのmount → unmount → mountで破棄済み資源を再利用しないか
* Environment / Lightformerのrender target
* baked shadow texture
* wood texture
* number texture
* instancedMesh
* hot reload時の挙動

「R3Fが処理するはず」という推測だけで安全判定しないでください。

### 8. パフォーマンス

以下を確認してください。

* 実際のdraw call数
* number plate 37枚のdraw call
* geometryの頂点数
* DPR `[1,2]`のモバイル負荷
* 961KBのlazy chunkが許容範囲か
* 初回スピンまでのロード
* Canvas texture生成コスト
* Environment生成コスト
* 毎フレームのallocation
* 毎フレームのReact state更新
  -不要なVector3 / Euler / Quaternion生成
* 連続スピン時のGC負荷

### 9. fallbackとreduced motion

以下を確認してください。

* OSの`prefers-reduced-motion`で意図どおりSVGへ切り替わるか
* UI上のreducedモードとOS reduced motionを混同していないか
* WebGL失敗時にゲーム進行が停止しないか
* ErrorBoundaryが非同期WebGLエラーをすべて捕捉できるという誤った前提がないか
* context loss時の挙動
* fallbackでも結果公開と精算が正しいか

### 10. テストの質

新規テストについて確認してください。

* 実装と同じ数式をテスト側で再利用し、同じバグを追認していないか
* assertionが弱すぎないか
* 最終値だけで中間状態のNaNや不連続を見逃していないか
* seed variationを十分確認しているか
* 37番号を網羅しているか
* modeを網羅しているか
* boundary durationを確認しているか
* 非有限値、負のduration、想定外番号への耐性

## 修正方針

監査中に問題を発見した場合は、重大度を以下で分類してください。

* Critical：結果、精算、番号、クラッシュに関わる
* High：着地同期、決定性、重大なリーク、主要環境での破綻
* Medium：視覚品質、性能、保守性に明確な問題
* Low：軽微な改善

CriticalまたはHighの問題は、原因を特定でき、既存契約を壊さず安全に直せる場合のみ修正してください。

MediumまたはLowの問題は、原則として先に報告してください。単なる好みでClaudeの3Dデザインを全面的に変更しないでください。

修正した場合は、修正後に型チェック、全テスト、production buildを再実行してください。

## 禁止事項

* Claudeの報告書を根拠に成功判定する
* テスト結果を実行せず信用する
* 無関係な変更を削除する
* `git reset --hard`
* `git clean -fd`
* 勝手なcommitまたはpush
* テストの削除・弱体化
* `any`やエラー握り潰しによる修正
* デザインの好みだけによる全面再実装
* ゲームロジックの不要な変更

## 最終報告形式

### 1. 総合判定

次のいずれかを明記してください。

* PASS：重大な問題なし
* PASS WITH ISSUES：動作可能だが修正推奨あり
* FAIL：結果・同期・精算・安定性に重大な問題あり

### 2. 発見事項

重大度順に記載してください。

各項目には以下を含めてください。

* 重大度
* ファイルと行
* 問題
* 再現条件
* 根拠
* 影響
* 修正状況

### 3. Claude報告との相違

Claudeの報告で正しかった点、誤っていた点、証明できなかった点を分けてください。

### 4. 実行したコマンド

実際に実行したものだけ記載してください。

### 5. テスト・ビルド結果

正確な件数と結果を記載してください。

### 6. 変更ファイル

Codex自身が修正した場合のみ記載してください。

### 7. 未確認事項

環境上確認できなかった内容を明記してください。

今から、報告書ではなく現在のリポジトリを一次情報として独立監査してください。
