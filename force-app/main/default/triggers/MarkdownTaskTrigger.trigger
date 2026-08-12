trigger MarkdownTaskTrigger on Task (after update) {
  MarkdownTaskTriggerHandler.handleAfterUpdate(Trigger.new, Trigger.oldMap);
}
