# 導入・デプロイ

このリポジトリのメタデータを Salesforce org へデプロイし、利用可能にするまでの手順。開発手順は [development.md](development.md)、内部設計は [design.md](design.md)、デプロイ後の運用・既知の注意点は [operations.md](operations.md) を参照。

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## 前提

- 対象 org に `sf` CLI で認証済みであること。
- 本リポジトリを開発元とする LWC（`markdownEditor` 等）は、複数の利用組織（Sandbox 環境）へ同一コンポーネントをデプロイする運用になっている。**各利用組織側でのメタデータ変更は禁止し、必ずこのリポジトリ側で行う**（利用組織側リポジトリの `force-app/` を直接編集してデプロイしない。各利用組織のリポジトリ管理ルールに記載の例外運用）。デプロイ後は、利用組織側リポジトリの `force-app/main/default/` にも最新状態を反映してコミットし、乖離を防ぐこと。

## デプロイ手順（2段階構成）

翻訳（`Translations`）は通常デプロイ用の `manifest/package.xml` に含まれていない。Translation Workbench が無効な環境で通常デプロイに翻訳を含めるとデプロイ自体が失敗するため、翻訳は環境の言語設定に応じて別マニフェストで個別にデプロイする。

### ステップ1: 通常デプロイ（全環境共通）

```bash
sf project deploy start --manifest manifest/package.xml --target-org <alias>
```

このマニフェストには以下が含まれる（`manifest/package.xml`、API v66.0）。

| メタデータ種別                | 対象                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ApexClass（7）                | `MarkdownImageHandler` / `*Test`、`MarkdownRecordFieldAccessor`、`MarkdownTaskSync` / `*Test`、`MarkdownTaskTriggerHandler` / `*Test` |
| ApexPage（2）                 | `MarpRenderer`、`MermaidRenderer`                                                                                                     |
| ApexTrigger（1）              | `MarkdownTaskTrigger`                                                                                                                 |
| CustomField（2）              | `Activity.MarkdownFieldApiName__c`、`Activity.MarkdownMarkerId__c`                                                                    |
| CustomLabels（1）             | `CustomLabels`（ラベル定義一式、翻訳は含まない）                                                                                      |
| CustomPermission（1）         | `MarkdownEditorViewerAccess`                                                                                                          |
| LightningComponentBundle（5） | `markdownChecklistPanel`、`markdownEditor`、`markdownTaskPreview`、`markdownViewer`、`marpViewer`                                     |
| PermissionSet（2）            | `MarkdownEditorViewer`、`MarkdownTaskSync`                                                                                            |
| StaticResource（3）           | `markdownCore`、`marpCore`、`mermaidJs`                                                                                               |

### ステップ2: 翻訳デプロイ（Translation Workbench 有効環境のみ）

環境の既定言語に合わせていずれかを実行する。

```bash
# 日本語
sf project deploy start --manifest manifest/package_lang-ja.xml --target-org <alias>

# 英語
sf project deploy start --manifest manifest/package_lang-en_US.xml --target-org <alias>
```

> **注意**: Translation Workbench が無効な環境でステップ2を実行するとエラーになる。ステップ1のみでも動作自体は問題ない（ラベルは既定言語である英語で表示される）。

### `manifest/package.xml` の保守

新規コンポーネント（Apex クラス・Trigger・カスタム項目・LWC バンドル・PermissionSet・ApexPage 等）を追加した際は、`manifest/package.xml` にも都度追記すること。追記漏れがあっても `--source-dir` 指定のデプロイは成功するため気づきにくいが、このマニフェストを使った参照デプロイでサイレントに欠落する。

追記後は dry-run で実ファイルへの解決を確認する。

```bash
sf project deploy start --manifest manifest/package.xml --target-org <alias> --dry-run
```

> 翻訳（`Translations`）は `package.xml` に追加しないこと。Translation Workbench が無効な環境で通常デプロイが失敗する原因になる。

## デプロイ後に必要な手動設定

メタデータのデプロイだけでは機能しない、環境ごとの個別設定。

### 1. 権限セットの割り当て

