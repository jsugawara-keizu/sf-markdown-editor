# sf-markdown-editor

`sf-markdown-editor` は Salesforce Lightning Web Components を使って、Markdown の入力・編集・保存・表示を提供するリポジトリです。

## 概要

- `MarkdownEditor` は Salesforce レコードページ上で Markdown を編集し、指定した長文エリア項目に保存します。
- `MarkdownViewer` は保存済み Markdown をレンダリングし、Mermaid 図やリッチテキストを表示します。
- `MarkdownEditor` は Base64 埋め込み画像を検出して `ContentVersion` / `ContentDocument` として保存し、画像リンクに置換します。

## リポジトリ構成

- `force-app/main/default/lwc/markdownEditor`
  - Markdown 編集用 LWC
- `force-app/main/default/lwc/markdownViewer`
  - Markdown 表示用 LWC
- `force-app/main/default/classes`
  - Apex 保存ロジック `MarkdownImageHandler` / `MarkdownImageHandlerTest`
- `force-app/main/default/labels`
  - カスタムラベル定義
- `force-app/main/default/translations`
  - 日本語 / 英語翻訳
- `force-app/main/default/customPermissions`
  - `MarkdownEditorViewerAccess`
- `force-app/main/default/permissionsets`
  - `MarkdownEditorViewer`
- `packages/markdown-core`
  - Markdown 解析・レンダリング・サニタイズの共通ロジック
- `manifest/package.xml`
  - デプロイ対象メタデータをまとめたパッケージマニフェスト

## ドキュメント

現在の実装にあわせたドキュメント:

- `docs/markdown-components.md`
- `docs/markdown-component-tests.md`

## 開発とセットアップ

### 依存関係のインストール

```bash
npm install
```

### テスト実行

```bash
npm test
```

このコマンドは `sfdx-lwc-jest` を使って LWC コンポーネントのテストを実行します。

### Salesforce へのデプロイ

```bash
sfdx force:source:deploy -p force-app/main/default/lwc/markdownEditor,force-app/main/default/lwc/markdownViewer,force-app/main/default/labels,force-app/main/default/translations,force-app/main/default/classes,force-app/main/default/customPermissions,force-app/main/default/permissionsets
```

## 実装上の注意

- `MarkdownEditor` の textarea には HTML 側の `maxlength` を設定していません。Base64 埋め込み画像を含む Markdown では入力サイズが大きくなる可能性があるため、保存時のエラーで制限を補足します。
- 保存処理は Apex の `MarkdownImageHandler.saveMarkdownWithImages` を通じて実行され、画像の種類やサイズ、Salesforce のランタイム制限に応じたエラーハンドリングを行います。
- `MarkdownViewer` は `markdown-core` / `mermaidJs` 静的リソースを読み込み、サニタイズ済み HTML を `lwc:dom="manual"` で描画します。

## 付加情報

- カスタムラベル定義は `force-app/main/default/labels/CustomLabels.labels-meta.xml` にあります。
- 翻訳ファイルは `force-app/main/default/translations/en_US.translation` および `force-app/main/default/translations/ja.translation` にあります。
- `manifest/package.xml` には Apex クラス、LWC、静的リソース、カスタムラベル、翻訳、パーミッションセット、カスタムパーミッションが含まれます。
