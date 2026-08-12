// Dynamic, FLS-enforced read/write access to a single text field on an
// arbitrary record, by API name. Shared by MarkdownImageHandler (LWC-facing
// save/toggle) and TaskTriggerHandler (Task -> Markdown sync), so the same
// field-resolution and USER_MODE enforcement rules apply regardless of which
// direction is writing.
public with sharing class MarkdownRecordFieldAccessor {
  public static Schema.SObjectField resolveField(
    Schema.SObjectType sObjType,
    String fieldApiName
  ) {
    Map<String, Schema.SObjectField> fieldMap = sObjType.getDescribe()
      .fields.getMap();
    for (String fieldNameKey : fieldMap.keySet()) {
      if (fieldNameKey.equalsIgnoreCase(fieldApiName)) {
        return fieldMap.get(fieldNameKey);
      }
    }
    throw new FieldAccessException('Field not found: ' + fieldApiName);
  }

  public static String queryFieldValue(Id recordId, String fieldApiName) {
    Schema.SObjectType sObjType = recordId.getSObjectType();
    if (sObjType == null) {
      throw new FieldAccessException(
        'Cannot resolve SObjectType from recordId.'
      );
    }
    Schema.SObjectField field = resolveField(sObjType, fieldApiName);
    if (!field.getDescribe().isAccessible()) {
      throw new FieldAccessException('Field is not accessible: ' + fieldApiName);
    }
    String sObjectName = sObjType.getDescribe().getName();
    String fieldName = field.getDescribe().getName();
    List<SObject> records = Database.query(
      'SELECT ' + fieldName + ' FROM ' + sObjectName +
      ' WHERE Id = :recordId WITH USER_MODE'
    );
    if (records.isEmpty()) {
      throw new FieldAccessException('Record not found: ' + recordId);
    }
    Object value = records[0].get(fieldName);
    return value == null ? '' : String.valueOf(value);
  }

  public static void updateRecordField(
    Id recordId,
    String fieldApiName,
    String value
  ) {
    Schema.SObjectType sObjType = recordId.getSObjectType();
    if (sObjType == null) {
      throw new FieldAccessException(
        'Cannot resolve SObjectType from recordId.'
      );
    }
    Schema.SObjectField field = resolveField(sObjType, fieldApiName);
    Schema.DescribeFieldResult dfr = field.getDescribe();
    if (!dfr.isUpdateable()) {
      throw new FieldAccessException('Field is not updateable: ' + fieldApiName);
    }
    SObject record = sObjType.newSObject(recordId);
    record.put(fieldApiName, value);
    update as user record;
  }

  public class FieldAccessException extends Exception {
  }
}
