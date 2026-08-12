public with sharing class MarkdownTaskTriggerHandler {
  public static void handleAfterUpdate(List<Task> newTasks, Map<Id, Task> oldMap) {
    Map<String, List<Task>> changedByRecordAndField = groupChangedMarkerTasks(
      newTasks,
      oldMap
    );
    for (String key : changedByRecordAndField.keySet()) {
      List<Task> taskGroup = changedByRecordAndField.get(key);
      syncMarkdownForGroup(
        taskGroup[0].WhatId,
        taskGroup[0].MarkdownFieldApiName__c,
        taskGroup
      );
    }
  }

  private static Map<String, List<Task>> groupChangedMarkerTasks(
    List<Task> newTasks,
    Map<Id, Task> oldMap
  ) {
    Map<String, List<Task>> groups = new Map<String, List<Task>>();
    for (Task t : newTasks) {
      if (
        String.isBlank(t.MarkdownMarkerId__c) ||
        t.WhatId == null ||
        String.isBlank(t.MarkdownFieldApiName__c)
      ) {
        continue;
      }
      Task old = oldMap.get(t.Id);
      if (old.IsClosed == t.IsClosed) {
        continue;
      }
      String key = t.WhatId + '::' + t.MarkdownFieldApiName__c;
      if (!groups.containsKey(key)) {
        groups.put(key, new List<Task>());
      }
      groups.get(key).add(t);
    }
    return groups;
  }

  private static void syncMarkdownForGroup(
    Id whatId,
    String fieldApiName,
    List<Task> tasks
  ) {
    String currentValue;
    try {
      currentValue = MarkdownRecordFieldAccessor.queryFieldValue(
        whatId,
        fieldApiName
      );
    } catch (MarkdownRecordFieldAccessor.FieldAccessException fae) {
      // Field/record no longer readable (e.g. record deleted) — nothing to
      // write back to.
      return;
    }

    String updated = currentValue;
    for (Task t : tasks) {
      updated = replaceCheckboxForMarker(updated, t.MarkdownMarkerId__c, t.IsClosed);
    }

    // Loop guard: only issue the DML when the computed text actually
    // differs from what's stored. This is what prevents Markdown -> Task
    // sync (MarkdownTaskSync.syncCheckboxStatesFromMarkdown, triggered by
    // any save) and this Task -> Markdown sync from cascading into each
    // other indefinitely — a save with unchanged marker states reaches this
    // handler's own write and finds nothing left to change, so it stops
    // here without issuing a further Task update.
    if (updated == currentValue) {
      return;
    }

    try {
      MarkdownRecordFieldAccessor.updateRecordField(whatId, fieldApiName, updated);
    } catch (MarkdownRecordFieldAccessor.FieldAccessException fae) {
      // Field not writable by the running user — nothing more to do.
      return;
    }
  }

  @TestVisible
  private static String replaceCheckboxForMarker(
    String markdown,
    String markerId,
    Boolean checked
  ) {
    // markerId is always org-generated hex ([0-9a-f]{6}, see
    // markdownChecklistPanel.js's randomMarkerId()), so it never contains
    // regex metacharacters and is safe to inline directly.
    if (String.isBlank(markdown) || !Pattern.matches('[0-9a-f]+', markerId)) {
      return markdown;
    }
    Pattern p = Pattern.compile(
      '(\\[)[ xX](\\]([^\\n]*\\^\\[todo:' + markerId + '\\]))'
    );
    Matcher m = p.matcher(markdown);
    if (!m.find()) {
      return markdown;
    }
    String mark = checked ? 'x' : ' ';
    return markdown.substring(0, m.start()) +
      m.group(1) +
      mark +
      m.group(2) +
      markdown.substring(m.end());
  }
}
