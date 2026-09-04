## [1.4.1](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.4.0...v1.4.1) (2026-09-04)

### Bug Fixes

- H1レンダリング時の下線を削除 ([8644058](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/864405824f037df18d16262d86089b705c286300))
- Marp文書の通常プレビューでMarkdownが二重表示される不具合を修正 ([bda8ba9](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/bda8ba9145fe186d96c9614bddac0180a89e6890))

## [1.4.0](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.3.0...v1.4.0) (2026-08-29)

### Features

- 画像ズームポップアップにホイール/ボタン/ダブルクリック/キーボードでの拡大縮小とドラッグパンを追加 ([04605ff](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/04605ff83d7f1fd0f021da179729fb368553b84e))

## [1.3.0](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.2.2...v1.3.0) (2026-08-28)

### Features

- markdownViewerでプレビュー画像クリック時のポップアップ拡大表示に対応 ([3259ed7](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/3259ed744826fac3f1679757a1ebbae06c2cb506))

## [1.2.2](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.2.1...v1.2.2) (2026-08-25)

### Bug Fixes

- 同一Base64画像の重複アップロードを防止 ([60079e7](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/60079e741d5e45240f7160d4554ec4d63132a293))

## [1.2.1](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.2.0...v1.2.1) (2026-08-25)

### Bug Fixes

- details/summaryの開閉マーカーが分かりにくい問題を解消 ([c38dec6](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/c38dec667ebae821f415d1b0e22b87ad1b03deb1))
- postMessage送信元偽装・base64画像検証の2件のガバナ制限違反・エラーメッセージ欠落を解消 ([15236d6](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/15236d6db27b5a1443962f048d12796cec5a0a26))

## [1.2.0](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.1.1...v1.2.0) (2026-08-19)

### Features

