# 要件定義

`sf-markdown-editor` の要件を、現在の実装を根拠として整理したドキュメント。設計判断の詳細は [`design.md`](design.md)、開発手順は [`development.md`](development.md)、デプロイ手順は [`deployment.md`](deployment.md)、運用上の注意点・既知の課題は [`operations.md`](operations.md) を参照。

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 背景・目的

Salesforce のレコードページ上で、任意の長文テキスト項目（Long Text Area）を Markdown で編集・表示できるようにする。対応ドキュメントを Salesforce の外に持ち出さずに、レコードに紐づけたまま編集・レンダリング・スライド表示・タスク化まで行えることを目的とする。

## 想定利用者

- **編集者**: レコードページで Markdown ドキュメントを編集し、画像を貼り込みながら保存するユーザー。項目の編集権限（FLS: 編集可）が必要。
- **参照者**: 保存済みドキュメントを閲覧するのみのユーザー。項目の参照権限（FLS: 参照可）があれば編集不可でも表示できる。
- **プレゼンター**: `marp: true` を付与したドキュメントをスライドとして投影するユーザー。
- **タスク管理者**: ドキュメント内のチェックボックス項目を Salesforce の `Task` として切り出し、担当者・期限を割り当てて進捗管理したいユーザー。

## 機能要件

### 1. Markdown 編集（`markdownEditor`）

