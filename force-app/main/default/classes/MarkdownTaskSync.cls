public with sharing class MarkdownTaskSync {
  @AuraEnabled(cacheable=false)
  public static List<TaskRow> getTasksForField(Id whatId, String fieldApiName) {
    try {
      if (whatId == null) {
        throw new MarkdownTaskSyncException('whatId is required.');
      }
      if (String.isBlank(fieldApiName)) {
        throw new MarkdownTaskSyncException('fieldApiName is required.');
      }

      // WhatId + MarkdownFieldApiName__c (not MarkdownMarkerId__c) so that
      // Tasks whose checkbox line has since been deleted from the Markdown
      // source are still returned as "orphaned" rows rather than dropped.
      List<Task> tasks = [
        SELECT Id, Subject, Status, IsClosed, OwnerId, Owner.Name, ActivityDate,
          IsReminderSet, ReminderDateTime, MarkdownMarkerId__c
        FROM Task
        WHERE WhatId = :whatId AND MarkdownFieldApiName__c = :fieldApiName
        WITH USER_MODE
        ORDER BY CreatedDate ASC
      ];

      List<TaskRow> rows = new List<TaskRow>();
      for (Task t : tasks) {
        rows.add(new TaskRow(t));
      }
      return rows;
    } catch (MarkdownTaskSyncException mtse) {
      throw friendlyError(mtse.getMessage());
    } catch (Exception e) {
      throw friendlyError('Failed to load tasks for checklist: ' + e.getMessage());
    }
  }

  // AuraHandledException's own message constructor argument is NOT what
  // getMessage() returns on the client — confirmed against this org,
  // getMessage() always comes back as the generic "Script-thrown exception"
  // unless setMessage() is called explicitly first. Centralized here so
  // every throw site gets the fix instead of relying on each call site to
  // remember it.
  private static AuraHandledException friendlyError(String message) {
    AuraHandledException ex = new AuraHandledException(message);
    ex.setMessage(message);
    return ex;
  }

  // Plain (non-AuraEnabled) overload kept for callers that don't need
  // reminder support — mainly existing Apex tests, so they don't all have
  // to grow two more positional args unrelated to what they're verifying.
  public static TaskRow createTaskForCheckbox(
    Id whatId,
    String fieldApiName,
    String markerId,
    String subject,
    Boolean checked,
    Id ownerId,
    Date dueDate
  ) {
    return createTaskForCheckbox(
      whatId,
      fieldApiName,
      markerId,
      subject,
      checked,
      ownerId,
      dueDate,
      false,
      null
    );
  }

  @AuraEnabled
  public static TaskRow createTaskForCheckbox(
    Id whatId,
    String fieldApiName,
    String markerId,
    String subject,
    Boolean checked,
    Id ownerId,
    Date dueDate,
    Boolean isReminderSet,
    Datetime reminderDateTime
  ) {
    try {
      if (whatId == null) {
        throw new MarkdownTaskSyncException('whatId is required.');
      }
      if (String.isBlank(fieldApiName)) {
        throw new MarkdownTaskSyncException('fieldApiName is required.');
      }
      if (String.isBlank(markerId)) {
        throw new MarkdownTaskSyncException('markerId is required.');
      }
      if (String.isBlank(subject)) {
        throw new MarkdownTaskSyncException('subject is required.');
      }

      // IsReminderSet=true with a null ReminderDateTime fails Salesforce's
      // own standard validation on Task ("reminder date/time" required), so
      // the reminder is only actually turned on when a datetime came with it.
      Boolean reminderSet = isReminderSet == true && reminderDateTime != null;

      Task t = new Task(
        WhatId = whatId,
        Subject = subject,
        OwnerId = ownerId,
        ActivityDate = dueDate,
        IsReminderSet = reminderSet,
        ReminderDateTime = reminderSet ? reminderDateTime : null,
        MarkdownMarkerId__c = markerId,
        MarkdownFieldApiName__c = fieldApiName
      );
      applyCheckedStatus(t, checked == true);

      insert as user t;

      Task reloaded = [
        SELECT Id, Subject, Status, IsClosed, OwnerId, Owner.Name, ActivityDate,
          IsReminderSet, ReminderDateTime, MarkdownMarkerId__c
        FROM Task
        WHERE Id = :t.Id
        WITH USER_MODE
      ];
      return new TaskRow(reloaded);
    } catch (MarkdownTaskSyncException mtse) {
      throw friendlyError(mtse.getMessage());
    } catch (DmlException de) {
      throw friendlyError('Failed to create task: ' + de.getMessage());
    } catch (Exception e) {
      throw friendlyError('Failed to create task for checkbox: ' + e.getMessage());
    }
  }

  // Called from MarkdownImageHandler after every successful write of a
  // Markdown field, from whichever entry point (Save button, checkbox
  // toggle, checklist-panel task creation) — the saved text is treated as
  // the single source of truth and Task status is reconciled against it,
  // rather than trying to track "what changed" from the previous value.
  public static void syncCheckboxStatesFromMarkdown(
    Id whatId,
    String fieldApiName,
    String markdownContent
  ) {
    if (whatId == null || String.isBlank(fieldApiName) || String.isBlank(markdownContent)) {
      return;
    }

    Map<String, Boolean> checkedByMarker = extractMarkerCheckedStates(
      markdownContent
    );
    if (checkedByMarker.isEmpty()) {
      return;
    }

    List<Task> tasks = [
      SELECT Id, IsClosed, MarkdownMarkerId__c
      FROM Task
      WHERE
        WhatId = :whatId
        AND MarkdownFieldApiName__c = :fieldApiName
        AND MarkdownMarkerId__c IN :checkedByMarker.keySet()
      WITH USER_MODE
    ];

    List<Task> toUpdate = new List<Task>();
    for (Task t : tasks) {
      Boolean checked = checkedByMarker.get(t.MarkdownMarkerId__c);
      if (checked == null || t.IsClosed == checked) {
        continue;
      }
      Task upd = new Task(Id = t.Id);
      applyCheckedStatus(upd, checked);
      toUpdate.add(upd);
    }

    if (!toUpdate.isEmpty()) {
      update as user toUpdate;
    }
  }

  // Marker lines look like `- [x] text ^[todo:abc123]`; the checked state
  // is whatever is inside the immediately preceding `[ ]`/`[x]`.
  @TestVisible
  private static Map<String, Boolean> extractMarkerCheckedStates(
    String markdown
  ) {
    Map<String, Boolean> result = new Map<String, Boolean>();
    Pattern p = Pattern.compile('\\[([ xX])\\][^\\n]*\\^\\[todo:([0-9a-f]+)\\]');
    Matcher m = p.matcher(markdown);
    while (m.find()) {
      result.put(m.group(2), m.group(1).equalsIgnoreCase('x'));
    }
    return result;
  }

  // Task.Status is a picklist whose values vary by org (Task's "closed"
  // bucket isn't a fixed API name), so the closed/open state is derived from
  // TaskStatus rather than a hardcoded string.
  @TestVisible
  private static void applyCheckedStatus(Task t, Boolean checked) {
    if (checked) {
      t.Status = getClosedStatus();
    } else {
      t.Status = getOpenStatus();
    }
  }

  private static String getClosedStatus() {
    for (TaskStatus ts : [
      SELECT MasterLabel, IsDefault, IsClosed
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

  private static String getOpenStatus() {
    for (TaskStatus ts : [
      SELECT MasterLabel, IsDefault, IsClosed
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

  public class TaskRow {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String subject;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Boolean isClosed;
    @AuraEnabled
    public Id ownerId;
    @AuraEnabled
    public String ownerName;
    @AuraEnabled
    public Date dueDate;
    @AuraEnabled
    public Boolean isReminderSet;
    @AuraEnabled
    public Datetime reminderDateTime;
    @AuraEnabled
    public String markdownMarkerId;

    public TaskRow(Task t) {
      this.id = t.Id;
      this.subject = t.Subject;
      this.status = t.Status;
      this.isClosed = t.IsClosed;
      this.ownerId = t.OwnerId;
      this.ownerName = t.Owner != null ? t.Owner.Name : null;
      this.dueDate = t.ActivityDate;
      this.isReminderSet = t.IsReminderSet;
      this.reminderDateTime = t.ReminderDateTime;
      this.markdownMarkerId = t.MarkdownMarkerId__c;
    }
  }

  public class MarkdownTaskSyncException extends Exception {
  }
}
