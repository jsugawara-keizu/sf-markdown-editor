@IsTest
private class MarkdownTaskTriggerHandlerTest {
  private static Account makeAccountWithMarkdown(String description) {
    Account a = new Account(
      Name = 'Markdown Task Trigger Test Account',
      Description = description
    );
    insert a;
    return a;
  }

  // Org-specific TaskStatus labels vary, so — matching
  // MarkdownTaskSync.getClosedStatus()/getOpenStatus() — resolve the real
  // closed/open labels instead of hardcoding 'Completed'/'Not Started',
  // which may not actually map to IsClosed true/false in every org.
  private static String getRealClosedStatus() {
    for (TaskStatus ts : [
      SELECT MasterLabel
      FROM TaskStatus
      WHERE IsClosed = true
      WITH USER_MODE
      ORDER BY IsDefault DESC
      LIMIT 1
    ]) {
      return ts.MasterLabel;
    }
    return 'Completed';
  }

  private static String getRealOpenStatus() {
    for (TaskStatus ts : [
      SELECT MasterLabel
      FROM TaskStatus
      WHERE IsClosed = false
      WITH USER_MODE
      ORDER BY IsDefault DESC
      LIMIT 1
    ]) {
      return ts.MasterLabel;
    }
    return 'Not Started';
  }

  @IsTest
  static void statusChangeToClosed_writesCheckedMarkBackToMarkdown() {
    Account a = makeAccountWithMarkdown('- [ ] review docs ^[todo:ab12cd]');
    Task t = new Task(
      WhatId = a.Id,
      Subject = 'review docs',
      Status = getRealOpenStatus(),
      MarkdownMarkerId__c = 'ab12cd',
      MarkdownFieldApiName__c = 'Description'
    );
    insert t;

    Test.startTest();
    t.Status = getRealClosedStatus();
    update t;
    Test.stopTest();

    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      '- [x] review docs ^[todo:ab12cd]',
      reloaded.Description
    );
  }

  @IsTest
  static void statusChangeToOpen_writesUncheckedMarkBackToMarkdown() {
    Account a = makeAccountWithMarkdown('- [x] review docs ^[todo:ab12ce]');
    Task t = new Task(
      WhatId = a.Id,
      Subject = 'review docs',
      Status = getRealClosedStatus(),
      MarkdownMarkerId__c = 'ab12ce',
      MarkdownFieldApiName__c = 'Description'
    );
    insert t;

    Test.startTest();
    t.Status = getRealOpenStatus();
    update t;
    Test.stopTest();

    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      '- [ ] review docs ^[todo:ab12ce]',
      reloaded.Description
    );
  }

  @IsTest
  static void updateWithoutStatusChange_doesNotTouchMarkdown() {
    Account a = makeAccountWithMarkdown('- [ ] review docs ^[todo:ab12cf]');
    Task t = new Task(
      WhatId = a.Id,
      Subject = 'review docs',
      Status = getRealOpenStatus(),
      MarkdownMarkerId__c = 'ab12cf',
      MarkdownFieldApiName__c = 'Description'
    );
    insert t;

    Test.startTest();
    // IsClosed doesn't actually change.
    t.Subject = 'review docs (renamed)';
    update t;
    Test.stopTest();

    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals(
      '- [ ] review docs ^[todo:ab12cf]',
      reloaded.Description,
      'Status（IsClosed）が変化していないので Markdown は書き換えない'
    );
  }

  @IsTest
  static void updateOnTaskWithoutMarker_doesNotThrow() {
    Account a = makeAccountWithMarkdown('plain description, no checkboxes');
    Task t = new Task(
      WhatId = a.Id,
      Subject = 'unrelated task',
      Status = getRealOpenStatus()
    );
    insert t;

    Test.startTest();
    t.Status = getRealClosedStatus();
    update t;
    Test.stopTest();

    Account reloaded = [SELECT Description FROM Account WHERE Id = :a.Id];
    System.assertEquals('plain description, no checkboxes', reloaded.Description);
  }

  @IsTest
  static void statusChangeWhenMarkdownAlreadyMatches_skipsRedundantUpdate() {
    // The Markdown already reflects the new state (e.g. written by
    // MarkdownTaskSync.syncCheckboxStatesFromMarkdown just before this
    // Task update landed) — the handler's own write must be a no-op rather
    // than re-issuing an identical DML, which is what keeps the two sync
    // directions from cascading into each other.
    Account a = makeAccountWithMarkdown('- [x] review docs ^[todo:ab12d0]');
    Task t = new Task(
      WhatId = a.Id,
      Subject = 'review docs',
      Status = getRealOpenStatus(),
      MarkdownMarkerId__c = 'ab12d0',
      MarkdownFieldApiName__c = 'Description'
    );
    insert t;

    Test.startTest();
    Integer dmlBefore = Limits.getDmlStatements();
    t.Status = getRealClosedStatus();
    update t;
    Integer dmlAfterTaskUpdate = Limits.getDmlStatements();
    Test.stopTest();

    // 1 DML for the `update t` itself; the handler should not add a second
    // DML for Account since the computed Markdown text is unchanged.
    System.assertEquals(
      dmlBefore + 1,
      dmlAfterTaskUpdate,
      'Markdown が既に一致しているので追加の DML は発生しないべき'
    );
  }

  @IsTest
  static void replaceCheckboxForMarker_replacesOnlyTargetMarkerLine() {
    String md = '- [ ] a ^[todo:111111]\n- [ ] b ^[todo:222222]';
    String result = MarkdownTaskTriggerHandler.replaceCheckboxForMarker(
      md,
      '222222',
      true
    );
    System.assertEquals(
      '- [ ] a ^[todo:111111]\n- [x] b ^[todo:222222]',
      result
    );
  }

  @IsTest
  static void replaceCheckboxForMarker_withUnknownMarker_returnsUnchanged() {
    String md = '- [ ] a ^[todo:111111]';
    System.assertEquals(
      md,
      MarkdownTaskTriggerHandler.replaceCheckboxForMarker(md, 'ffffff', true)
    );
  }

  @IsTest
  static void replaceCheckboxForMarker_withBlankMarkdown_returnsUnchanged() {
    System.assertEquals(
      null,
      MarkdownTaskTriggerHandler.replaceCheckboxForMarker(null, '111111', true)
    );
  }
}
