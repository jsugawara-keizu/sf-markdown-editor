# 要望事項

`sf-markdown-editor` に対して起票されている機能要望を管理するドキュメント。実装済みになったら「状態」を更新し、対応内容を関連 PR / コミットにリンクする。

## 一覧

### 1. チェックボックスと ToDo（Task）レコードの双方向同期

- **状態**: 実装案検討済み
- **内容**:
  - Markdown 内のチェックボックス表記（`- [ ]` / `- [x]`）から ToDo（Task）レコードを自動的に作成できるようにしたい。
  - Markdown 側のチェック ON/OFF と ToDo レコードの完了状態（`Status`）が双方向で同期するようにしたい。
- **現状の関連実装**:
  - `packages/markdown-core/src/renderer.ts` の `remark-gfm` が `- [ ]` / `- [x]` を既にタスクリストとして解釈済み。`sanitize.ts` も `input[type=checkbox][disabled]` を許可済み（ただし `disabled` 固定で操作不可）。
  - Task/ToDo に相当するオブジェクトはこのリポジトリに存在せず、新規に対応が必要。
- **確定した実装方針（改訂: 自動作成 → 明示的な UI 操作に変更）**:
  - 当初案（保存時に全チェックボックスを自動で Task 化）ではなく、**LWC 上に「タスク作成」ボタンを持つチェックリストパネルを追加**し、ユーザーが行ごとに明示的に Task 化する UI に変更する。
  - **チェックリストパネル**（新規コンポーネント、例: `markdownChecklistPanel`。`MarkdownEditor` のプレビュー領域および単体配置の `MarkdownViewer` の両方から利用できる形で切り出す）:
    - 表示する一覧は、次の2つのソースを**マーカー ID でマージ**して作る（どちらか一方だけでは不十分なため）:
      1. 現在の Markdown 本文から抽出したチェックボックス行（テキスト・チェック状態・マーカー有無）
      2. この記録・項目（`WhatId` + `MarkdownFieldApiName__c`）に紐づく Task を Apex で一括クエリした結果（Markdown 側に対応する行が残っているかは問わない）
    - マージ結果の行種別は3パターン:
      - **未 ToDo 化**: Markdown 側にチェックボックス行はあるが、マーカー・Task が存在しない。「未作成」バッジ＋「タスク作成」ボタン（+ 割当先指定、後述）を表示。
        - **前提**: 全てのチェックボックスが ToDo 化されるわけではない。ユーザーが個別に「タスク作成」を押した行のみが Task 化される想定であり、このパネルは「まだ ToDo 化していない行がどれか」を可視化することが主目的の一つ。
      - **ToDo 化済み**: マーカーが Markdown 側に存在し、対応する Task も存在する。Task の `Status` / `IsClosed`（未完了/完了バッジ）と担当者名を表示。クリックで Task レコードへ遷移できるようにする。
      - **関連チェックボックスなし（孤立 Task）**: Task は存在する（＝過去に ToDo 化された）が、対応するマーカーが現在の Markdown 本文から見つからない＝ユーザーがチェックボックス行自体を削除した状態。この Task 行を一覧から消さず、「関連チェックボックスなし」バッジ付きで表示し続ける（Task の存在自体が見えなくなることを防ぐ）。
    - 一覧全体の先頭または末尾に「未 ToDo 化: N件」「完了: N件 / 未完了: N件」「関連チェックボックスなし: N件」のようなサマリーを表示し、対応漏れ・未完了タスク・孤立 Task の見落としを防ぐ。
    - 抽出には `packages/markdown-core` に軽量な抽出ユーティリティ（例: `extractCheckboxItems(markdown)`）を追加し、remark の AST からチェックボックス行とマーカー（後述）を取り出す。
    - Task 側の一括取得は、`MarkdownMarkerId__c` の値一覧でフィルタするのではなく、**`WhatId` + `MarkdownFieldApiName__c` で当該項目に紐づく Task を全件取得**する（削除されたチェックボックスの Task も取得対象に含める必要があるため）。
  - **対象オブジェクト**: 標準 `Task` オブジェクトを利用する（新規カスタムオブジェクトは作らない）。
    - `WhatId` で Markdown を保持する親レコードに紐付け。
    - `Subject` = チェックボックス行のテキスト、`Status` / `IsClosed` = チェック状態。
    - 追加カスタム項目（`force-app/main/default/objects/Task/fields/` に新規作成）:
      - `MarkdownMarkerId__c`（Text）— チェックボックス行に埋め込むマーカーと1対1対応する識別子
      - `MarkdownFieldApiName__c`（Text）— 親レコードのどの長文項目（Markdown 本文）由来かを記録。同一レコードに複数 Markdown 項目がある場合の曖昧さ回避のため
  - **チェックボックス行の識別方式**: 行番号ではなく、行末に埋め込む非表示マーカーで識別する（この仕組み自体は変更なし）。
    ```markdown
    - [ ] 資料をレビューする ^[todo:8f1a2b]
    ```
    行番号だけでは行の挿入・削除で対応がズレるため、マーカー方式を採用する。
    - `packages/markdown-core` のレンダリングパイプラインに rehype プラグインを追加し、`^[todo:xxxx]` をプレビュー表示からは隠す。
    - マーカーは自動作成ではなく、**「タスク作成」ボタン押下時に初めて発行・挿入する**（未紐付けの行にはマーカー自体が存在しない状態が正）。
  - **未 ToDo 化の行における割当先指定 + ワンクリック作成**:
    - 未紐付けの行には「タスク作成」ボタンに加えて、割当先（`Task.OwnerId`）を選ぶ小さなユーザー選択コントロール（`lightning-record-picker`、対象オブジェクト `User`）をインラインで表示する。
    - デフォルト値は実行ユーザー（自分）とし、必要な場合のみ変更する運用を想定。割当先を選び直した後に「タスク作成」ボタンを押すことで、選択した担当者で Task が作成される（作成自体はボタン押下のワンクリックで完結する）。
  - **「タスク作成」ボタンの処理フロー**:
    1. クライアント側でマーカー ID を生成し、対象チェックボックス行の末尾に挿入（ソース Markdown を更新）。
    2. 新規 Apex メソッド（例: `MarkdownTaskSync.createTaskForCheckbox(recordId, objectApiName, fieldApiName, markerId, subject, checked, ownerId)`）を呼び出し、指定された `ownerId` を `Task.OwnerId` にセットして Task を作成。`MarkdownMarkerId__c` / `MarkdownFieldApiName__c` もあわせてセットして返却。
    3. マーカー挿入後の Markdown 本文を永続化する（`MarkdownEditor` 埋め込み時は通常の Save フローに乗せる。`MarkdownViewer` 単体配置時は即時保存 API を呼ぶ）。
    4. 一覧の当該行に、作成された Task の担当者名も表示する（他ユーザーへ割り当てた場合に誰の対応待ちかが分かるようにするため）。
    5. チェックリストパネルの該当行を「ToDo 化済み」表示に更新する。
  - **チェック状態の同期フロー**（Task 作成後、双方向）:
    1. **Markdown → Task**: チェックボックスのチェック状態が変化した保存時（要望2のクリック切替、または通常の編集保存）に、変更があったマーカー付き行を検出し、対応する Task の `Status` / `IsClosed` を更新する。
    2. **Task → Markdown**（`Task` の `Status` 変更トリガーで検知）:
       - `MarkdownMarkerId__c` / `MarkdownFieldApiName__c` を持つ Task の `Status` 変更を検知。
       - `WhatId` の対象レコード・項目から Markdown 本文を取得し、該当マーカー行のみ `[ ]` ⇄ `[x]` を置換して書き戻す。
       - **ループガード必須**: 同期処理自身が書いた内容でトリガーが再発火しないよう、直前の書き込み内容とのハッシュ比較等でスキップ判定する。
    - チェックボックス行が削除された場合、対応する Task はそのまま残す（自動クローズ・自動削除はしない。安全側の既定動作）。
  - **依存関係**: 下記「2. プレビュー画面からのチェックボックス On/Off 切り替え」のフェーズ1で導入するレンダリング基盤（チェックボックスをクリック可能にする仕組み）の上に、チェックリストパネル・Task 作成・同期を追加する構成とする。

