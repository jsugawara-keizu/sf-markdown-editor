# 設計

[要件定義](requirements.md) を実現するための実装アーキテクチャ。開発手順は [development.md](development.md)、デプロイ手順は [deployment.md](deployment.md)、既知の制約・運用上の注意は [operations.md](operations.md) を参照。

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## コンポーネント全体構成

```mermaid
graph TD
    subgraph LWC
        Editor[markdownEditor]
        Viewer[markdownViewer]
        Marp[marpViewer]
        Checklist[markdownChecklistPanel]
        Preview[markdownTaskPreview]
    end
    subgraph Apex
        ImgHandler[MarkdownImageHandler]
        Accessor[MarkdownRecordFieldAccessor]
        TaskSync[MarkdownTaskSync]
        TriggerHandler[MarkdownTaskTriggerHandler]
    end
    subgraph VF["Visualforce（LWS 適用外）"]
        MarpPage[MarpRenderer.page]
        MermaidPage[MermaidRenderer.page]
    end
    subgraph Core["packages/markdown-core（静的リソース化）"]
        RenderCore[renderer.ts / sanitize.ts]
    end

    Editor -->|埋め込み| Checklist
    Editor -->|preview| Viewer
    Editor -->|marp検出時| Marp
    Marp -->|非marp時| Viewer
    Checklist -->|hover/click| Preview

    Editor -->|saveMarkdownWithImages| ImgHandler
    Viewer -->|toggleCheckboxLine| ImgHandler
    Checklist -->|createTaskForCheckbox / getTasksForField| TaskSync
    Checklist -->|saveMarkdownWithImages| ImgHandler

    ImgHandler --> Accessor
    ImgHandler -->|保存直後| TaskSync
    TriggerHandler --> Accessor

    Task[(Task レコード)] -.Status変更.-> TriggerHandler
    TriggerHandler -.checkbox書き換え.-> Accessor

    Viewer -.postMessage.-> MermaidPage
    Marp -.postMessage.-> MarpPage

    Viewer -->|静的リソース読込| RenderCore
```

_図: LWC・Apex・Visualforce・markdown-core の依存関係。実線はコンポーネント間の直接呼び出し、点線は非同期（postMessage・トリガー）連携を示す。_

| レイヤー     | コンポーネント                                       | 役割                                                               |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------ |
| LWC          | `markdownEditor`                                     | 編集 UI・保存・チェックリストパネルの埋め込みホスト                |
| LWC          | `markdownViewer`                                     | 表示専用。Record/App/Home/Flow の4ターゲットに対応する共通ビューア |
| LWC          | `marpViewer`                                         | Marp スライド表示（非公開、`markdownEditor` 内部から利用）         |
| LWC          | `markdownChecklistPanel`                             | チェックボックス一覧・Task 作成 UI                                 |
| LWC          | `markdownTaskPreview`                                | Task のホバー/タップ編集ポップオーバー（非公開サブコンポーネント） |
| Apex         | `MarkdownImageHandler`                               | 画像埋め込み保存・チェックボックストグルの唯一の書き込み経路       |
| Apex         | `MarkdownRecordFieldAccessor`                        | 任意オブジェクト・任意項目への動的 FLS/CRUD 保証付き読み書き       |
| Apex         | `MarkdownTaskSync`                                   | チェックリスト UI 用の Task 取得・作成・Markdown→Task 状態同期     |
| Apex         | `MarkdownTaskTriggerHandler` / `MarkdownTaskTrigger` | Task→Markdown 状態同期（after update トリガー）                    |
| VF           | `MarpRenderer.page`                                  | LWS 適用外での Marp + Mermaid 描画                                 |
| VF           | `MermaidRenderer.page`                               | LWS 適用外での単体 Mermaid 図描画（`markdownViewer` から利用）     |
| 静的リソース | `markdownCore`                                       | `packages/markdown-core` のビルド出力（`window.MarkdownCore`）     |
| 静的リソース | `marpCore` / `mermaidJs`                             | Marp Core / Mermaid.js 本体                                        |

