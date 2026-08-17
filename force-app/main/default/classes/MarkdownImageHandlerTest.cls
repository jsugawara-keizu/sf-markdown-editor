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
}