### 2. プレビュー画面からのチェックボックス On/Off 切り替え

- **状態**: 実装案検討済み
- **内容**:
  - `MarkdownViewer`（プレビュー表示）のチェックボックスをクリックするだけで On/Off を切り替えられるようにしたい。
  - 現状はレンダリングされたチェックボックスが読み取り専用。
- **現状の関連実装**:
  - `MarkdownEditor` のプレビューは内部で `<c-markdown-viewer>` を埋め込んで共有しているため、`MarkdownViewer` 側を1箇所直せば Editor のプレビュー・単体配置の Viewer 両方に効く。
  - `markdownViewer.js` は `lwc:dom="manual"` の div にレンダリング結果を注入しており、既存のクリックハンドラは TOC 用アンカーリンクのみ（チェックボックス用の delegated click は未実装）。
  - 保存は `MarkdownImageHandler.saveMarkdownWithImages`（Apex）が recordId / objectApiName / fieldApiName を汎用的に受け取る動的更新方式。
- **確定した実装方針**:
  1. `remark-rehype` 後に rehype プラグインを追加し、各 `li.task-list-item` 内の `input[type=checkbox]` から `disabled` を除去し、remark の position 情報から得たソース行番号を `data-md-line` 属性として付与する。
  2. `sanitize.ts` のスキーマに `data-md-line` を許可属性として追加する。
  3. `markdownViewer.js` の content div に delegated click listener を追加し、`input[type=checkbox]` のクリックを検知して `data-md-line` を読み取り、`CustomEvent('mdcheckboxtoggle', {detail: {line, checked}})` を dispatch する。
  4. 書き戻し方法は配置パターンに応じて2通り実装する:
     - **(a) `MarkdownEditor` に埋め込まれている場合**: イベントを Editor 側で受け取り、保持しているソース Markdown 文字列の対象行のみ `[ ]` ⇄ `[x]` 置換。未保存状態として扱い、明示的な Save 操作で永続化する。
     - **(b) `MarkdownViewer` を単体配置している場合**（レコードページ等）: ソース文字列を保持していないため、新規 Apex メソッド（例: `MarkdownImageHandler.toggleCheckboxLine(recordId, fieldApiName, line, checked)`）でサーバー側に現在値を読ませ、対象行のみ置換して即時保存・即時反映する。