## 画像埋め込み保存フロー

保存操作（`markdownEditor` の Save ボタン、チェックボックストグル、チェックリストパネルの Task 作成後の保存）はすべて `MarkdownImageHandler.saveMarkdownWithImages(recordId, objectApiName, fieldApiName, markdownContent)` を経由する。

```mermaid
sequenceDiagram
    participant LWC as markdownEditor
    participant Apex as MarkdownImageHandler
    participant CV as ContentVersion
    participant Accessor as MarkdownRecordFieldAccessor
    participant TaskSync as MarkdownTaskSync

    LWC->>Apex: saveMarkdownWithImages(recordId, objectApiName, fieldApiName, markdown)
    Apex->>Apex: "extractDataUris() で data:image/...;base64,... を走査"
    Apex->>Apex: validateEmbeddedImages()（MIME許可リスト・サイズ上限）
    loop 画像ごと
        Apex->>Apex: checkRuntimeLimits()（CPU時間・ヒープ）
        Apex->>CV: insert as user（Base64デコード→ContentVersion、まとめて1回）
    end
    Apex->>CV: WITH USER_MODE で ContentDocumentId を再取得
    Apex->>Apex: 末尾から前方向に data URI をダウンロードURLへ置換
    Apex->>Accessor: updateRecordField(recordId, fieldApiName, 置換後markdown)
    Accessor->>Accessor: isUpdateable() チェック → update as user
    Apex->>TaskSync: syncCheckboxStatesFromMarkdown(recordId, fieldApiName, 置換後markdown)
    TaskSync->>TaskSync: 全マーカーの状態を抽出し、Task.IsClosedと差分があるものだけ一括update
    Apex-->>LWC: 置換後のmarkdown文字列を返す
```

_図: 画像埋め込み保存とチェックリスト同期の一連の流れ。画像がない場合は ContentVersion 関連の手順をスキップし、フィールド更新とチェックリスト同期のみ行う。_

### data URI 抽出・置換アルゴリズム

`extractDataUris` は正規表現の一括マッチではなく、文字列を手動で走査する実装になっている。`data:` → `;base64,` → Base64 文字集合（`[A-Za-z0-9+/=]`）の順に位置を特定し、各マッチの `startIndex`/`endIndex` を元の文字列上のオフセットとして記録する。

置換は **末尾（インデックスの大きい方）から前方向へ** 行う。理由は、先に見つかった（インデックスの小さい）data URI を置換すると、それより後ろにある文字列のオフセットがずれてしまうため。降順に処理すれば、まだ処理していない前方のマッチのオフセットは常に有効なまま残る。

### バリデーションとガバナ制限対策

| 項目                | 値                                                                    |
| ------------------- | --------------------------------------------------------------------- |
| 画像1枚あたりの上限 | 2MB（`MAX_IMAGE_BYTES`）                                              |
| 画像合計の上限      | 6MB（`MAX_TOTAL_IMAGE_BYTES`）                                        |
| 許可 MIME タイプ    | `image/png`, `image/jpeg`, `image/svg+xml`, `image/gif`, `image/webp` |
| CPU時間の閾値       | 10,000ms（`CPU_TIME_THRESHOLD_MS`）                                   |
| ヒープ余裕バッファ  | 256KB（`HEAP_BUFFER_BYTES`）                                          |

画像ごとの処理ループの中で `Limits.getCpuTime()` と `Limits.getHeapSize()`（実際のガバナ上限 `Limits.getLimitHeapSize()` を基準に判定）を都度チェックし、閾値超過時は保存全体を中断してユーザーにエラーを返す。エラーは常に `AuraHandledException` としてラップされ、LWC 側で生のメッセージを表示できる。

