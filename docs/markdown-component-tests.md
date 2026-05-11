# Markdown コンポーネント テスト一覧

このドキュメントは `MarkdownEditor` および `MarkdownViewer` の現在の LWC テストケースと、`packages/markdown-core` の `vitest` テスト、Apex テストを一覧化したものです。

## 1. MarkdownEditor テスト

テストファイル: `force-app/main/default/lwc/markdownEditor/__tests__/markdownEditor.test.js`

### 1.1 テストケース

- `renders textarea in edit mode by default`
  - `MarkdownEditor` がデフォルトで textarea をレンダリングすることを確認します。
- `marks as dirty on input`
  - テキスト入力時に内部状態が「変更あり」になることを確認します。
- `switches to preview tab on click`
  - プレビュータブをクリックすると `MarkdownViewer` が表示されることを確認します。
- `displays character count as 0 initially`
  - 初期表示時の文字数カウントが 0 であることを確認します。
- `inserts bold markup via toolbar button`
  - 太字ボタンをクリックすると Markdown が挿入されることを確認します。
- `shows preview mode when defaultMode is preview`
  - `defaultMode` が `preview` の場合に textarea ではなく `MarkdownViewer` が表示されることを確認します。

## 2. MarkdownViewer テスト

テストファイル: `force-app/main/default/lwc/markdownViewer/__tests__/markdownViewer.test.js`

### 2.1 テストケース

- `shows spinner while loading`
  - `markdown-core` 読み込み中にスピナーが表示されることを確認します。
- `calls renderAndSanitizeAsync after library loads`
  - ライブラリロード後に `renderAndSanitizeAsync` が呼ばれることを確認します。
- `re-renders when value changes after load`
  - 値変更時に再レンダリングが行われることを確認します。
- `does not call renderAndSanitizeAsync for empty value`
  - 空の Markdown ではレンダリングが呼ばれないことを確認します。
- `renders correctly when given an empty direct value`
  - `value=""` を直接渡してもコンポーネントが正常に表示されることを確認します。
- `keeps rendering when mermaid script load fails`
  - Mermaid 読み込み失敗時でも Markdown のレンダリングが継続されることを確認します。
- `shows error state when markdown-core load fails`
  - `markdown-core` ロード失敗時にエラーメッセージが表示されることを確認します。

## 3. markdown-core パッケージ テスト

`packages/markdown-core` は `vitest` ベースのテストを持ち、ルートの `npm test` では実行されません。

### 3.1 テストファイル

- `packages/markdown-core/__tests__/parser.test.ts`
- `packages/markdown-core/__tests__/mermaid-rendering.test.ts`
- `packages/markdown-core/__tests__/sanitizer.test.ts`

### 3.2 テストケース

#### parser.test.ts

- `renderMarkdown` converts basic Markdown to HTML
  - `# Hello\n\nWorld` が HTML に変換される
- `renderMarkdown` renders GFM tables
  - GFM テーブルを `<table>` と `<th>` でレンダリングする
- `renderMarkdown` renders GFM strikethrough
  - `~~strike~~` が `<del>` に変換される
- `renderMarkdown` renders fenced code blocks
  - フェンス付きコードブロックを `<code>` とシンタックスハイライト付き HTML に変換する
- `renderMarkdown` returns empty string for empty input
  - 空文字や空白のみの入力で空文字列を返す
- `renderMarkdown` does not output raw script tags after sanitize
  - `<script>` を含む入力がスクリプトタグなしで出力される
- `extractHeadings` returns all headings in order
  - 見出しを順番どおりに抽出し、レベル・テキスト・ID を検証する
- `extractHeadings` returns empty array for documents with no headings
  - 見出しなし入力で空配列を返す
- `extractHeadings` slugifies heading text
  - 見出しテキストが URL 形式の ID に変換される
- `buildToc` builds a nested TOC
  - 入れ子構造の目次 Markdown を生成する
- `buildToc` returns empty string for document with no headings
  - 見出しなし入力で空文字列を返す

#### mermaid-rendering.test.ts

- `rendersMarkdownAsync mermaid integration` converts all mermaid code fences to local runtime-missing error blocks
  - Mermaid 実行環境がない場合、エラー用ブロックに変換される
- `rendersMarkdownAsync mermaid integration` keeps markdown sections while converting mermaid blocks
  - Mermaid ブロック以外の Markdown セクションは維持される
