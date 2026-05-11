# sf-markdown-editor

`sf-markdown-editor` は Salesforce 上で Markdown 編集と表示を提供する LWC ベースのリポジトリです。

## 概要

- `MarkdownEditor` は Salesforce レコードページ上で Markdown を編集し、指定した長文項目に保存します。
- `MarkdownViewer` は保存済み Markdown をレンダリングして表示します。
- `MarkdownEditor` は Base64 埋め込み画像を検出し、`ContentVersion` / `ContentDocument` に保存して画像リンクに置換します。
- `MarkdownViewer` は `value` の直接注入をサポートし、空文字でも表示可能です。

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
- `force-app/main/default/staticresources`
  - `markdownCore` / `mermaidJs`
- `packages/markdown-core`
  - Markdown 解析・レンダリング・サニタイズの共通ロジック
- `manifest/package.xml`
  - デプロイ対象メタデータをまとめたパッケージマニフェスト

## ライセンス

- このリポジトリは `MIT` ライセンスのもとで公開されています。
- `packages/markdown-core` が依存する主要ライブラリは `MIT` ライセンスです。
- `markdownCore` / `mermaidJs` の静的リソースは再配布可能な形でバンドルされています。

## ドキュメント

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

`npm test` では `sfdx-lwc-jest` を使って LWC コンポーネントのテストを実行します。

### Salesforce へのデプロイ

```bash
sfdx force:source:deploy -p force-app/main/default/lwc/markdownEditor,force-app/main/default/lwc/markdownViewer,force-app/main/default/labels,force-app/main/default/translations,force-app/main/default/classes,force-app/main/default/customPermissions,force-app/main/default/permissionsets,force-app/main/default/staticresources
```

## 実装上の注意

- `MarkdownEditor` の `textarea` には `maxlength` を指定していません。Base64 埋め込み画像を含む Markdown を扱うため、保存時に入力サイズエラーを補足する設計です。
- 保存処理は Apex の `MarkdownImageHandler.saveMarkdownWithImages` を経由し、画像の MIME タイプ、サイズ、総容量、Salesforce ランタイム制限を検証します。
- `MarkdownEditor` は `recordId` / `fieldApiName` の不備を検知した場合に UI トーストでエラー通知し、無効な保存を防ぎます。
- `MarkdownViewer` は `markdown-core` を静的リソースから読み込み、Mermaid の読み込み失敗時も Markdown レンダリングを継続します。
- `MarkdownViewer` は `@api value` を直接受け入れ、レコード API より優先して表示できます。

## 付加情報

- カスタムラベル定義は `force-app/main/default/labels/CustomLabels.labels-meta.xml` にあります。
- 翻訳ファイルは `force-app/main/default/translations/en_US.translation` および `force-app/main/default/translations/ja.translation` にあります。
- `manifest/package.xml` には Apex クラス、LWC、静的リソース、カスタムラベル、翻訳、パーミッションセット、カスタムパーミッションが含まれます。