> **既知のテストギャップ**: 2MB/6MB の境界値超過ケース、CPU/ヒープ閾値超過ケースを実際に駆動するテストは現時点で存在しない（`MarkdownImageHandlerTest.cls` にこれらのテストメソッドはない）。

## チェックリスト⇔Task 双方向同期

### マーカーIDの設計とその限界

チェックボックス行の末尾に `^[todo:xxxxxx]`（`xxxxxx` は6桁の16進数、`markdownChecklistPanel.js` の `randomMarkerId()` がクライアント側で生成）という平文マーカーを付与し、これを Markdown 本文と `Task.MarkdownMarkerId__c` の対応キーとして使う。

- マーカーはあくまで **確率的に衝突しないことを期待した**設計であり、サーバー側で一意性を強制する仕組みはない（`Task.MarkdownMarkerId__c` は `unique=false`）。6桁hex（24bit、約1670万通り）は「同一レコードのチェックリスト内で衝突する確率は実務上無視できる」という判断のコメントが実装に残っている。
- マーカーは Markdown としての構文を持たない単なる末尾テキストなので、remark/rehype パイプラインを素通りする。表示時にのみ `checkbox-transform.ts` が正規表現でマーカーを除去して非表示にする。
- `insertCheckboxMarker` はマーカー挿入時に、人間（または AI）がこのマーカーを誤って削除しないよう、フロントマター内 YAML コメント（フロントマターがある場合）または先頭の HTML コメント（ない場合）として `PRESERVE_MARKER_NOTICE_TEXT` を1回だけ冒頭に挿入する。

### Markdown → Task 方向（保存時の同期）

`MarkdownImageHandler.updateRecordField`（内部ヘルパー）は、フィールド更新の直後に必ず `MarkdownTaskSync.syncCheckboxStatesFromMarkdown(recordId, fieldApiName, value)` を呼び出す。この関数は「保存された本文を単一の正とみなし、変更差分を追跡するのではなく都度状態を突き合わせて同期する」という設計（コード内コメントに明記）。

1. 本文中の全マーカーとチェック状態を `Map<markerId, checked>` として抽出する。
2. `WhatId` + `MarkdownFieldApiName__c` + `MarkdownMarkerId__c IN (...)` で該当する `Task` を検索する。
3. `Task.IsClosed` と Markdown 側の状態が異なる Task だけを対象に、まとめて1回の `update as user` を実行する（差分がなければ DML なし）。

### Task → Markdown 方向（トリガーによる同期）

`MarkdownTaskTrigger`（`after update` のみ）→ `MarkdownTaskTriggerHandler.handleAfterUpdate` が担当する。

1. `MarkdownMarkerId__c` が空でない・`WhatId` がある・`MarkdownFieldApiName__c` が空でない・**かつ `IsClosed` が実際に変化した** Task のみを対象に絞る（Subject 変更など無関係な更新では発火しない）。
2. `WhatId + "::" + MarkdownFieldApiName__c` でグループ化し、同一レコード・同一項目に対する複数 Task の変更を1回の読み書きにまとめる。
3. `MarkdownRecordFieldAccessor.queryFieldValue` で現在の本文を読み、対象マーカーの `[ ]`/`[x]` だけを正規表現で書き換え、変化がなければ DML せずに終了する（無限ループ防止）。書き換えがあれば `updateRecordField` で1回だけ書き込む。
4. 項目が読み取り/更新不可（`FieldAccessException`）の場合は静かに何もしない（トランザクション全体を失敗させない）。

### `Activity` エンティティ経由でのフィールド追加

`Task`/`Event` に直接カスタム項目を追加しようとすると、Metadata API・Tooling API のいずれでも `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` エラーになる（一部の利用組織で固有の制約として判明）。回避策として、`Task`/`Event` 共通のフィールドコンテナである `Activity` エンティティ（`force-app/main/default/objects/Activity/fields/`）経由でカスタム項目（`MarkdownMarkerId__c` / `MarkdownFieldApiName__c`）を追加している。Apex コード上は変更なく `Task.MarkdownMarkerId__c` として参照できる。

