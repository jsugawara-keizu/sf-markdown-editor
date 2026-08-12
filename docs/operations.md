# 運用

デプロイ後の運用における既知の制約・トラブルシューティング・監視すべき事項を記載する。要件は [requirements.md](requirements.md)、内部設計は [design.md](design.md)、開発・デプロイ手順は [development.md](development.md) / [deployment.md](deployment.md) を参照。

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 既知の制約・ギャップ一覧

実装調査で判明した、現時点で残っている既知の制約・ドキュメント外の挙動。改修時の優先度判断に利用する。

| #   | 内容                                                                                                                                                                                                                                                      | 影響                                                                                                                                      | 対応状況                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | `MermaidRenderer.page` への `pageAccesses` が `MarkdownEditorViewer` 権限セットに未設定                                                                                                                                                                   | プロファイルで全VFページ参照が許可されていない環境では、Mermaid の iframe 描画委譲が機能しない可能性                                      | 未対応。[deployment.md](deployment.md#5-mermaidrenderer-ページへのアクセス確認既知の抜け漏れ) 参照 |
| 2   | `postMessage` の送受信で `event.origin` を検証していない（`MarpRenderer.page` / `MermaidRenderer.page` 双方）                                                                                                                                             | 同一オリジンの自ページ間通信を前提にした簡略化。理論上、同ページをフレームする別コンテキストからの偽装メッセージ注入の余地がある          | 未対応（受容可能なリスクとして現状維持）                                                           |
| 3   | 2つの Visualforce ページの `apiVersion` が `62.0` のまま（他は `66.0`）                                                                                                                                                                                   | 意図した固定か放置か不明。将来の API バージョン一括更新時に見落としやすい                                                                 | 未対応                                                                                             |
| 4   | カスタムラベルのうち `MarpMobileUnsupportedNotice`・`MarkdownRecordIdMissingError`・`MarkdownObjectApiNameMissingError`・`MarkdownFieldApiNameMissingError`・`MarkdownFieldAccessSummary` がマスター（`CustomLabels.labels-meta.xml`、en_US）で値が空文字 | モバイルでの Marp フォールバック時や、`recordId`/`fieldApiName` 不備時のエラートースト・通知が空文字で表示される                          | 未対応                                                                                             |
| 5   | `en_US.translation-meta.xml` に86ラベル中29ラベルが未登録（`MarkdownChecklist*` 全15件を含む）。`ja.translation-meta.xml` は12ラベル未登録                                                                                                                | 未登録ラベルは既定言語（英語）の値にフォールバックするため機能break ではないが、日本語環境でUndo/Redoやエラーメッセージ等が英語表示になる | 未対応（翻訳カバレッジの拡充が必要）                                                               |
| 6   | 画像保存の2MB/6MB上限、CPU時間・ヒープの閾値超過を実際に駆動するテストが存在しない（`MarkdownImageHandlerTest.cls`）                                                                                                                                      | 上限値のリファクタ時に regression を検知できない                                                                                          | 未対応。テスト追加を推奨                                                                           |
| 7   | マーカーID（6桁hex）の一意性はサーバー側で強制されていない                                                                                                                                                                                                | 極めて低確率だが衝突時、Task→Markdown方向の同期は最初に見つかった1箇所のみ反映される                                                      | 設計上受容（[design.md](design.md#マーカーidの設計とその限界) 参照）                               |
| 8   | `MarkdownTaskTriggerHandler.syncMarkdownForGroup` は「同一(WhatId, 項目)グループ内」はバルク安全だが、1トランザクションで多数の異なる親レコードにまたがる Task 一括更新時はグループ数に比例したSOQL/DMLが発生する                                         | 数百件規模の Task 一括Status変更で governor limit に近づく可能性                                                                          | 未対応。大量一括更新の運用では監視を推奨                                                           |
| 9   | `sanitizer.ts`（`sanitize.ts` の別バレル）は `index.ts` から参照されておらず、`window.MarkdownCore` には現れない                                                                                                                                          | 現状実害なし（デッドコードに近い）                                                                                                        | 要否を判断のうえ整理を検討                                                                         |

## トラブルシューティング

### Mermaid 図が表示されない・プレビューが固まったように見える

1. まず `/apex/MermaidRenderer` に直接アクセスできるか確認する（VFページへのアクセス権 or プロファイル設定）。上記「既知の制約 #1」に該当する可能性がある。
2. ブラウザの開発者ツールで `window.MarkdownCore` が定義されているか確認する（静的リソース `markdownCore` の読み込み失敗の可能性）。
3. Mermaid 記法自体の構文エラーの場合は、該当図のみ `mermaid-error`/`mermaid compile error` ブロックに置き換わり、他の内容の表示は継続される（設計上の想定挙動）。
4. 大量の図を含むドキュメントで応答が遅い場合、[design.md](design.md#mermaid-描画の3段構成) の3段フォールバックのどの経路で描画されているか（VF iframe / 直接描画 / フォールバック）を、`setMermaidDebugEnabled(true)` を一時的に呼び出してコンソールログで確認する（本番コードで有効化したままにしないこと）。

### Marp スライドが表示されない

1. フロントマターに `marp: true` が正しく含まれているか確認する（先頭のHTMLコメントより後にYAMLフロントマターがあれば検出対象になる）。
2. Lightning ドメインがインラインフレームの信頼済みドメインに登録されているか確認する（[deployment.md](deployment.md#3-インラインフレームの信頼済みドメイン設定marp-スライド表示に必要)）。VFドメインを誤って登録しているケースが典型的な設定ミス。
3. モバイル端末（Salesforce モバイルアプリ内ブラウザ）ではそもそも Marp スライド表示を提供しない仕様（常にドキュメント表示にフォールバック）。バグではない。

### 画像埋め込み保存が失敗する

- エラートーストのメッセージ（`AuraHandledException` 経由でそのまま表示される）を確認する。「MIME種別非対応」「Base64不正」「画像サイズ超過（2MB/枚・6MB合計）」「CPU/ヒープ制限接近」のいずれかであれば、[design.md](design.md#バリデーションとガバナ制限対策) の設計値に基づく想定挙動。
- `recordId`/`fieldApiName` 不備、対象項目への編集権限（FLS）不足の場合も個別のエラーメッセージが表示される。

### チェックボックスと Task の状態がずれる

- Markdown 側のチェック状態は「保存された本文」を都度正として同期する設計（[design.md](design.md#markdown--task-方向保存時の同期)）。保存操作（Save ボタン、チェックボックス直接クリックによる即時保存、チェックリストパネルでのTask作成）を経ていない変更は反映されない。
- Task の Status 変更が反映されない場合、対象 Task に `MarkdownMarkerId__c`/`MarkdownFieldApiName__c` が設定されているか（Task一覧で「未連携」ではなく本来リンクされているはずの行か）を確認する。
- 「孤立（orphan）」表示の Task は、対応する本文のチェックボックス行が削除されたことを意味する（同期の不具合ではない）。

## 監視・定期確認事項

- **翻訳カバレッジ**: ラベルを追加・変更した際は `ja.translation-meta.xml` / `en_US.translation-meta.xml` の両方を更新する。既存の欠落（上記「既知の制約 #5」）は計画的に埋めることを推奨する。
- **`manifest/package.xml` の網羅性**: 新規メタデータ追加時は必ず追記し、dry-run で確認する（[deployment.md](deployment.md#manifestpackagexml-の保守)）。
- **開発元リポジトリと各利用組織の Sandbox の乖離**: デプロイ後は必ず利用組織側リポジトリにも最新状態を反映してコミットする運用を継続する（[deployment.md](deployment.md#開発元リポジトリからの複数-sandbox-展開)）。

## バックログ

未実装の機能要望は [requirements.md](requirements.md#バックログ未実装の要望) に一元管理する。実装済みの改善履歴・設計の議論経緯は Pull Request の履歴を正とする。