- 任意の Long Text Area 項目を対象に、ツールバー付きの Markdown エディタを提供する。太字・斜体・見出し・コード・リスト・リンク・表・打消し線・引用・画像・水平線の挿入をワンクリックで行える。
- Undo/Redo（最大 50 件の履歴）、Cmd/Ctrl+B（太字）・Cmd/Ctrl+I（斜体）のショートカットに対応する。
- 編集タブ／プレビュータブを切り替えられる。`defaultMode`（App Builder 設定）で初期表示タブを指定できる。
- 未保存の変更がある場合はバッジ表示・保存ボタンの活性制御で明示する。保存前にキャンセルすると編集開始時点の内容に戻す。
- 保存時、Base64 埋め込み画像を自動検出し `ContentVersion` として保存し直し、本文中の参照をダウンロード URL に置き換える（詳細は [design.md](design.md#画像埋め込み保存フロー) 参照）。
- 対象項目に編集権限（FLS）がない場合は自動的にプレビュー専用表示にフォールバックする。参照権限すらない場合はコンポーネント自体を表示しない。
- フルスクリーン表示に対応する（Lightning Web Security の制約により CSS ベースの疑似フルスクリーン）。
- チェックリストパネル（`markdownChecklistPanel`）を編集画面内に埋め込み、チェックボックス一覧・Task 化を同一画面で行える。

### 2. Markdown 表示（`markdownViewer`）

- Markdown 本文を GFM（表・打消し線・タスクリスト等）・数式（KaTeX）・シンタックスハイライト対応で HTML に変換し、サニタイズした上で表示する。
- レコードページ・アプリページ・Home ページ・Flow 画面のいずれにも配置可能（`lightning__RecordPage` / `AppPage` / `HomePage` / `FlowScreen` の4ターゲットに対応）。
- Flow からは `markdownText` プロパティで直接テキストを渡して表示できる（レコード項目に紐づかない一時的な表示にも対応）。
- 他コンポーネント（`markdownEditor` 等）から `value` プロパティで直接テキストを渡して表示できる。
- 本文先頭の YAML フロントマター（`sf_id` 等のメタデータ）は表示上は自動的に除去される（保存データ自体は変更しない）。
- チェックボックスをクリックしてオン/オフを直接トグルできる（`readOnly` が false かつ編集権限がある場合）。トグルは即時にサーバーへ保存される。
- Mermaid 図をコードブロックから自動検出し SVG として描画する。Mermaid の読み込み・描画に失敗しても、それ以外の Markdown レンダリングは継続する。

### 3. Marp スライド表示（`marpViewer`）

- フロントマターに `marp: true` を含むドキュメントを検出し、通常のドキュメント表示に代えてスライド形式で表示する。
- スライドの前後移動、フルスクリーン表示、スライド表示⇔ドキュメント表示の切り替えに対応する。
- モバイル端末では Marp スライド表示を提供せず、常にドキュメント表示にフォールバックする。

### 4. チェックリスト⇔Task 連携（`markdownChecklistPanel` / `markdownTaskPreview`）

- Markdown 本文中のチェックボックス項目（GFM タスクリスト）を一覧表示し、状態（Open/Done/未連携/孤立）を可視化する。
- チェックボックス行から Salesforce `Task` を作成できる（担当者は行ごとに選択可能、デフォルトは実行ユーザー）。作成した Task は本文中のチェックボックス行に埋め込んだ識別子（マーカー）で対応付けられる。
- Task 一覧の各行をホバー/タップすると、Task の詳細をポップオーバーで表示し、その場で Status 等の項目を編集できる（インライン編集）。
- 作成済み Task の `Status` が変更されると、対応する Markdown 本文中のチェックボックスの状態（`[ ]`/`[x]`）が自動的に反映される（双方向同期）。
- Markdown 側でチェックボックスの状態を変更して保存すると、対応する Task の `Status`（Open/Closed）が自動的に反映される（双方向同期の逆方向）。
- 対応する Task が削除された、あるいは本文からチェックボックス行が削除された場合も、エラーにせず「孤立（orphan）」「未連携」として扱う。

### 5. 権限・アクセス制御

- コンポーネントの利用可否はカスタム権限 `MarkdownEditorViewerAccess` で制御できる。
- 権限セット `MarkdownEditorViewer` は Apex（`MarkdownImageHandler`）・Visualforce ページ（`MarpRenderer`）・カスタム権限へのアクセスのみを付与し、対象オブジェクト・項目の FLS は含まない（デプロイ先環境ごとに個別付与する運用。詳細は [deployment.md](deployment.md)）。
- 権限セット `MarkdownTaskSync` は、チェックリスト⇔Task 連携機能を使うユーザーに割り当てる。`Task.MarkdownMarkerId__c` / `Task.MarkdownFieldApiName__c` への FLS と `MarkdownTaskSync` Apex クラスへのアクセスを付与する。

### 6. 多言語対応

- カスタムラベルにより日本語・英語の翻訳を提供する（[operations.md](operations.md#翻訳カバレッジの既知の欠落) に既知の未翻訳ラベルを記載）。

## 非機能要件

### セキュリティ

- 保存された Markdown をレンダリングする際、XSS を防ぐためにタグ・属性のホワイトリスト方式でサニタイズする（`<script>`・インラインイベントハンドラ・`javascript:` リンク・`<iframe>`・SVG の `foreignObject` 等を除去）。
- Mermaid の `securityLevel` は必ず `'strict'` を維持し、HTML ラベルを無効化する。
- サーバー側の全ての読み書きは Salesforce の CRUD/FLS/共有ルールを尊重する（`WITH USER_MODE` / `as user` DML、および明示的な `isAccessible()`/`isUpdateable()` チェックの二重防御）。
- 動的フィールドアクセス（`MarkdownRecordFieldAccessor`）は、対象オブジェクトの実在する項目名のみを許可し、SOQL インジェクションを防止する。

### パフォーマンス・可用性

- 画像添付を含む保存は、Salesforce のガバナ制限（CPU 時間・ヒープサイズ・DML サイズ）に抵触しないよう、処理中に継続的に残余リソースを監視し、閾値に達した場合は保存を中断してユーザーにエラーを返す。
- Mermaid 図の描画は、Lightning Web Security 配下での実行が重いことが判明しているため、Visualforce ページ（LWS 適用外）へ描画を委譲する経路を優先し、失敗時のみ LWS 配下の直接描画にフォールバックする。

### 制約・対象外

- Task/Event への直接のカスタム項目追加は Salesforce 側の制約により不可（`INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST`）。そのため `Activity` エンティティ経由でのフィールド追加という代替手段を採用している（詳細は [design.md](design.md#activity-エンティティ経由でのフィールド追加) 参照）。
- Marp スライド表示はモバイル端末（Salesforce モバイルアプリ内ブラウザ）では提供しない。
- チェックボックスのマーカー ID（6桁 hex）はグローバルな一意性を保証しない。衝突は実務上無視できる確率として許容している（詳細は [design.md](design.md#マーカーidの設計とその限界) 参照）。

## バックログ（未実装の要望）

以下は `docs/feature-requests.md`（旧）から引き継いだ、現時点で未実装の要望。実装状況は都度このセクションを更新する。

| #   | 要望                                                         | 状態                                                                      |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | チェックボックス⇔Task 双方向同期                             | ✅ 実装済み（上記「機能要件 4」）                                         |
| 2   | プレビューでのチェックボックスクリックによる直接トグル       | ✅ 実装済み（上記「機能要件 2」）                                         |
| 3   | `<details>`/`<summary>` の開閉状態を示す視覚的インジケーター | ✅ 実装済み（`markdownViewer.css` にカスタム三角マーカーを追加。2026-08） |
| 4   | プレビュー画面でのブロック単位クリック編集（インライン編集） | 実装案検討済み・未着手                                                    |

新たな要望が出た場合は、この表に行を追加し、実装後は「状態」列を更新する（要望の議論経緯・設計案は Pull Request またはこのファイルの変更履歴に残す）。
