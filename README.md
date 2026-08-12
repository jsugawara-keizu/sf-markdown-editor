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
- `force-app/main/default/lwc/marpViewer`
  - Marp スライド表示用 LWC（`MarpRenderer.page` を iframe で読み込む）
- `force-app/main/default/lwc/markdownChecklistPanel`
  - Markdown 内チェックボックスの一覧・Task 作成用 LWC（`markdownEditor` へ埋め込み、または単体配置）
- `force-app/main/default/lwc/markdownTaskPreview`
  - `markdownChecklistPanel` 用のホバー/タップ編集ポップオーバー（非公開サブコンポーネント）
- `force-app/main/default/classes`
  - Apex 保存ロジック `MarkdownImageHandler` / `MarkdownImageHandlerTest`
  - Task 連携 `MarkdownTaskSync` / `MarkdownTaskSyncTest`
  - Task→Markdown 同期の Trigger ハンドラー `MarkdownTaskTriggerHandler` / `MarkdownTaskTriggerHandlerTest`
  - 動的フィールドアクセスの共通処理 `MarkdownRecordFieldAccessor`
- `force-app/main/default/triggers`
  - `MarkdownTaskTrigger`（Task の Status 変更を Markdown チェックボックスへ反映）
- `force-app/main/default/objects/Activity/fields`
  - `MarkdownMarkerId__c` / `MarkdownFieldApiName__c`（Task/Event 共通のチェックリスト連携用カスタム項目。Task/Event へは直接追加できないため `Activity` エンティティ経由で追加している）
- `force-app/main/default/pages`
  - `MarpRenderer`（Marp スライド描画用 VF ページ）
  - `MermaidRenderer`（Mermaid 図描画用 VF ページ。LWS 配下での描画負荷回避のため）
- `force-app/main/default/labels`
  - カスタムラベル定義
- `force-app/main/default/translations`
  - 日本語 / 英語翻訳
- `force-app/main/default/customPermissions`
  - `MarkdownEditorViewerAccess`
- `force-app/main/default/permissionsets`
  - `MarkdownEditorViewer`
  - `MarkdownTaskSync`（`Activity` カスタム項目2件・`MarkdownTaskSync` クラスへのアクセス権）
- `force-app/main/default/staticresources`
  - `markdownCore` / `marpCore` / `mermaidJs`
- `packages/markdown-core`
  - Markdown 解析・レンダリング・サニタイズ・チェックリスト抽出の共通ロジック
- `manifest/package.xml`
  - デプロイ対象メタデータをまとめたパッケージマニフェスト（翻訳を除く。新規コンポーネント追加時は都度更新すること — 詳細は下記「manifest/package.xml の保守」参照）
- `manifest/package_lang-ja.xml` / `manifest/package_lang-en_US.xml`
  - 翻訳（`Translations`）専用のデプロイマニフェスト

## ライセンス

- このリポジトリは `MIT` ライセンスのもとで公開されています。
- `packages/markdown-core` が依存する主要ライブラリは `MIT` ライセンスです。
- `markdownCore` / `mermaidJs` の静的リソースは再配布可能な形でバンドルされています。

## ドキュメント

- `docs/markdown-components.md`
- `docs/markdown-component-tests.md`
- `docs/feature-requests.md`

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

### Org 設定（デプロイ後に必要な手動設定）

#### 1. 権限セットの割り当て

`MarkdownEditorViewer` 権限セットをコンポーネントを使用するユーザーに割り当てる。

#### 2. Lightning レコードページへのコンポーネント配置

Lightning App Builder でコンポーネントを配置し、`fieldApiName` に対象オブジェクトの Long Text Area 項目 API 名を設定する。

#### 3. インラインフレームの信頼済みドメイン設定（Marp スライド表示に必要）

`marpViewer` は Visualforce ページ（`MarpRenderer`）を iframe で読み込むため、Lightning ドメインを信頼済みドメインとして登録する必要がある。