### バルク処理の考慮

- `MarkdownTaskSync.syncCheckboxStatesFromMarkdown` は1回の呼び出しにつき1レコード・1項目分のみを扱うため、1クエリ・1バルクDMLで完結する。
- `MarkdownTaskTriggerHandler.syncMarkdownForGroup` は「同一 `(WhatId, MarkdownFieldApiName__c)` グループ内の複数 Task」はバルク安全だが、**1トランザクション内で多数の異なる親レコードにまたがる Task の一括更新**（例: 大量の Task を一括で Status 変更）が行われた場合、グループごとに1回の SOQL・DML が発生するため、対象レコードが多数（数百件規模）に及ぶ場合は SOQL/DML のガバナ制限に近づく可能性がある。現状はこの経路のバルク最適化（グループをまとめたクエリ化）は行っていない。

### 既知のエッジケースと非対応事項

| ケース                                                           | 挙動                                                                                                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| マーカーに対応する Task が存在しない                             | 「未連携（untodo）」として表示。Create Task で新規作成                                                                                                          |
| マーカーは残っているが Task が削除された                         | 「未連携」として表示され、既存マーカーを再利用して Create Task できる（新規マーカーが重複して振られることはない）                                               |
| Task の `MarkdownMarkerId__c` はあるが対応する本文行が削除された | 「孤立（orphan）」として一覧に表示し続ける                                                                                                                      |
| 同一マーカーIDが複数箇所で偶発的に重複                           | 検出・防止する仕組みはない。Markdown→Task方向は該当する全Taskに同一状態を反映するため実害が出にくいが、Task→Markdown方向は最初に見つかった1箇所のみを書き換える |
| 2方向の同期が同時に走る競合                                      | 明示的なロック（`FOR UPDATE`等）はなし。「既に同じ状態なら書き込みしない」というガードのみで、最終書き込みが勝つ形になる                                        |

## markdown-core（`packages/markdown-core`）の内部設計

TypeScript で実装された Markdown 処理パイプラインで、Vite により `force-app/main/default/staticresources/markdownCore/markdown-core.iife.js` にビルドされ、LWC からは `window.MarkdownCore` として利用する。

### レンダリングパイプライン

```mermaid
flowchart TD
    Parse["remarkParse<br/>Markdown を AST 化"] --> Gfm["remarkGfm<br/>表・打消し線・タスクリスト"]

    Gfm -->|"同期版 renderMarkdown"| Breaks["remarkBreaks"]
    Breaks --> Math["remarkMath"]
    Math --> Rehype["remarkRehype<br/>allowDangerousHtml=true"]

    Gfm -->|"非同期版 renderMarkdownAsync"| Mermaid["transformMermaidCodeBlocks<br/>mermaid コードブロックを<br/>SVGへ変換（mdast上で実施）"]
    Mermaid --> Rehype

    Rehype --> Raw["rehypeRaw"]
    Raw --> Slug["rehypeSlug"]
    Slug --> Highlight["rehypeHighlight"]
    Highlight --> Katex["rehypeKatex"]
    Katex --> Checkbox["rehypeMakeCheckboxesInteractive<br/>チェックボックスの disabled 解除<br/>data-md-line 付与"]
    Checkbox --> Sanitize["rehypeSanitize<br/>サニタイズ（セキュリティの中核）"]
    Sanitize --> StyleClean["rehypeSanitizeStyleContent<br/>style内の url()/@import 除去"]
    StyleClean --> Stringify["rehype-stringify<br/>HTML文字列を出力"]
```

