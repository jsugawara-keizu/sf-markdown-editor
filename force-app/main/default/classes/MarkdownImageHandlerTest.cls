@IsTest
private class MarkdownImageHandlerTest {
  private static final String PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  private static final String JPG_B64 = 'AAAAAAAA';
  private static final String SVG_B64 = 'PHN2Zy8+';

  private static Account makeAccount() {
    Account a = new Account(Name = 'Markdown Test Account');
    insert a;
    return a;
  }

  // Builds a valid-base64-charset string of an exact length via doubling
  // (O(length) total work) instead of naive concatenation in a loop
  // (O(length^2) with Apex's immutable strings), so million-character
  // strings for the MB-scale threshold tests below stay fast.
  private static String buildBase64String(Integer length) {
    String chunk = 'A';
    while (chunk.length() < length) {
      chunk += chunk;
    }
    return chunk.substring(0, length);
  }

  @IsTest
  static void saveMarkdownWithoutImages_returnsOriginalAndUpdatesField() {
    Account a = makeAccount();
    String md = '# Hello\n\nNo images here.';

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      md
    );
    Test.stopTest();

    System.assertEquals(md, result, 'No data URI — 元の Markdown が返るべき');
    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      md,
      reloaded.Description,
      'フィールドへ保存されているべき'
    );
    System.assertEquals(
      0,
      [SELECT COUNT() FROM ContentVersion],
      '画像が無ければ CV は作られない'
    );
  }

  @IsTest
  static void saveMarkdownWithSingleImage_replacesUriAndCreatesContentDocument() {
    Account a = makeAccount();
    String dataUri = 'data:image/png;base64,' + PNG_B64;
    String md = '![alt](' + dataUri + ')';

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      md
    );
    Test.stopTest();

    System.assert(
      !result.contains('data:image/png'),
      'data URI が残っていてはいけない'
    );
    System.assert(
      result.contains('/sfc/servlet.shepherd/document/download/'),
      'download URL に置換されているべき'
    );

    List<ContentVersion> cvs = [
      SELECT Id, Title, PathOnClient, ContentDocumentId
      FROM ContentVersion
    ];
    System.assertEquals(1, cvs.size(), 'CV は 1 件');
    System.assert(cvs[0].Title.startsWith('md-image-'), 'Title 命名規則');
    System.assertEquals('md-image-0.png', cvs[0].PathOnClient, 'PathOnClient');

    List<ContentDocumentLink> links = [
      SELECT ContentDocumentId
      FROM ContentDocumentLink
      WHERE LinkedEntityId = :a.Id
    ];
    System.assertEquals(1, links.size(), 'CDL が親レコードに紐付いているべき');
    System.assertEquals(cvs[0].ContentDocumentId, links[0].ContentDocumentId);

    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      result,
      reloaded.Description,
      '置換後の Markdown が保存されている'
    );
  }

  @IsTest
  static void saveMarkdownWithMultipleImages_handlesAllMimeTypes() {
    Account a = makeAccount();
    String md =
      '![p](data:image/png;base64,' +
      PNG_B64 +
      ')\n' +
      '![j](data:image/jpeg;base64,' +
      JPG_B64 +
      ')\n' +
      '![s](data:image/svg+xml;base64,' +
      SVG_B64 +
      ')';

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      md
    );
    Test.stopTest();

    System.assert(
      !result.contains('data:image/'),
      '全ての data URI が置換されているべき'
    );

    List<ContentVersion> cvs = [
      SELECT PathOnClient
      FROM ContentVersion
      ORDER BY PathOnClient ASC
    ];
    System.assertEquals(3, cvs.size(), '3 件の CV が作成される');

    Set<String> paths = new Set<String>();
    for (ContentVersion cv : cvs) {
      paths.add(cv.PathOnClient);
    }
    System.assert(paths.contains('md-image-0.png'));
    System.assert(paths.contains('md-image-1.jpg'));
    System.assert(paths.contains('md-image-2.svg'));
  }

  @IsTest
  static void saveMarkdownWithUnsupportedImageType_throwsFriendlyAuraHandledException() {
    Account a = makeAccount();
    String md = '![txt](data:text/plain;base64,' + PNG_B64 + ')';

    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(
        a.Id,
        'Account',
        'Description',
        md
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'サポート外 MIME タイプは例外を投げるべき');
  }

  @IsTest
  static void saveMarkdown_withNullRecordId_throwsAuraHandledException() {
    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(
        null,
        'Account',
        'Description',
        'hello'
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'recordId が null なら例外を投げる');
  }

  @IsTest
  static void saveMarkdown_withBlankFieldApiName_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(a.Id, 'Account', '', 'hello');
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'fieldApiName が空なら例外を投げる');
  }

  @IsTest
  static void saveMarkdown_withMismatchedObjectApiName_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(
        a.Id,
        'Contact',
        'Description',
        'hello'
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'recordId と objectApiName が不一致なら例外を投げる');
  }

  @IsTest
  static void saveMarkdown_withBlankObjectApiName_savesSuccessfully() {
    Account a = makeAccount();
    String md = '# No object filter';

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      '',
      'Description',
      md
    );
    Test.stopTest();

    System.assertEquals(
      md,
      result,
      'blank objectApiName should still save content'
    );
    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(md, reloaded.Description, 'フィールドに保存されるべき');
  }

  @IsTest
  static void saveMarkdown_withNullMarkdownContent_updatesFieldToEmpty() {
    Account a = makeAccount();

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      null
    );
    Test.stopTest();

    System.assertEquals(
      '',
      result,
      'null markdownContent should be treated as empty string'
    );
    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      null,
      reloaded.Description,
      'フィールドには空文字列が保存されるべき（Salesforceでは null として保存される）'
    );
  }

  @IsTest
  static void saveMarkdown_withNonUpdateableField_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(
        a.Id,
        'Account',
        'CreatedDate',
        'hello'
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, '更新不可能フィールドは例外を投げるべき');
  }

  @IsTest
  static void saveMarkdown_withInvalidField_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(
        a.Id,
        'Account',
        'NotARealField__c',
        'hello'
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, '存在しないフィールドなら例外を投げる');
  }

  @IsTest
  static void extractDataUris_returnsEmptyListForBlank() {
    System.assertEquals(
      0,
      MarkdownImageHandler.extractDataUris(null).size(),
      'null なら空'
    );
    System.assertEquals(
      0,
      MarkdownImageHandler.extractDataUris('').size(),
      '空文字なら空'
    );
  }

  @IsTest
  static void extractDataUris_parsesMimeAndBase64() {
    String md = 'before data:image/png;base64,' + PNG_B64 + ' after';
    List<MarkdownImageHandler.DataUriMatch> matches = MarkdownImageHandler.extractDataUris(
      md
    );
    System.assertEquals(1, matches.size());
    System.assertEquals('image/png', matches[0].mimeType);
    System.assertEquals(PNG_B64, matches[0].base64Data);
  }

  @IsTest
  static void mimeTypeToExtension_handlesCommonAndEdgeCases() {
    System.assertEquals(
      'png',
      MarkdownImageHandler.mimeTypeToExtension('image/png')
    );
    System.assertEquals(
      'jpg',
      MarkdownImageHandler.mimeTypeToExtension('image/jpeg'),
      'jpeg→jpg'
    );
    System.assertEquals(
      'svg',
      MarkdownImageHandler.mimeTypeToExtension('image/svg+xml'),
      '+xml 除去'
    );
    System.assertEquals('bin', MarkdownImageHandler.mimeTypeToExtension(null));
    System.assertEquals(
      'bin',
      MarkdownImageHandler.mimeTypeToExtension('garbage')
    );
  }

  @IsTest
  static void replaceFirst_replacesOnlyFirstOccurrence() {
    System.assertEquals(
      'abc-YY-def-XX-ghi',
      MarkdownImageHandler.replaceFirst('abc-XX-def-XX-ghi', 'XX', 'YY')
    );
  }

  @IsTest
  static void replaceFirst_returnsSourceWhenNotFound() {
    System.assertEquals(
      'no match',
      MarkdownImageHandler.replaceFirst('no match', 'NOPE', 'YES')
    );
  }

  @IsTest
  static void replaceFirst_handlesNullInputs() {
    System.assertEquals(
      null,
      MarkdownImageHandler.replaceFirst(null, 'a', 'b')
    );
    System.assertEquals(
      'hello',
      MarkdownImageHandler.replaceFirst('hello', null, 'b')
    );
  }

  @IsTest
  static void toggleCheckboxLine_togglesTargetLineAndPersists() {
    Account a = makeAccount();
    String md = '# Title\n- [ ] first\n- [x] second\n- [ ] third';
    update new Account(Id = a.Id, Description = md);

    Test.startTest();
    String result = MarkdownImageHandler.toggleCheckboxLine(
      a.Id,
      'Account',
      'Description',
      2,
      true
    );
    Test.stopTest();

    System.assertEquals(
      '# Title\n- [x] first\n- [x] second\n- [ ] third',
      result,
      '対象行のみチェック状態が反転しているべき'
    );
    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(result, reloaded.Description, '即時保存されているべき');
  }

  @IsTest
  static void toggleCheckboxLine_uncheckTogglesBack() {
    Account a = makeAccount();
    update new Account(Id = a.Id, Description = '- [x] only item');

    Test.startTest();
    String result = MarkdownImageHandler.toggleCheckboxLine(
      a.Id,
      'Account',
      'Description',
      1,
      false
    );
    Test.stopTest();

    System.assertEquals('- [ ] only item', result);
  }

  @IsTest
  static void toggleCheckboxLine_withNonCheckboxLine_returnsUnchanged() {
    Account a = makeAccount();
    String md = '# Not a checkbox line';
    update new Account(Id = a.Id, Description = md);

    Test.startTest();
    String result = MarkdownImageHandler.toggleCheckboxLine(
      a.Id,
      'Account',
      'Description',
      1,
      true
    );
    Test.stopTest();

    System.assertEquals(md, result, '対象行がチェックボックスでなければ変更しない');
  }

  @IsTest
  static void toggleCheckboxLine_withNullLine_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.toggleCheckboxLine(a.Id, 'Account', 'Description', null, true);
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'line が null なら例外を投げる');
  }

  @IsTest
  static void toggleCheckboxAtLine_preservesTrailingNewline() {
    String md = '- [ ] a\n- [ ] b\n\n';
    String result = MarkdownImageHandler.toggleCheckboxAtLine(md, 2, true);
    System.assertEquals(
      '- [ ] a\n- [x] b\n\n',
      result,
      '末尾の改行・空行は維持されるべき'
    );
  }

  @IsTest
  static void toggleCheckboxAtLine_withOutOfRangeLine_returnsUnchanged() {
    String md = '- [ ] only line';
    System.assertEquals(
      md,
      MarkdownImageHandler.toggleCheckboxAtLine(md, 5, true)
    );
  }

  @IsTest
  static void queryFieldValue_withInaccessibleField_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownImageHandler.toggleCheckboxLine(a.Id, 'Account', 'NotARealField__c', 1, true);
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, '存在しないフィールドなら例外を投げる');
  }

  @IsTest
  static void saveMarkdownWithImages_syncsTaskStatusForCheckedMarker() {
    Account a = makeAccount();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Description',
      'ab12cd',
      'review docs',
      false,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      '- [x] review docs ^[todo:ab12cd]'
    );
    Test.stopTest();

    Task reloaded = [SELECT IsClosed FROM Task WHERE Id = :row.id];
    System.assertEquals(
      true,
      reloaded.IsClosed,
      'saveMarkdownWithImages の保存後、対応する Task が Sync されるべき'
    );
  }

  @IsTest
  static void toggleCheckboxLine_syncsTaskStatusForCheckedMarker() {
    Account a = makeAccount();
    update new Account(
      Id = a.Id,
      Description = '- [ ] review docs ^[todo:ab12ce]'
    );
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Description',
      'ab12ce',
      'review docs',
      false,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    MarkdownImageHandler.toggleCheckboxLine(a.Id, 'Account', 'Description', 1, true);
    Test.stopTest();

    Task reloaded = [SELECT IsClosed FROM Task WHERE Id = :row.id];
    System.assertEquals(
      true,
      reloaded.IsClosed,
      'toggleCheckboxLine の保存後、対応する Task が Sync されるべき'
    );
  }

  // ── Base64バリデーション（Pattern.matches の「Regex too complicated」回避）──

  @IsTest
  static void isValidBase64_withNoPadding_returnsTrue() {
    System.assert(MarkdownImageHandler.isValidBase64('QUJD'), 'パディング無しの正常な base64 は true');
  }

  @IsTest
  static void isValidBase64_withValidPadding_returnsTrue() {
    System.assert(MarkdownImageHandler.isValidBase64('QUI='), '末尾1文字パディングは true');
    System.assert(MarkdownImageHandler.isValidBase64('QQ=='), '末尾2文字パディングは true');
  }

  @IsTest
  static void isValidBase64_withInteriorPadding_returnsFalse() {
    System.assert(
      !MarkdownImageHandler.isValidBase64('QU=JD'),
      '末尾以外に "=" があれば不正な base64 として拒否する'
    );
  }

  @IsTest
  static void isValidBase64_withBlank_returnsFalse() {
    System.assert(!MarkdownImageHandler.isValidBase64(null));
    System.assert(!MarkdownImageHandler.isValidBase64(''));
  }

  @IsTest
  static void isValidBase64_withLargePayloadPastOldRegexLimit_doesNotThrow() {
    // 1,500,000文字は、以前の Pattern.matches('[A-Za-z0-9+/]+=*', ...) 実装が
    // 実際にこの org で「System.LimitException: Regex too complicated」を
    // 投げ始めるサイズ（2MB上限＝約2,796,204文字よりずっと小さい）。
    // ここでは例外を投げずに判定できることを確認する。
    String largePayload = buildBase64String(1500000);
    Boolean result;
    try {
      result = MarkdownImageHandler.isValidBase64(largePayload);
    } catch (System.LimitException le) {
      System.assert(
        false,
        'Pattern.matches 由来の Regex too complicated が再発している: ' + le.getMessage()
      );
    }
    System.assertEquals(true, result);
  }

  // ── findBase64RunEnd（1文字ずつのスキャンがCPU制限に達する問題の修正）────

  @IsTest
  static void findBase64RunEnd_stopsExactlyAtNonBase64Character() {
    String text = 'QUJD' + '!' + 'suffix';
    System.assertEquals(
      4,
      MarkdownImageHandler.findBase64RunEnd(text, 0),
      'base64文字以外の直前で停止するべき'
    );
  }

  @IsTest
  static void findBase64RunEnd_returnsTextLengthWhenAllCharsAreBase64() {
    String text = 'QUJDRUZH';
    System.assertEquals(
      text.length(),
      MarkdownImageHandler.findBase64RunEnd(text, 0),
      '全て base64 文字なら文字列末尾まで進むべき'
    );
  }

  @IsTest
  static void findBase64RunEnd_handlesNonBase64CharAtChunkBoundary() {
    // BASE64_SCAN_CHUNK_SIZE(200,000) ちょうどの境界をまたぐケースで
    // チャンク分割ロジックに抜け漏れがないことを確認する。
    String validRun = buildBase64String(200000);
    String text = validRun + '!' + 'more-base64-like-QUJD';
    System.assertEquals(
      200000,
      MarkdownImageHandler.findBase64RunEnd(text, 0),
      'チャンク境界ちょうどで非base64文字に当たっても正しく停止するべき'
    );
  }

  @IsTest
  static void findBase64RunEnd_scansMultiMegabyteRunWithoutHittingGovernorLimits() {
    // 修正前は、この規模（2MB上限相当）のスキャンで
    // isBase64Char() の1文字ずつのループが CPU 時間制限に達して失敗していた。
    String text = buildBase64String(2796204);
    System.assertEquals(
      2796204,
      MarkdownImageHandler.findBase64RunEnd(text, 0)
    );
  }

  @IsTest
  static void saveMarkdownWithImages_withModeratelyLargeImage_succeedsPastOldExtractionLimits() {
    // 400,000文字（実データ約300KB）の埋め込み画像が、チャンク分割
    // スキャンへの置き換え後も extractDataUris() → 検証 → 保存の一連の
    // フローで問題なく成功することを確認する回帰テスト。
    Account a = makeAccount();
    String base64 = buildBase64String(400000);
    String md = '![medium](data:image/png;base64,' + base64 + ')';

    Test.startTest();
    String result = MarkdownImageHandler.saveMarkdownWithImages(
      a.Id,
      'Account',
      'Description',
      md
    );
    Test.stopTest();

    System.assert(
      result.contains('/sfc/servlet.shepherd/document/download/'),
      'data URI が download URL に置換されて保存されるべき'
    );
  }

  @IsTest
  static void saveMarkdownWithImages_withImageNearAdvertisedLimit_failsGracefullyNotWithRawGovernorError() {
    // 1,500,000文字（実データ約1.1MB、advertisingしている2MB上限の範囲内）は
    // extractDataUris() の抽出自体は（チャンク分割スキャンへの修正後）
    // 問題なく成功するが、この org での実測では、その後の処理過程で
    // 元markdown・DataUriMatch.fullMatch・base64Data・デコード後Blobなど
    // 同じデータの複数コピーがヒープ上に同時に存在するため、
    // checkRuntimeLimits() のヒープ安全弁が意図通り作動し
    // MarkdownImageHandlerException で拒否される（＝2MBという上限表示は
    // Apexのヒープ制約に対して楽観的すぎる可能性がある、既知の制約として
    // docs/operations.md に記録）。
    // ここで重要なのは、修正前のように「Regex too complicated」や
    // 「Apex CPU time limit exceeded」という生の・キャッチ不能に近い
    // 例外でユーザーに見えるのではなく、意図された安全弁が発火して
    // フレンドリーな AuraHandledException（かつ setMessage() 修正により
    // 実際のメッセージが呼び出し元に届く）で終わることを確認すること。
    Account a = makeAccount();
    String largeBase64 = buildBase64String(1500000);
    String md = '![large](data:image/png;base64,' + largeBase64 + ')';

    Boolean threw = false;
    try {
      MarkdownImageHandler.saveMarkdownWithImages(a.Id, 'Account', 'Description', md);
    } catch (AuraHandledException ahe) {
      threw = true;
      System.assert(
        ahe.getMessage() != 'Script-thrown exception',
        'setMessage() が呼ばれ、フレンドリーなメッセージが呼び出し元に届くべき'
      );
      System.assert(
        ahe.getMessage().contains('limit'),
        '実行時制約に言及したメッセージであるべき: ' + ahe.getMessage()
      );
    }
    System.assert(
      threw,
      '2MB上限内でもヒープ安全弁により AuraHandledException で拒否されうる（生の govenor エラーではなく）'
    );
  }

  // ── AuraHandledException の setMessage() 漏れ（フレンドリーなメッセージが
  //    クライアントに届いていなかった不具合）の回帰テスト ──────────────────

  @IsTest
  static void saveMarkdownWithUnsupportedImageType_messageReachesCaller() {
    // AuraHandledException(message) だけでは getMessage() が常に
    // "Script-thrown exception" を返し、渡した本来のメッセージが
    // 呼び出し元（LWC）に届いていなかった実バグの回帰テスト。
    Account a = makeAccount();
    String md = '![txt](data:text/plain;base64,' + PNG_B64 + ')';

    try {
      MarkdownImageHandler.saveMarkdownWithImages(a.Id, 'Account', 'Description', md);
      System.assert(false, '例外が投げられるべき');
    } catch (AuraHandledException e) {
      System.assert(
        e.getMessage() != 'Script-thrown exception',
        'setMessage() 漏れにより本来のメッセージが失われている: ' + e.getMessage()
      );
      System.assert(
        e.getMessage().contains('Unsupported embedded image type'),
        '元のフレンドリーなメッセージがそのまま届くべき: ' + e.getMessage()
      );
    }
  }

  @IsTest
  static void saveMarkdown_withNullRecordId_messageReachesCaller() {
    try {
      MarkdownImageHandler.saveMarkdownWithImages(null, 'Account', 'Description', 'hello');
      System.assert(false, '例外が投げられるべき');
    } catch (AuraHandledException e) {
      System.assertEquals(
        'recordId is required.',
        e.getMessage(),
        'setMessage() 漏れにより本来のメッセージが失われている'
      );
    }
  }

  // ── サイズ上限・実行時制約（docs/operations.md #6 のリファクタ検知テスト）───

  @IsTest
  static void estimateBytesFromBase64_matchesExpectedByteCountAtImageSizeBoundary() {
    String justUnder = buildBase64String(2796200);
    String justOver = buildBase64String(2796204);
    System.assertEquals(
      2097150L,
      MarkdownImageHandler.estimateBytesFromBase64(justUnder),
      '2MB上限をわずかに下回るバイト数を計算できるべき'
    );
    System.assertEquals(
      2097153L,
      MarkdownImageHandler.estimateBytesFromBase64(justOver),
      '2MB上限をわずかに上回るバイト数を計算できるべき'
    );
  }

  @IsTest
  static void validateEmbeddedImages_underMaxImageBytes_doesNotThrow() {
    MarkdownImageHandler.DataUriMatch m = new MarkdownImageHandler.DataUriMatch();
    m.mimeType = 'image/png';
    m.base64Data = buildBase64String(2796200); // 2,097,150 bytes（2MB未満）

    Boolean threw = false;
    try {
      MarkdownImageHandler.validateEmbeddedImages(
        new List<MarkdownImageHandler.DataUriMatch>{ m }
      );
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(!threw, '2MB上限をわずかに下回る単一画像は許可されるべき');
  }

  @IsTest
  static void validateEmbeddedImages_overMaxImageBytes_throws() {
    MarkdownImageHandler.DataUriMatch m = new MarkdownImageHandler.DataUriMatch();
    m.mimeType = 'image/png';
    m.base64Data = buildBase64String(2796204); // 2,097,153 bytes（2MB超）

    Boolean threw = false;
    try {
      MarkdownImageHandler.validateEmbeddedImages(
        new List<MarkdownImageHandler.DataUriMatch>{ m }
      );
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(threw, '2MB上限をわずかに超える単一画像は拒否されるべき');
  }

  @IsTest
  static void validateEmbeddedImages_totalOverMaxTotalBytes_throwsEvenWhenEachImageIsUnderIndividualLimit() {
    // 各画像 2,097,150 バイト（単体上限2MB未満）× 4 件 = 8,388,600 バイトで
    // 合計上限（6MB）を超える。単体チェックを素通りしても合計チェックで
    // 拒否されることを確認する。
    String base64 = buildBase64String(2796200);
    List<MarkdownImageHandler.DataUriMatch> matches = new List<MarkdownImageHandler.DataUriMatch>();
    for (Integer i = 0; i < 4; i++) {
      MarkdownImageHandler.DataUriMatch m = new MarkdownImageHandler.DataUriMatch();
      m.mimeType = 'image/png';
      m.base64Data = base64;
      matches.add(m);
    }

    Boolean threw = false;
    try {
      MarkdownImageHandler.validateEmbeddedImages(matches);
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(
      threw,
      '各画像は2MB未満でも合計が6MB上限を超える場合は拒否されるべき'
    );
  }

  @IsTest
  static void checkRuntimeLimits_withinThresholds_doesNotThrow() {
    Boolean threw = false;
    try {
      MarkdownImageHandler.checkRuntimeLimits(9999, 1000, 2000000);
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(!threw, 'CPU時間・ヒープともに閾値内なら例外を投げない');
  }

  @IsTest
  static void checkRuntimeLimits_cpuTimeOverThreshold_throws() {
    Boolean threw = false;
    try {
      MarkdownImageHandler.checkRuntimeLimits(10001, 1000, 2000000);
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(threw, 'CPU時間が10秒（閾値）を超えたら例外を投げる');
  }

  @IsTest
  static void checkRuntimeLimits_heapNearLimit_throws() {
    Boolean threw = false;
    try {
      // heapLimit(2,000,000) - HEAP_BUFFER_BYTES(262,144) = 1,737,856
      MarkdownImageHandler.checkRuntimeLimits(0, 1737857, 2000000);
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(threw, 'ヒープ使用量が残余バッファ(256KB)を超えたら例外を投げる');
  }

  @IsTest
  static void checkRuntimeLimits_heapWithinBuffer_doesNotThrow() {
    Boolean threw = false;
    try {
      MarkdownImageHandler.checkRuntimeLimits(0, 1737856, 2000000);
    } catch (MarkdownImageHandler.MarkdownImageHandlerException e) {
      threw = true;
    }
    System.assert(!threw, 'ヒープ使用量が残余バッファちょうどなら例外を投げない');
  }
}