Setup > **Security** > **Session Settings** > **インラインフレームの信頼済みドメイン** に環境の Lightning ドメインを追加する。

| 環境                | 追加するドメイン                                 |
| ------------------- | ------------------------------------------------ |
| Developer / Sandbox | `https://<org-name>.sandbox.lightning.force.com` |
| Production          | `https://<my-domain>.lightning.force.com`        |

> **注意**: VF ドメイン（`*.vf.force.com`）ではなく **Lightning ドメイン**（`*.lightning.force.com`）を登録すること。誤って VF ドメインを登録しても効果がない。

#### 4. 項目レベルセキュリティ（FLS）の付与

`MarkdownEditorViewer` 権限セットには環境固有のオブジェクト・項目への FLS は含まれていない。プロファイルまたは環境専用の権限セットで、対象項目（例: `Subject__c.Markdown__c`）への読み取り・編集権限を付与すること。

### Salesforce へのデプロイ

2段階構成でデプロイする。

**ステップ 1：通常デプロイ（全環境共通）**

```bash
sf project deploy start --manifest manifest/package.xml --target-org <alias>
```

**ステップ 2：翻訳デプロイ（Translation Workbench が有効な環境のみ）**

環境の言語設定に合わせていずれかを実行する。

```bash
# 日本語
sf project deploy start --manifest manifest/package_lang-ja.xml --target-org <alias>

# 英語
sf project deploy start --manifest manifest/package_lang-en_US.xml --target-org <alias>
```

> **注意**: Translation Workbench が無効な環境でステップ 2 を実行するとエラーになる。ステップ 1 のみで動作自体は問題ない（ラベルはデフォルト言語の英語で表示される）。

## 実装上の注意

- `MarkdownEditor` の `textarea` には `maxlength` を指定していません。Base64 埋め込み画像を含む Markdown を扱うため、保存時に入力サイズエラーを補足する設計です。
- 保存処理は Apex の `MarkdownImageHandler.saveMarkdownWithImages` を経由し、画像の MIME タイプ、サイズ、総容量、Salesforce ランタイム制限を検証します。
- `MarkdownEditor` は `recordId` / `fieldApiName` の不備を検知した場合に UI トーストでエラー通知し、無効な保存を防ぎます。
- `MarkdownViewer` は `markdown-core` を静的リソースから読み込み、Mermaid の読み込み失敗時も Markdown レンダリングを継続します。
- `MarkdownViewer` は `@api value` を直接受け入れ、レコード API より優先して表示できます。

## 付加情報

- カスタムラベル定義は `force-app/main/default/labels/CustomLabels.labels-meta.xml` にあります。
- 翻訳ファイルは `force-app/main/default/translations/en_US.translation` および `force-app/main/default/translations/ja.translation` にあります。
- `manifest/package.xml` には Apex クラス、LWC、静的リソース、カスタムラベル、パーミッションセット、カスタムパーミッションが含まれます（翻訳は含みません。上記「Salesforce へのデプロイ」ステップ2の `package_lang-*.xml` で別途管理）。

### manifest/package.xml の保守

新規コンポーネント（Apex クラス・Trigger・カスタム項目・LWC バンドル・PermissionSet・ApexPage 等）を追加した際は、`manifest/package.xml` にも都度追記すること。追記漏れがあっても deploy 自体は `--source-dir` 指定なら成功するため気づきにくいが、この manifest を使った参照デプロイ（`sf project deploy start --manifest manifest/package.xml`）でサイレントに欠落する。

追記後は dry-run で実ファイルへの解決を確認する。

```bash
sf project deploy start --manifest manifest/package.xml --target-org <alias> --dry-run
```

> **注意**: 翻訳（`Translations`）は `package.xml` に追加しないこと。Translation Workbench が無効な環境で通常デプロイが失敗する原因になるため、`package_lang-ja.xml` / `package_lang-en_US.xml` 側で管理する。