_図: Markdown→HTML変換パイプライン。GFM 変換後、同期版（`renderMarkdown`）は `remarkBreaks`/`remarkMath` を経て変換するのに対し、非同期版（`renderMarkdownAsync`、`markdownViewer` が使用）はその代わりに mermaid コードブロックを mdast 上で SVG に変換するステップ（`transformMermaidCodeBlocks`）を挟んでから同じ後段（`remarkRehype` 以降）に合流する。そのため非同期版では `remarkBreaks`/`remarkMath` は適用されない。_

同期版（`renderMarkdown`）は mermaid ブロックを未変換のまま出力する（コードブロックとして表示される）。

### サニタイズ設計（セキュリティの中核）

`sanitize.ts` の `markdownSanitizeSchema` は `hast-util-sanitize` の `defaultSchema` をベースに、以下を明示的に調整している。

- **`foreignObject` を許可タグに含めない**（SVG 経由のスクリプト注入ベクターの遮断）。
- `<style>` タグ自体は許可するが、内容から `url()`・`@import`・`expression()` を正規表現で除去する（`rehypeSanitizeStyleContent`）。
- `<input>` の `required.type = 'checkbox'` のみ許可し、`defaultSchema` が強制する `disabled=true` の付与を無効化（`rehypeMakeCheckboxesInteractive` が外した `disabled` をサニタイザーが復元してしまわないようにするための調整）。
- `clobberPrefix: ''`（`hast-util-sanitize` のデフォルトの id プレフィックス付与を無効化）。Mermaid が生成する内部 CSS セレクタや `url(#id)` 参照が、id 書き換えによって壊れないようにするための調整。
- SVG 要素・属性は専用のホワイトリスト（`SVG_TAGS` / `SVG_ATTRS` / `SVG_DASHED_ATTRS`）で個別に許可する。camelCase（hast 標準）と dash-case（Mermaid が生成する生SVGマークアップ）の両方の属性名バリエーションを許可リストに含める必要がある。

Mermaid の `securityLevel` は必ず `'strict'` を維持し、`htmlLabels: false` とする（LWS 環境下で HTML ラベルの扱いに問題があるため）。この設定を緩めないことは実装上のルールとして明文化されている。

### チェックボックスのインタラクティブ化

`checkbox-transform.ts`（`rehypeMakeCheckboxesInteractive`）は、GFM タスクリストの `<li class="task-list-item">` 内の `<input type=checkbox>` から `disabled` を除去し、`data-md-line`（1-based の元本文行番号）を付与する。この行番号を `markdownViewer.js` がクリックイベントから読み取り、`toggleCheckboxLine` Apex 呼び出しの `line` 引数に使う。同時に `^[todo:xxxx]` マーカーの表示テキストもこのステップで除去する。

### Mermaid 描画の3段構成

1. **VF iframe 経由**（`mermaid-frame-compiler.ts` の `createMermaidFrameCompiler`）: `markdownViewer` の初回接続時に一度だけグローバル登録し、`/apex/MermaidRenderer` を隠しiframeとして生成し `postMessage` で描画を委譲する。LWS の Proxy membrane 配下では `mermaid.render()` の同期DOM処理が大幅に遅くなる（プレビューが「固まる」ように見える）ため、これを回避する目的。
2. **直接描画（フォールバック）**: iframe が利用できない場合、`window.mermaid`（`mermaidJs` 静的リソース）を直接呼び出す。
3. **描画不可時のフォールバック**: どちらも使えない場合は `<div class="mermaid-error">Mermaid runtime not loaded</div>` に置換し、それ以外の Markdown レンダリングは継続する。

SVGは診断ソース文字列をキーにしたLRUキャッシュ（上限50件）で再利用され、同一図が複数回登場する場合は内部 id の重複を避けるため id を書き換えて再利用する（Mermaid は id を内部の `marker`/`clipPath` 参照に埋め込むため、重複するとブラウザが2つ目以降の矢印等を解決できなくなる）。

Marp スライド内の Mermaid 図は、`MarpRenderer.page` 側で同様の理由から複数図を `Promise.all` ではなく順次 `setTimeout(...,0)` を挟んで描画する。