| 権限セット             | 割り当て対象                              | 付与内容                                                                                                                                                    |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MarkdownEditorViewer` | コンポーネントを使用する全ユーザー        | `MarkdownImageHandler` へのApexアクセス、`MarpRenderer` VFページアクセス、`MarkdownEditorViewerAccess` カスタム権限、`ApiEnabled`/`LightningExperienceUser` |
| `MarkdownTaskSync`     | チェックリスト⇔Task連携機能を使うユーザー | `MarkdownTaskSync` Apexクラスへのアクセス、`Task.MarkdownMarkerId__c` / `Task.MarkdownFieldApiName__c` への読み書きFLS                                      |

```bash
sf org assign permset --name MarkdownEditorViewer --target-org <alias>
sf org assign permset --name MarkdownTaskSync --target-org <alias>
```

### 2. Lightning レコードページへのコンポーネント配置

Lightning App Builder で `markdownEditor` / `markdownViewer` / `markdownChecklistPanel`（単体配置する場合）を配置し、`fieldApiName` に対象オブジェクトの Long Text Area 項目 API 名を設定する。

### 3. インラインフレームの信頼済みドメイン設定（Marp スライド表示に必要）

`marpViewer` は Visualforce ページ（`MarpRenderer`）を iframe で読み込むため、Lightning ドメインを信頼済みドメインとして登録する必要がある。

Setup > **セキュリティ** > **セッションの設定** > **インラインフレームの信頼済みドメイン** に環境の Lightning ドメインを追加する。

| 環境                | 追加するドメイン                                 |
| ------------------- | ------------------------------------------------ |
| Developer / Sandbox | `https://<org-name>.sandbox.lightning.force.com` |
| Production          | `https://<my-domain>.lightning.force.com`        |

> **注意**: VF ドメイン（`*.vf.force.com`）ではなく **Lightning ドメイン**（`*.lightning.force.com`）を登録すること。誤って VF ドメインを登録しても効果がない。

### 4. 項目レベルセキュリティ（FLS）の付与

`MarkdownEditorViewer` 権限セットには、デプロイ先環境固有のオブジェクト・項目への FLS は**意図的に**含まれていない（[development.md](development.md#権限セット運用方針) 参照）。プロファイルまたは環境専用の権限セットで、対象項目（例: 任意オブジェクトの Long Text Area 項目）への読み取り・編集権限を個別に付与すること。

### 5. `MermaidRenderer` ページへのアクセス確認（既知の抜け漏れ）

`MarkdownEditorViewer` 権限セットには `MarpRenderer` ページへの `pageAccesses` は含まれているが、`MermaidRenderer` ページは含まれていない。プロファイル側で「全 Visualforce ページを参照可」になっていない環境では、`markdownViewer` の Mermaid 図が iframe 経由で描画できず、直接描画へのフォールバックも機能しない可能性がある。デプロイ先環境でのプロファイル設定、または `MermaidRenderer` への明示的な `pageAccesses` 付与を検討すること。

## 開発元リポジトリからの複数 Sandbox 展開

本リポジトリは、複数の利用組織（Sandbox 環境）向けの「開発元リポジトリ」として運用されている（2026-08〜）。

1. 修正は必ず本リポジトリ側のファイルに加える（LWC の `.js`/`.html`/`.css` だけでなく、ビルド生成物である静的リソース（`markdownCore`/`marpCore`）や Visualforce ページも対象）。
2. 本リポジトリから対象 Sandbox を明示して `sf project deploy start --target-org <alias>` でデプロイする。
3. デプロイ後、本リポジトリの最新状態を各利用組織側リポジトリの `force-app/main/default/` にも `cp` 等で反映してコミットし、乖離を防ぐ。

> **注意（LWC バンドルは1ファイル単位でデプロイできない）**: LWC コンポーネントはバンドル単位でしかデプロイできないため、対象ファイル1つだけを直したつもりでも、そのバンドル配下の全ファイルが一括でデプロイ対象になる。本リポジトリが Sandbox 側より先行して他の機能を複数抱えている場合、意図した修正以外の先行機能もまとめて Sandbox 環境へ反映されてしまう点に注意する。デプロイ前に両リポジトリの対象バンドルを `diff` し、意図しない差分を持ち込むことにならないか確認したうえで、影響範囲を関係者に説明してから実施する。

## ライセンス

- 本リポジトリは MIT ライセンスのもとで公開されている。
- `packages/markdown-core` / `packages/marp-core` が依存する主要ライブラリは MIT ライセンス。
- `markdownCore` / `marpCore` / `mermaidJs` の静的リソースは再配布可能な形でバンドルされている。
