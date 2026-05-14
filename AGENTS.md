# sf-markdown-editor — Agent Instructions

## プロジェクト概要

Salesforce LWC 向けの Markdown エディタ／ビューアコンポーネント。
レコードページの任意のテキストフィールドに対して Markdown の編集・プレビューを提供する。

## リポジトリ構成

```
force-app/main/default/
  lwc/
    markdownEditor/          # エディタ LWC（編集・保存・Undo/Redo・ツールバー）
    markdownViewer/          # ビューア LWC（Markdown → HTML レンダリング）
  classes/
    MarkdownImageHandler.cls # Data URI → ContentVersion 変換 Apex クラス
  staticresources/
    markdownCore/            # ビルド済み IIFE バンドル（下記パッケージから生成）
    mermaidJs.js             # Mermaid.js スタティックリソース
  labels/                   # カスタムラベル（多言語対応）
  permissionsets/           # 権限セット定義

packages/markdown-core/     # TypeScript ソース（Vite でビルド → staticresources へ出力）
  src/
    index.ts                 # エクスポートエントリ（renderAndSanitizeAsync など）
    renderer.ts              # Markdown → HTML（remark/rehype パイプライン）
    sanitize.ts              # DOMPurify 代替サニタイザー（rehype-sanitize ベース）
    sanitizer.ts             # サニタイザー公開 API
    parser.ts                # Markdown AST パーサー
    mermaid-transform.ts     # Mermaid コードブロック → SVG 変換
    debug.ts                 # デバッグログユーティリティ
  vite.config.ts             # iife ビルド → force-app/staticresources/markdownCore/
```

## スキル自動適用ルール

**以下のファイルを編集・確認・レビューする際は、対応するスキルを必ず呼び出すこと。**

| 対象ファイル                                                                   | 呼び出すスキル |
| ------------------------------------------------------------------------------ | -------------- |
| `force-app/**/*.cls`, `force-app/**/*.trigger`                                 | `sf-apex`      |
| `force-app/**/lwc/**/*.js`, `**/*.html`, `**/*.css`, `**/*.js-meta.xml`        | `sf-lwc`       |
| `force-app/**/*.object-meta.xml`, `**/*.field-meta.xml`, `**/*.permissionset*` | `sf-metadata`  |
| Salesforce org へのデプロイ操作                                                | `sf-deploy`    |
| Apex テスト実行・確認                                                          | `sf-testing`   |
| デバッグログ解析                                                               | `sf-debug`     |

## 重要な実装ルール

### 静的リソースのビルド

`packages/markdown-core/src/` 以下を変更したら必ずビルドを実行すること:

```bash
cd packages/markdown-core
npm install   # node_modules が壊れている場合のみ
npm run build
```

ビルド成果物は `force-app/main/default/staticresources/markdownCore/markdown-core.iife.js` に直接出力される。

### markdownViewer.js — wire ガード条件

`_directValue` は `""` で初期化されるため、ガード条件は `!== undefined` ではなく `!== ""` を使うこと。
`wiredRecord` と `wiredObjectInfo` 両方に適用。

### MarkdownImageHandler.cls — 画像置換

`extractDataUris()` は `startIndex` / `endIndex` を `DataUriMatch` に格納する。
置換ループは **末尾から前方向**（インデックス降順）に処理し、`source.substring(m.startIndex, m.endIndex)` で直接置換すること。`replaceFirst()` はインデックスなし版の後方互換用に残すが新規コードでは使わない。

### sanitize.ts — セキュリティ制約

- `foreignObject` は SVG_TAGS および attributes マップから**除外**すること（XSS ベクター）
- `style` タグコンテンツは `rehypeSanitizeStyleContent` プラグインで `url()` / `@import` / `expression()` を除去すること
- Mermaid の `securityLevel` は `'strict'` を維持すること（`'loose'` に戻さない）
- `SVG_DASHED_ATTRS` に重複エントリを追加しないこと

### markdownEditor.js — 状態管理

- `history` / `historyIndex` は `@track` を付けないこと（キーストロークごとの不要再レンダリングを防ぐ）
- Undo/Redo 後の `isDirty` は `state.value !== this.editStartValue` で判定すること
- `navigator.platform` は非推奨。`navigator.userAgentData?.platform ?? navigator.userAgent` を使うこと

### デバッグ設定

`setMermaidDebugEnabled` はハードコードで `true` にしないこと。本番コードに残す場合は `@api debugMode` で制御する。

## テスト

```bash
# LWC ユニットテスト
npm run test:unit

# Apex テスト（org 接続が必要）
sf apex run test --class-names MarkdownImageHandlerTest --result-format human

# markdown-core テスト
cd packages/markdown-core && npx vitest run
```

## デプロイ

```bash
# デフォルト org へデプロイ
sf project deploy start --source-dir force-app

# 特定 org を指定
sf project deploy start --source-dir force-app --target-org <alias>
```

## API バージョン

`sfdx-project.json` の `sourceApiVersion: "66.0"` を維持すること。