## iframe / postMessage 連携（LWS 回避パターン）

`marpViewer` と `markdownViewer`（Mermaid）は共通のパターンで Visualforce ページへ処理を委譲する。

- **初回コンテンツの受け渡し**（`marpViewer` のみ）: `iframe.name` に markdown 文字列を JSON エンコードして設定し、`iframe.src` を設定する前に済ませておく。これは LWS が `contentWindow` をプロキシすることに起因する不確実性を避けるための工夫（コメントに明記）。
- **以降の再描画・操作**: `window.postMessage` による双方向プロトコル。

| ページ                 | LWC→VF                                                          | VF→LWC                                                                                                 |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `MarpRenderer.page`    | `RENDER {markdown}` / `PREV` / `NEXT` / `GOTO {slide}` / `PING` | `PAGE_READY` / `PONG` / `READY {slideCount}` / `SLIDE_CHANGED {slide, slideCount}` / `ERROR {message}` |
| `MermaidRenderer.page` | `RENDER_MERMAID {id, definition}`                               | `PAGE_READY` / `MERMAID_RESULT {id, svg}` / `MERMAID_ERROR {id, message}`                              |

両ページとも `postMessage(data, "*")`（ワイルドカードオリジン）で送受信し、受信側は `event.origin` の検証を行わない。同一 org 内の自ページ（同一オリジン想定）であることを前提にした簡略化であり、セキュリティ上の考慮点として [operations.md](operations.md) に記載する。

初回読み込みと `PAGE_READY` イベントが同時に発火しうるため、両ページとも「初回送信済みフラグ」「レンダリング中フラグ」による二重描画防止のガードを持つ（二重描画は Mermaid の固定id同士が競合し、フリーズしたように見える不具合の原因になっていたため、明示的に対処している）。

## クライアント側の設計上の工夫（LWS 対応）

- **CSS ベースの疑似フルスクリーン**: LWS が `Element.requestFullscreen()` をブロックするため、`markdownEditor`・`marpViewer` はいずれも `position:fixed; inset:0` の CSS クラス切り替えでフルスクリーン相当の見た目を実現している。
- **`lwc:dom="manual"`**: `markdownViewer` はサニタイズ済み HTML を `Range.createContextualFragment` で直接 DOM に注入する。LWC の再レンダリングループとの競合を避けるため、対象コンテナを手動DOM管理にしている。
- **markdown-core のグローバル公開**: Vite ビルド時にカスタムプラグイン（`lwsGlobalExport`）で `window.MarkdownCore = MarkdownCore;` を明示的に追記している。LWS 配下では IIFE トップレベルの `var` 代入が実際の `window` に届かず、コンポーネントのプロキシ内のローカル変数になってしまうため。

## 既知の設計上のギャップ（ドキュメント化推奨事項）

以下は実装調査で判明した、今後のレビュー・改善時に踏まえておくべき点。詳細な運用上の対処は [operations.md](operations.md) を参照。

- `MermaidRenderer.page` への `pageAccesses` が `MarkdownEditorViewer` 権限セットに含まれていない（`MarpRenderer.page` のみ含む）。プロファイル側で「全ページ参照可」でない環境では Mermaid の iframe 描画が読み込めず、直接描画へのフォールバックすら効かない可能性がある。
- `postMessage` の送受信双方で `event.origin` の検証を行っていない。
- 2つの VF ページ（`MarpRenderer.page-meta.xml` / `MermaidRenderer.page-meta.xml`）の `apiVersion` は `62.0` で、`sfdx-project.json` の `sourceApiVersion`（`66.0`）や `manifest/package.xml` の `<version>`（`66.0`）と揃っていない。
- カスタムラベルのうち一部（`MarpMobileUnsupportedNotice`、`MarkdownRecordIdMissingError` 等のエラー系ラベル）はマスターの `CustomLabels.labels-meta.xml` 自体で値が空文字のまま残っている。