- **フェーズ計画**（要望1・2をまたぐ全体スケジュール）:

  | フェーズ | 内容                                                                                                                | 依存                        |
  | -------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- |
  | 1        | プレビューでのチェックボックス クリック切替（本項目。行番号ベースで先行実装可）                                     | なし                        |
  | 2        | チェックリストパネル（`markdownChecklistPanel`）の追加、「タスク作成」ボタンによる Task 作成・マーカー付与（要望1） | フェーズ1のレンダリング基盤 |
  | 3        | チェック状態の双方向同期（Markdown ⇄ Task の `Status`、要望1）                                                      | フェーズ2                   |

  フェーズ1は本要望単体でも価値があるため先行させ、フェーズ2でチェックリストパネルと明示的な Task 作成 UI を追加し、フェーズ3で双方向のステータス同期を追加する。

### 3. タグ（`<details>` 等）のサポート状況確認と開閉可能インジケーター表示

- **状態**: 未着手
- **内容**:
  - Markdown 内の HTML タグ（`<details>` / `<summary>` 等）について、現状どこまでサポートされているかが不明瞭という問い合わせがあった。
  - 要望は「トグル UI を新規に追加してほしい」という趣旨ではなく、`<details>` / `<summary>` が**開閉可能な要素であることが見た目でわかる表示**にしてほしい、というもの（矢印・アイコン等のインジケーター不足が想定される）。
- **要調査事項**:
  - `packages/markdown-core` の `sanitize.ts` で `details` / `summary` タグ・属性が許可されているか確認する。
  - 許可されている場合、`markdownViewer` 側のスタイル（`<summary>` の開閉インジケーター、例えば `::marker` やカーソル形状）が既存 SLDS と整合し、開閉可能であることが視覚的に伝わるか確認する。
  - 不足していれば `markdownViewer` の CSS（または `sanitize.ts` の許可属性）を調整する。
