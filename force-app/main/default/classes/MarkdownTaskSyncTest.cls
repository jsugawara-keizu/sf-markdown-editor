@IsTest
private class MarkdownTaskSyncTest {
  private static Integer accountCounter = 0;

  private static Account makeAccount() {
    accountCounter++;
    Account a = new Account(
      Name = 'Markdown Task Sync Test Account ' + accountCounter
    );
    insert a;
    return a;
  }

  @IsTest
  static void getTasksForField_returnsEmptyListWhenNoneExist() {
    Account a = makeAccount();
    List<MarkdownTaskSync.TaskRow> rows = MarkdownTaskSync.getTasksForField(
      a.Id,
      'Markdown__c'
    );
    System.assertEquals(0, rows.size());
  }

  @IsTest
  static void getTasksForField_returnsOnlyMatchingWhatIdAndField() {
    Account a = makeAccount();
    Account other = makeAccount();

    MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'aaaaaa',
      'first item',
      false,
      UserInfo.getUserId(),
      null
    );
    MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'OtherField__c',
      'bbbbbb',
      'different field',
      false,
      UserInfo.getUserId(),
      null
    );
    MarkdownTaskSync.createTaskForCheckbox(
      other.Id,
      'Markdown__c',
      'cccccc',
      'different record',
      false,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    List<MarkdownTaskSync.TaskRow> rows = MarkdownTaskSync.getTasksForField(
      a.Id,
      'Markdown__c'
    );
    Test.stopTest();

    System.assertEquals(1, rows.size());
    System.assertEquals('first item', rows[0].subject);
    System.assertEquals('aaaaaa', rows[0].markdownMarkerId);
  }

  @IsTest
  static void getTasksForField_withNullWhatId_throwsAuraHandledException() {
    Boolean threw = false;
    try {
      MarkdownTaskSync.getTasksForField(null, 'Markdown__c');
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'whatId が null なら例外を投げる');
  }

  @IsTest
  static void getTasksForField_withBlankFieldApiName_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownTaskSync.getTasksForField(a.Id, '');
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'fieldApiName が空なら例外を投げる');
  }

  @IsTest
  static void createTaskForCheckbox_checkedTrue_createsClosedTask() {
    Account a = makeAccount();

    Test.startTest();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'dead01',
      'review docs',
      true,
      UserInfo.getUserId(),
      null
    );
    Test.stopTest();

    System.assertEquals('review docs', row.subject);
    System.assertEquals('dead01', row.markdownMarkerId);
    System.assertEquals(true, row.isClosed);
    System.assertEquals(UserInfo.getUserId(), row.ownerId);

    Task reloaded = [
      SELECT WhatId, MarkdownFieldApiName__c, MarkdownMarkerId__c, IsClosed
      FROM Task
      WHERE Id = :row.id
    ];
    System.assertEquals(a.Id, reloaded.WhatId);
    System.assertEquals('Markdown__c', reloaded.MarkdownFieldApiName__c);
    System.assertEquals(true, reloaded.IsClosed);
  }

  @IsTest
  static void createTaskForCheckbox_checkedFalse_createsOpenTask() {
    Account a = makeAccount();

    Test.startTest();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'cafe02',
      'not done yet',
      false,
      UserInfo.getUserId(),
      null
    );
    Test.stopTest();

    System.assertEquals(false, row.isClosed);
  }

  @IsTest
  static void createTaskForCheckbox_withDueDate_setsActivityDate() {
    Account a = makeAccount();
    Date dueDate = Date.today().addDays(7);

    Test.startTest();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'face03',
      'ship the feature',
      false,
      UserInfo.getUserId(),
      dueDate
    );
    Test.stopTest();

    System.assertEquals(dueDate, row.dueDate);

    Task reloaded = [SELECT ActivityDate FROM Task WHERE Id = :row.id];
    System.assertEquals(dueDate, reloaded.ActivityDate);
  }

  @IsTest
  static void createTaskForCheckbox_withoutDueDate_leavesActivityDateNull() {
    Account a = makeAccount();

    Test.startTest();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'face04',
      'no deadline yet',
      false,
      UserInfo.getUserId(),
      null
    );
    Test.stopTest();

    System.assertEquals(null, row.dueDate);
  }

  @IsTest
  static void createTaskForCheckbox_withBlankSubject_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownTaskSync.createTaskForCheckbox(
        a.Id,
        'Markdown__c',
        'aaaaaa',
        '',
        false,
        UserInfo.getUserId(),
        null
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'subject が空なら例外を投げる');
  }

  @IsTest
  static void createTaskForCheckbox_withBlankMarkerId_throwsAuraHandledException() {
    Account a = makeAccount();
    Boolean threw = false;
    try {
      MarkdownTaskSync.createTaskForCheckbox(
        a.Id,
        'Markdown__c',
        '',
        'subject',
        false,
        UserInfo.getUserId(),
        null
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'markerId が空なら例外を投げる');
  }

  @IsTest
  static void createTaskForCheckbox_withNullWhatId_throwsAuraHandledException() {
    Boolean threw = false;
    try {
      MarkdownTaskSync.createTaskForCheckbox(
        null,
        'Markdown__c',
        'aaaaaa',
        'subject',
        false,
        UserInfo.getUserId(),
        null
      );
    } catch (AuraHandledException e) {
      threw = true;
    }
    System.assert(threw, 'whatId が null なら例外を投げる');
  }

  @IsTest
  static void syncCheckboxStatesFromMarkdown_closesTaskWhenMarkedChecked() {
    Account a = makeAccount();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'ab12cd',
      'review docs',
      false,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      a.Id,
      'Markdown__c',
      '- [x] review docs ^[todo:ab12cd]'
    );
    Test.stopTest();

    Task reloaded = [SELECT IsClosed FROM Task WHERE Id = :row.id];
    System.assertEquals(true, reloaded.IsClosed);
  }

  @IsTest
  static void syncCheckboxStatesFromMarkdown_reopensTaskWhenMarkedUnchecked() {
    Account a = makeAccount();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'ab12ce',
      'review docs',
      true,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      a.Id,
      'Markdown__c',
      '- [ ] review docs ^[todo:ab12ce]'
    );
    Test.stopTest();

    Task reloaded = [SELECT IsClosed FROM Task WHERE Id = :row.id];
    System.assertEquals(false, reloaded.IsClosed);
  }

  @IsTest
  static void syncCheckboxStatesFromMarkdown_leavesTaskUntouchedWhenStatusAlreadyMatches() {
    Account a = makeAccount();
    MarkdownTaskSync.TaskRow row = MarkdownTaskSync.createTaskForCheckbox(
      a.Id,
      'Markdown__c',
      'ab12cf',
      'review docs',
      true,
      UserInfo.getUserId(),
      null
    );

    Test.startTest();
    // Same checked state as already stored — should not error, and should
    // not need to issue any DML (the loop guard in the Task -> Markdown
    // direction depends on the mirror-image of this: no-op syncs don't
    // cascade further updates).
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      a.Id,
      'Markdown__c',
      '- [x] review docs ^[todo:ab12cf]'
    );
    Test.stopTest();

    Task reloaded = [SELECT IsClosed FROM Task WHERE Id = :row.id];
    System.assertEquals(true, reloaded.IsClosed);
  }

  @IsTest
  static void syncCheckboxStatesFromMarkdown_ignoresUnknownMarker() {
    Account a = makeAccount();
    Test.startTest();
    // No Task exists with this marker — should be a silent no-op, not an
    // exception.
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      a.Id,
      'Markdown__c',
      '- [x] unrelated ^[todo:ffffff]'
    );
    Test.stopTest();
    System.assertEquals(
      0,
      [SELECT COUNT() FROM Task WHERE WhatId = :a.Id]
    );
  }

  @IsTest
  static void syncCheckboxStatesFromMarkdown_withBlankInputs_doesNothing() {
    Test.startTest();
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(null, 'Markdown__c', '- [x] a ^[todo:aaaaaa]');
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      UserInfo.getUserId(),
      '',
      '- [x] a ^[todo:aaaaaa]'
    );
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(
      UserInfo.getUserId(),
      'Markdown__c',
      ''
    );
    Test.stopTest();
    // No exception is the assertion here.
  }

  @IsTest
  static void extractMarkerCheckedStates_parsesMultipleMarkersOnSeparateLines() {
    String md = '- [ ] a ^[todo:111111]\n- [x] b ^[todo:222222]\n- [x] c, no marker here';
    Map<String, Boolean> states = MarkdownTaskSync.extractMarkerCheckedStates(md);
    System.assertEquals(2, states.size());
    System.assertEquals(false, states.get('111111'));
    System.assertEquals(true, states.get('222222'));
  }
}
