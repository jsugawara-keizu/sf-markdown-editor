# 開発

ローカル開発環境のセットアップ、ビルド、テスト、コーディング規約を記載する。要件は [requirements.md](requirements.md)、実装の内部設計は [design.md](design.md)、デプロイ手順は [deployment.md](deployment.md) を参照。

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## リポジトリ構成

```
force-app/main/default/
  lwc/
    markdownEditor/            # 編集 LWC（ツールバー・保存・Undo/Redo・チェックリスト埋め込み）
    markdownViewer/            # 表示 LWC（Record/App/Home/Flow の4ターゲット対応）
    marpViewer/                # Marp スライド表示（非公開、markdownEditor から利用）
    markdownChecklistPanel/    # チェックボックス一覧・Task作成 UI
    markdownTaskPreview/       # Task ホバー/タップ編集ポップオーバー（非公開サブコンポーネント）
  classes/
    MarkdownImageHandler.cls / *Test.cls        # 画像埋め込み保存・チェックボックストグル
    MarkdownRecordFieldAccessor.cls             # 動的フィールド読み書き（FLS/CRUD保証）
    MarkdownTaskSync.cls / *Test.cls            # チェックリストUI用Task操作・Markdown→Task同期
    MarkdownTaskTriggerHandler.cls / *Test.cls  # Task→Markdown同期
  triggers/
    MarkdownTaskTrigger.trigger                 # Task の after update トリガー
  objects/Activity/fields/
    MarkdownMarkerId__c / MarkdownFieldApiName__c
  pages/
    MarpRenderer.page / MermaidRenderer.page    # LWS 適用外での描画委譲先 VF ページ
  labels/CustomLabels.labels-meta.xml
  translations/ja.translation-meta.xml / en_US.translation-meta.xml
  customPermissions/MarkdownEditorViewerAccess
  permissionsets/MarkdownEditorViewer / MarkdownTaskSync
  staticresources/markdownCore / marpCore / mermaidJs

packages/
  markdown-core/                # TypeScript ソース（Vite→staticresources/markdownCore へビルド）
    src/
      index.ts                  # 公開エクスポートのバレル（window.MarkdownCore の実体）
      parser.ts                 # remark ベースの AST パース・見出し抽出・TOC生成
      renderer.ts                # remark/rehypeパイプライン・Mermaid委譲解決
      sanitize.ts                # サニタイズスキーマ（セキュリティの中核）
      sanitizer.ts               # sanitize.ts の別バレル（現状 index.ts からは未参照）
      checklist.ts               # チェックボックス抽出・^[todo:xxxx]マーカー操作
      checkbox-transform.ts      # レンダリング時のチェックボックス対話化（rehypeプラグイン）
      mermaid-transform.ts       # Mermaidコードブロック→SVG変換の走査ロジック
      mermaid-frame-compiler.ts  # VF iframe への Mermaid描画委譲
      debug.ts                   # デバッグログ（既定オフ）
    __tests__/                   # vitest（jsdom環境）
    vite.config.ts
  marp-core/                     # @marp-team/marp-core を IIFE バンドル化（→ staticresources/marpCore）
    vite.config.ts
```

## 依存関係のインストール

```bash
npm install
```

`packages/markdown-core` / `packages/marp-core` はそれぞれ独立した `package.json` を持つため、変更する場合は個別に `npm install` する（`node_modules` が壊れている場合のみで通常は不要）。

## ビルド

### markdown-core（Markdown レンダリングパイプライン）

`packages/markdown-core/src/` 配下を変更したら、必ずビルドして静的リソースへ反映すること。

```bash
cd packages/markdown-core
npm run build         # vite build → force-app/main/default/staticresources/markdownCore/markdown-core.iife.js
npm run build:watch   # 監視モード
```

ビルド成果物は Git 管理対象であり、手動編集は禁止（`force-app/main/default/staticresources/markdownCore/README.md` にも明記）。ビルド設定（`vite.config.ts`）のポイント:

- 依存ライブラリはすべてバンドルする（`rollupOptions.external: []`）。静的リソースとして単体で動作する必要があるため。
- カスタム Vite プラグイン `lwsGlobalExport` が `window.MarkdownCore = MarkdownCore;` をビルド後のコードに追記する。Lightning Web Security 配下では IIFE トップレベルの変数代入が実際の `window` に届かないため（詳細は [design.md](design.md#クライアント側の設計上の工夫lws-対応)）。
- `outDir` は `staticresources/markdownCore` を直接指しており、`emptyOutDir: false` のため同ディレクトリの `README.md` は消えない。

### marp-core（Marp Core バンドル）

```bash
cd packages/marp-core
npm run build   # vite build → force-app/main/default/staticresources/marpCore
```

`@marp-team/marp-core` を IIFE 化する。Node 専用 API（`fs` 等）への依存を `vite-plugin-node-polyfills` でスタブしてブラウザ実行可能にしている。

## テスト

| 対象                           | コマンド                                                                                                 | 備考                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| LWC（Jest）                    | `npm test`（= `npm run test:unit` = `sfdx-lwc-jest`）                                                    | ルートの `jest.config.js` は `packages/markdown-core` を明示的に除外している |
| LWC（Jest, watch）             | `npm run test:unit:watch`                                                                                |                                                                              |
| LWC（Jest, coverage）          | `npm run test:unit:coverage`                                                                             |                                                                              |
| markdown-core（vitest）        | `cd packages/markdown-core && npm test`（= `vitest run`）                                                | **ルートの `npm test` には含まれない。個別に実行すること**                   |
| markdown-core（vitest, watch） | `cd packages/markdown-core && npm run test:watch`                                                        |                                                                              |
| Apex                           | `sf apex run test --class-names MarkdownImageHandlerTest --result-format human --target-org <alias>`など | 対象 org への接続が必要                                                      |

### markdown-core のテスト構成（vitest + jsdom）

- `checkbox-transform.test.ts` — チェックボックスの `disabled` 解除・`data-md-line` 付与・マーカー非表示化
- `checklist.test.ts` — `extractCheckboxItems` / `insertCheckboxMarker`（マーカー挿入・保護コメント挿入の冪等性）
- `mermaid-rendering.test.ts` — `renderMarkdownAsync` のエンドツーエンド（Mermaidランタイム未存在時のフォールバック、`window.mermaid` モック時の直接描画経路）
- `parser.test.ts` — `renderMarkdown` の基本変換・GFM・見出し抽出・TOC生成
- `sanitizer.test.ts` — サニタイズのホワイトリスト検証（`<script>`除去・`javascript:`リンク除去・SVG属性の保持等）

`mermaid-transform.ts`（`mermaid-rendering.test.ts` 経由で間接的にのみ検証）と `mermaid-frame-compiler.ts`（iframe/DOM 統合のため markdown-core 単体テストの対象外）には専用のユニットテストがない点に留意する。

### Apex のテスト構成

`MarkdownImageHandlerTest.cls` は実際の `Account` レコード・`ContentVersion` DML・`Task` レコードを使った統合的なテスト（モックなし）。`saveMarkdownWithImages` の正常系（画像0/1/複数枚、MIME種別ごと）、異常系（MIME不許可・Base64不正・recordId/fieldApiName不備・オブジェクト不一致・非更新可能項目・存在しない項目）、`toggleCheckboxLine` の正常系・異常系、チェックリスト同期の呼び出し確認を含む。ただし **2MB/6MB の上限超過やCPU/ヒープ閾値超過の境界値テストは存在しない**（[design.md](design.md#バリデーションとガバナ制限対策) 参照）。

`MarkdownTaskSyncTest.cls` / `MarkdownTaskTriggerHandlerTest.cls` は Markdown⇔Task 双方向同期の正常系・ループガード（DML件数アサーションによる冪等性検証）・エッジケース（マーカーなし、未知マーカー等）をカバーする。

## コーディング規約・実装ルール

以下は `AGENTS.md` に集約されている実装上の注意点（変更時に必ず踏まえること）。

### スキル自動適用ルール

| 対象ファイル                                                             | 呼び出すスキル |
| ------------------------------------------------------------------------ | -------------- |
| `force-app/**/*.cls`, `force-app/**/*.trigger`                           | `sf-apex`      |
| `force-app/**/lwc/**/*.js`, `.html`, `.css`, `.js-meta.xml`              | `sf-lwc`       |
| `force-app/**/*.object-meta.xml`, `*.field-meta.xml`, `*.permissionset*` | `sf-metadata`  |
| Salesforce org へのデプロイ操作                                          | `sf-deploy`    |
| Apex テスト実行・確認                                                    | `sf-testing`   |
| デバッグログ解析                                                         | `sf-debug`     |

### markdownViewer.js

- `_directValue` は空文字 `""` で初期化されるため、ガード条件は `!== undefined` ではなく `!== ""` を使う（`wiredRecord` / `wiredObjectInfo` の両方）。
- `doRenderAsync` で `renderAndSanitizeAsync` に渡す前に、YAMLフロントマター（`/^---\n[\s\S]*?\n---\n?/`）を除去する。プレビューには表示しないが、Editモードでは生テキストとして編集可能。除去はチェックボックス行番号の対応付け（`_checkboxLineOffset`）とセットで扱うこと。

### MarkdownImageHandler.cls

- `extractDataUris()` は `startIndex`/`endIndex` を `DataUriMatch` に保持する。置換ループは **末尾から前方向**（インデックス降順）に処理し、`source.substring(m.startIndex, m.endIndex)` で直接置換する。`replaceFirst()` はインデックスなし版の後方互換用ヘルパーとして残すが、新規コードでは（オフセットずれの原因になるため）使わない。

### sanitize.ts

- `foreignObject` は `SVG_TAGS` および属性マップから**除外**すること（XSSベクター）。
- `<style>` タグコンテンツは `rehypeSanitizeStyleContent` プラグインで `url()` / `@import` / `expression()` を除去すること。
- Mermaid の `securityLevel` は `'strict'` を維持すること（`'loose'` に戻さない）。
- `SVG_DASHED_ATTRS` に重複エントリを追加しないこと。

### markdownEditor.js

- `history` / `historyIndex` は `@track` を付けないこと（キーストロークごとの不要再レンダリングを防ぐ）。
- Undo/Redo 後の `isDirty` は `state.value !== this.editStartValue` で判定すること。
- `navigator.platform` は非推奨。`navigator.userAgentData?.platform ?? navigator.userAgent` を使うこと。

### デバッグ設定

`setMermaidDebugEnabled` はハードコードで `true` にしないこと。本番コードに残す場合は呼び出し元で `@api debugMode` 等により制御する。

### 権限セット運用方針

`MarkdownEditorViewer` / `MarkdownTaskSync` はパッケージとして複数環境へデプロイされるため、**環境固有のリソースへの権限を含めてはならない**。

含めてよいもの: パッケージ同梱の Apex クラス・Visualforce ページ・カスタム権限へのアクセス、`LightningExperienceUser`・`ApiEnabled` 等の汎用ユーザー権限。

含めてはならないもの: デプロイ先オブジェクト・項目への FLS（`fieldPermissions`）、デプロイ先オブジェクトへのオブジェクト権限（`objectPermissions`）。理由は、パッケージ権限セットに環境固有の FLS を含めると、次回デプロイ時に他環境の個別設定を上書き・消去するリスクがあるため。環境固有の FLS 付与方法は [deployment.md](deployment.md) を参照。

> 例外: `MarkdownTaskSync` 権限セットは `Task.MarkdownMarkerId__c` / `Task.MarkdownFieldApiName__c` への FLS を含んでいる。これはパッケージ同梱のカスタム項目（`Activity` エンティティ経由で追加）に対するものであり、「デプロイ先の既存オブジェクト・項目」への権限ではないため、この方針の対象外として扱われている。

### API バージョン

`sfdx-project.json` の `sourceApiVersion: "66.0"` を維持すること。VF ページ（`MarpRenderer.page-meta.xml` / `MermaidRenderer.page-meta.xml`）は現状 `62.0` のままで揃っていない（[operations.md](operations.md) に既知の課題として記載）。

## Lint / Format / pre-commit

```bash
npm run lint              # eslint **/{aura,lwc}/**/*.js
npm run prettier          # 全対象ファイルへ prettier --write
npm run prettier:verify   # 差分なしをCIで確認する用途
```

`husky` + `lint-staged` により、コミット時に自動で `prettier --write`（対象: `*.cls,cmp,component,css,html,js,json,md,page,trigger,xml,yaml,yml`）、`eslint`（LWC/Auraの `.js`）、および `lwc/` 配下の変更があれば `sfdx-lwc-jest -- --bail --findRelatedTests --passWithNoTests` を実行する。

CI ワークフロー（GitHub Actions 等）は本リポジトリには存在しない。テスト・Lint の実行はローカルの pre-commit フックと手動実行に依存している。