- `rendersMarkdownAsync mermaid integration` uses window mermaid runtime when globalThis mermaid is missing
  - `window.mermaid` を利用して Mermaid をレンダリングできる

#### sanitizer.test.ts

- `createSanitizer` passes safe HTML unchanged
  - 安全な HTML がそのまま通過する
- `createSanitizer` strips `<script>` tags
  - `<script>` タグが除去される
- `createSanitizer` strips inline event handlers
  - `onclick` などのイベントハンドラ属性が除去される
- `createSanitizer` strips `javascript:` hrefs
  - `javascript:` リンクが除去される
- `createSanitizer` allows safe anchor links
  - 安全な外部リンクが許容される
- `createSanitizer` allows GFM table elements
  - `<table>` 等の GFM テーブル構造を保持する
- `createSanitizer` strips `<iframe>`
  - `<iframe>` が除去される
- `createSanitizer` sanitizes mermaid-like SVG
  - SVG 内の `<script>` が除去されつつ SVG 要素が保持される
- `createSanitizer` preserves mermaid marker attributes
  - Mermaid SVG の `marker` 属性が保持される
- `createSanitizer` preserves SVG text layout attributes
  - SVG のテキストレイアウト属性が保持される

## 4. Apex テスト

テストファイル: `force-app/main/default/classes/MarkdownImageHandlerTest.cls`

### 4.1 テストケース

- `saveMarkdownWithoutImages_returnsOriginalAndUpdatesField`
  - 画像なし Markdown が元のまま保存され、フィールド値が更新される
- `saveMarkdownWithSingleImage_replacesUriAndCreatesContentDocument`
  - 単一の Base64 画像が ContentVersion に保存され、`ContentDocumentLink` として親レコードに紐付けられる
- `saveMarkdownWithMultipleImages_handlesAllMimeTypes`
  - PNG / JPEG / SVG の複数画像がすべて置換され、3 件の ContentVersion が作成される
- `saveMarkdownWithUnsupportedImageType_throwsFriendlyAuraHandledException`
  - 未サポートの MIME タイプで例外が発生する
- `saveMarkdown_withNullRecordId_throwsAuraHandledException`
  - `recordId` が null の場合に例外を投げる
- `saveMarkdown_withBlankFieldApiName_throwsAuraHandledException`
  - `fieldApiName` が空文字の場合に例外を投げる
- `saveMarkdown_withMismatchedObjectApiName_throwsAuraHandledException`
  - レコード ID と `objectApiName` が不一致の場合に例外を投げる
- `saveMarkdown_withBlankObjectApiName_savesSuccessfully`
  - `objectApiName` が空文字でも保存に成功する
- `saveMarkdown_withNullMarkdownContent_updatesFieldToEmpty`
  - `markdownContent` が null の場合、フィールドに空文字列を保存する
- `saveMarkdown_withNonUpdateableField_throwsAuraHandledException`
  - 更新不可フィールドの場合に例外が発生する
- `saveMarkdown_withInvalidField_throwsAuraHandledException`
  - 存在しないフィールド名の場合に例外を投げる
- `extractDataUris_returnsEmptyListForBlank`
  - `null` / 空文字の入力で空リストを返す
- `extractDataUris_parsesMimeAndBase64`
  - data URI の MIME タイプと Base64 データを正しく抽出する
- `mimeTypeToExtension_handlesCommonAndEdgeCases`
  - MIME タイプを拡張子に変換し、未知のタイプは `bin` にフォールバックする
- `replaceFirst_replacesOnlyFirstOccurrence`
  - 文字列内の最初の一致のみを置換する
- `replaceFirst_returnsSourceWhenNotFound`
  - 一致がない場合は元の文字列を返す
- `replaceFirst_handlesNullInputs`
  - `null` 入力に対して安全に動作する

## 5. テスト実行コマンド一覧

```bash
npm test
cd packages/markdown-core && npm test
sfdx force:apex:test:run --resultformat human --testlevel RunSpecifiedTests --tests MarkdownImageHandlerTest
```

- ルートの `npm test` は `sfdx-lwc-jest` による LWC テストを実行します。
- `packages/markdown-core` の `npm test` は `vitest` による Markdown コアのテストを実行します。
- Apex テストは Salesforce org 上で実行します。

## 6. 補足

- `packages/markdown-core` 配下の `vitest` ベーステストは `sfdx-lwc-jest` 実行時に無視されます。
- Apex テストは `MarkdownImageHandlerTest.cls` に実装されています。