- **checklist:** チェックリストの列分けと作成時リマインダー設定に対応 ([224b506](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/224b506d52bfddea2a9c10b7ac5849d078937621)), closes [#2](https://github.com/jsugawara-keizu/sf-markdown-editor/issues/2)

### Bug Fixes

- MermaidRenderer権限セット未設定・apiVersion不統一・i18n未整備・成果物不整合・詳細開閉インジケーター・保存失敗の非通知を解消 ([ceb9cb7](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/ceb9cb78af4f69938d3b5116bb58f03d7fe1e646))

## [1.1.1](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.1.0...v1.1.1) (2026-08-17)

### Bug Fixes

- **test:** メソッドシグネチャ変更に合わせてテストの引数を更新 ([dd0025e](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/dd0025e5dca2d94ebeaa43687f2284a83dbbc3ed))

## [1.1.0](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.0.1...v1.1.0) (2026-08-14)

### Features

- markdownChecklistPanel - タスク登録時に期日(ActivityDate)を指定可能にする ([0197220](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/01972203d8c949298e1c771af5100e532a83c62a))

### Bug Fixes

- Marp文書を通常プレビューに切替時にチェックリストパネルが表示されない不具合を修正 ([9b7dcca](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/9b7dcca9354438107b97a351a1809bc0fa5ced63))

## [1.0.1](https://github.com/jsugawara-keizu/sf-markdown-editor/compare/v1.0.0...v1.0.1) (2026-08-13)

### Bug Fixes

- **test:** MarkdownTaskSyncTestのAccount名を一意化し重複ルール抵触を回避 ([2077291](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/20772916b1222355be4a0f25a432a8ffae2c3eaa))

## 1.0.0 (2026-08-12)

### Features

- markdownEditor から埋め込みチェックリストパネルの編集項目を設定可能に ([abeb0c1](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/abeb0c1560be8215367676ec81207e6c9b2824cb))
- **markdownEditor:** 編集/プレビュータブへのアイコン追加とプレビュー全画面表示対応 ([0322cc9](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/0322cc9ced5615f1001e2755079585c3811db5db))
- **markdownViewer:** Preview時にYAMLフロントマターを非表示にする ([5edeae7](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/5edeae75caaa764aa518f836f47544d63c17241d))
- **marp:** marpViewer LWC + MarpRenderer VF + marpCore static resource ([6c14593](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/6c1459336de1095085cb6bab789969d5633c01f3))
- **marp:** Mermaid図のレンダリングに対応 ([2fbeb9c](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/2fbeb9ce94d714f8c4be4fd4772196cbc9a309a9))
- marpViewer LWC + MarpRenderer VF による Marp スライドレンダリング対応 (#T-009431) ([9770093](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/9770093fb971d58889777eaba25a37db719f3113)), closes [#T-009431](https://github.com/jsugawara-keizu/sf-markdown-editor/issues/T-009431)
- **marpViewer:** Marp スライド内リンクを別タブで開く ([f18b211](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/f18b211b37115745ddf6710cba66fac633d5e7c5))
- **marpViewer:** カスタムラベル4件追加・翻訳ファイル対応 ([8fc2837](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/8fc2837830db9a6e4e8240931f36a9ae6f7d4b8f))
- **marpViewer:** 全画面表示切り替えボタンを追加 ([4cb3ff1](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/4cb3ff150b67282f2e27535ed58475e074030bf4))
- **permissions:** MarpRenderer VF ページアクセス権を権限セットに追加 ([f94f6c8](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/f94f6c8396b71233d82644f08432e5b2ecb8d31a))
- Task ホバー編集ポップオーバーの保存完了をトースト＋自動クローズで通知 ([d37c241](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/d37c241ce776e2bbb728a6ba3437668cf1d687ea))
- チェックボックス⇔Taskマーカーの保護とTaskホバープレビューを追加 ([dd5fae5](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/dd5fae5c5a879de21e4ff06bc0ba746921d30e6e))
- チェックリスト/Task編集ポップオーバーの仕様不足を解消 ([a47941d](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/a47941d7e4205c0531e7b93e5929da0fe148ab66))
- チェックリストパネルのホバープレビューに編集可能項目の設定を追加 ([73b2b3b](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/73b2b3bc73e89d4d1f48c153103572a748ed5d98))
- プレビューのチェックボックス編集とTask連携（Markdown⇔Task双方向同期）を実装 ([d8008ac](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/d8008ac69dd2aa4ea1f6197c9a14c17954565a80))
- モバイルではMarpスライド表示を無効化しドキュメント表示にフォールバック ([655294d](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/655294d20a2f0d39135653117fed64be6cb731bd))

### Bug Fixes

- LWCにsupportedFormFactorsを追加しスマートフォンでの表示ブロックを解消 ([0285119](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/02851190e23833da68472760ce168ca1cdf1c110))
- **marp-core:** fs モジュールをスタブに差し替え（existsSync null クラッシュ修正） ([1689063](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/1689063a1a4e7ed516be8b4d6279c1a87bd85ede))
- **marp:** catch ブロック閉じ括弧を修正（prettierによる欠落） ([8fe71d9](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/8fe71d9fff181a693334ba9479d2c7a93fba4e52))
- **marp:** display:none→visibility:hidden に変更、クラス名をmarp-visibleに（Marpスタイル競合修正） ([8a05660](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/8a0566022c3cd0f91f4e5a254e4cfed7f8cc44cd))
- **marp:** head CSS の section display:none を削除（marp-styleと競合解消） ([73d2bbd](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/73d2bbd4a3d70d613228320b2d6e45b8917de521))
- **MarpRenderer:** display:table を強制指定してテーブル高さ崩れを修正 ([860f44e](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/860f44e5453eb492affc931367bdc35f431eef73))
- **MarpRenderer:** flex-start 変更で崩れたテーブル高さを修正 ([0d621ed](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/0d621ed3fb44c331bd679065427e68dd441bc70e))
- **MarpRenderer:** mermaid.render() で個別レンダリング・showSlide 非同期対応 ([ce86c90](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/ce86c90dd87f0f3193ce17ec2b3f6a14239aa529))
- **MarpRenderer:** section に justify-content: flex-start を追加して上端切れを修正 ([cf73b97](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/cf73b978d6908b3f3f7c88facd1358f19fb928bd))
- **MarpRenderer:** section/table CSS を Marp result.css の後に注入して優先度を確保 ([2ea5dd0](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/2ea5dd04566a4b1491b12900de7129c543a536be))
- **marp:** section→svg[data-marpit-svg]を切り替え（Marp HTML構造対応） ([64b0641](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/64b0641136f1304d893055c89719595a248eed2e))
- **marp:** style.setProperty で !important を直接書き込み（CSS競合完全排除） ([d3deb19](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/d3deb19b23de37cb11e0eed38513c3d75ece374d))
- **marpViewer:** \_slideCount/\_currentSlide を [@track](https://github.com/track) に変更（ナビゲーション修正） ([358b930](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/358b9302fc1184ca432d9a33a97e9338315e8de5))
- **marpViewer:** aspect-ratio: 16/9 を復元して上部コンテンツ切れを修正 ([17e2af4](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/17e2af41a050968b06af408821e9ceee6e9f869d))
- **marpViewer:** iframe onload でRENDERを送信（LWS postMessage受信問題の回避） ([987c23a](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/987c23ad76da53e377f7955bebc408c727548272))
- **marpViewer:** LWS対応のCSS擬似フルスクリーンに切り替え ([03f67b9](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/03f67b96516528163084feb09ab4256f2f09e635))
- **marpViewer:** max-height を marp-aspect に移動して縦スクロールを有効化 ([2698208](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/2698208d8a6fbae8b9ec68f036d4847ef37a819e))
- **marpViewer:** スライドが縦長の場合に上下スクロールできるよう max-height を追加 ([5f5fbe8](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/5f5fbe8701ee0f7edbf72d8cb1ad5bcc7b0f443e))
- **marpViewer:** ドックモード時に通常Markdownプレビューを表示 ([a993049](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/a99304996c09e83e63c99be80c221d99880b9621))
- **marpViewer:** 全画面ラベルのハードコードをカスタムラベルに置き換え ([9e3f079](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/9e3f079cd57ef709fd881758c8b09a2c003baeef))
- **marpViewer:** 全画面状態でドキュメントモードに切り替えた際に全画面を解除する ([68c061c](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/68c061c72fbf09a2618378290510cc146da72d2a))
- **marpViewer:** 縦スクロール対応 — 固定高さ + section スクロール ([2087223](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/2087223e27097b4fff2bf41dfbb1736441c357c1))
- **marp:** window.name でマークダウンを渡す（LWS postMessage回避） ([96e01b0](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/96e01b06b3a00e475b57d275b5b9c7a5b1ba35d2))
- Marp表示時に最大化ボタンが2つ表示される問題を修正 ([135371b](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/135371bf8627adb878c817cfaa809ff66027e4d2))
- Marp表示時に最大化ボタンが2つ表示される問題を修正 ([bd60608](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/bd60608cef040ee458425429cb242283b4fe842a))
- Mermaid複数図でブラウザが停止する問題を解消 ([e9c7f64](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/e9c7f64f91c1e1199837b45b085c836e549f18c0))
- package.xml から Translations を除去（別マニフェストで管理） ([d32ed44](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/d32ed44f236db11c35a75083cba0e591215e9e71))
- Task ホバー編集ポップオーバーの保存が効かない不具合を修正 ([ee4f13b](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/ee4f13b828942d48eeb78599a5fe65df31c356f1))
- YAML frontmatter付き文書でチェックボックス切替が保存されない不具合を修正 ([473e98a](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/473e98a138ea1ffcff45c57eca2b6431524c667e))
- チェックリストパネルの「タスク作成」がMarkdownエディタ埋め込み時に永続化されない不具合を修正 ([84a2814](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/84a2814d4832c59b57610668ab9bf32993c3355f))
- プレビューのチェックボックス切替を即時保存するよう変更 ([a8bdd1e](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/a8bdd1e9c1c475900184bc6bb5280e7475540d5b))
- 保存後にチェックリストパネルのTaskステータスがその場で更新されない不具合を修正 ([2d458ca](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/2d458caed6ea0b275af621eb86e2ebe11291a8df))
- 非MarpのMermaid図をLWS外の隠しVFフレームで描画しフリーズを解消 ([06a7fab](https://github.com/jsugawara-keizu/sf-markdown-editor/commit/06a7fabe48681f79880a608b9bf348637da97ea1))
