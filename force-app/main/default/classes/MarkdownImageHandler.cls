public with sharing class MarkdownImageHandler {
  private static final String DOWNLOAD_URL_TEMPLATE = '/sfc/servlet.shepherd/document/download/{0}';
  private static final Integer MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
  private static final Integer MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
  private static final Integer CPU_TIME_THRESHOLD_MS = 10000; // 10 seconds
  private static final Integer HEAP_BUFFER_BYTES = 256 * 1024; // 256 KB
  private static final Set<String> SUPPORTED_IMAGE_MIME_PREFIXES = new Set<String>{
    'image/'
  };

  @AuraEnabled
  public static String saveMarkdownWithImages(
    Id recordId,
    String objectApiName,
    String fieldApiName,
    String markdownContent
  ) {
    try {
      if (recordId == null) {
        throw new MarkdownImageHandlerException('recordId is required.');
      }
      if (String.isBlank(fieldApiName)) {
        throw new MarkdownImageHandlerException('fieldApiName is required.');
      }
      if (markdownContent == null) {
        markdownContent = '';
      }

      Schema.SObjectType sObjType = recordId.getSObjectType();
      if (
        String.isNotBlank(objectApiName) &&
        sObjType != null &&
        !sObjType.getDescribe().getName().equalsIgnoreCase(objectApiName)
      ) {
        throw new MarkdownImageHandlerException(
          'recordId does not belong to the specified objectApiName: ' +
          objectApiName
        );
      }

      List<DataUriMatch> matches = extractDataUris(markdownContent);
      validateEmbeddedImages(matches);

      if (matches.isEmpty()) {
        updateRecordField(recordId, fieldApiName, markdownContent);
        return markdownContent;
      }

      List<ContentVersion> versionsToInsert = new List<ContentVersion>();
      Long ts = System.currentTimeMillis();

      for (Integer i = 0; i < matches.size(); i++) {
        checkRuntimeLimits();
        DataUriMatch m = matches[i];
        String ext = mimeTypeToExtension(m.mimeType);
        ContentVersion cv = new ContentVersion();
        cv.Title = 'md-image-' + ts + '-' + i;
        cv.PathOnClient = 'md-image-' + i + '.' + ext;
        cv.VersionData = EncodingUtil.base64Decode(m.base64Data);
        cv.FirstPublishLocationId = recordId;
        versionsToInsert.add(cv);
      }

      insert as user versionsToInsert;

      Set<Id> versionIds = new Set<Id>();
      for (ContentVersion cv : versionsToInsert) {
        versionIds.add(cv.Id);
      }

      Map<Id, ContentVersion> reloaded = new Map<Id, ContentVersion>(
        [
          SELECT Id, ContentDocumentId
          FROM ContentVersion
          WHERE Id IN :versionIds
          WITH USER_MODE
        ]
      );

      String modifiedMarkdown = markdownContent;
      for (Integer i = 0; i < matches.size(); i++) {
        DataUriMatch m = matches[i];
        ContentVersion saved = reloaded.get(versionsToInsert[i].Id);
        if (saved == null || saved.ContentDocumentId == null) {
          continue;
        }
        String downloadUrl = String.format(
          DOWNLOAD_URL_TEMPLATE,
          new List<String>{ String.valueOf(saved.ContentDocumentId) }
        );
        modifiedMarkdown = replaceFirst(
          modifiedMarkdown,
          m.fullMatch,
          downloadUrl
        );
      }

      updateRecordField(recordId, fieldApiName, modifiedMarkdown);
      return modifiedMarkdown;
    } catch (MarkdownImageHandlerException mie) {
      throw new AuraHandledException(mie.getMessage());
    } catch (System.LimitException le) {
      throw new AuraHandledException(
        'Failed to save markdown due to Salesforce runtime limits. Reduce the number or size of embedded images and try again. ' +
        le.getMessage()
      );
    } catch (DmlException de) {
      throw new AuraHandledException(
        'Failed to save embedded images. Reduce the number or size of images and try again. ' +
        de.getMessage()
      );
    } catch (Exception e) {
      throw new AuraHandledException(
        'Failed to save markdown with images: ' + e.getMessage()
      );
    }
  }

  private static void checkRuntimeLimits() {
    Integer cpuTime = Limits.getCpuTime();
    if (cpuTime > CPU_TIME_THRESHOLD_MS) {
      throw new MarkdownImageHandlerException(
        'Processing is too close to Salesforce CPU time limit. Reduce the size or number of embedded images and try again.'
      );
    }

    Integer heapSize = Limits.getHeapSize();
    Integer heapLimit = Limits.getLimitHeapSize();
    if (heapSize > heapLimit - HEAP_BUFFER_BYTES) {
      throw new MarkdownImageHandlerException(
        'Processing is too close to Salesforce heap limit. Reduce the size or number of embedded images and try again.'
      );
    }
  }

  @TestVisible
  private static List<DataUriMatch> extractDataUris(String markdown) {
    List<DataUriMatch> result = new List<DataUriMatch>();
    if (String.isBlank(markdown)) {
      return result;
    }

    Integer searchFrom = 0;
    while (searchFrom < markdown.length()) {
      Integer dataStart = markdown.indexOf('data:', searchFrom);
      if (dataStart < 0) {
        break;
      }

      Integer mimeStart = dataStart + 'data:'.length();
      Integer markerPos = markdown.indexOf(';base64,', mimeStart);
      if (markerPos < 0) {
        break;
      }

      String mimeType = markdown.substring(mimeStart, markerPos);
      if (String.isBlank(mimeType) || !mimeType.contains('/')) {
        searchFrom = markerPos + ';base64,'.length();
        continue;
      }

      Integer base64Start = markerPos + ';base64,'.length();
      Integer cursor = base64Start;
      while (
        cursor < markdown.length() &&
        isBase64Char(markdown.substring(cursor, cursor + 1))
      ) {
        cursor++;
      }

      if (cursor == base64Start) {
        searchFrom = base64Start;
        continue;
      }

      String base64Data = markdown.substring(base64Start, cursor);
      DataUriMatch match = new DataUriMatch();
      match.fullMatch = markdown.substring(dataStart, cursor);
      match.mimeType = mimeType;
      match.base64Data = base64Data;
      result.add(match);

      searchFrom = cursor;
    }
    return result;
  }

  private static void validateEmbeddedImages(List<DataUriMatch> matches) {
    if (matches == null || matches.isEmpty()) {
      return;
    }

    Long totalBytes = 0;
    for (Integer i = 0; i < matches.size(); i++) {
      DataUriMatch match = matches[i];
      if (
        String.isBlank(match.mimeType) ||
        !isSupportedImageMimeType(match.mimeType)
      ) {
        throw new MarkdownImageHandlerException(
          'Unsupported embedded image type: ' +
            match.mimeType +
            '. Use a standard image format such as PNG, JPEG, SVG, GIF, or WEBP.'
        );
      }

      Long bytes = estimateBytesFromBase64(match.base64Data);
      if (bytes > MAX_IMAGE_BYTES) {
        throw new MarkdownImageHandlerException(
          'An embedded image is too large. Each image must be under ' +
            (MAX_IMAGE_BYTES / (1024 * 1024)) +
            ' MB.'
        );
      }
      totalBytes += bytes;
      if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        throw new MarkdownImageHandlerException(
          'Total embedded image size is too large. Reduce the number or size of embedded images.'
        );
      }
    }
  }

  private static Boolean isSupportedImageMimeType(String mimeType) {
    if (String.isBlank(mimeType)) {
      return false;
    }
    for (String prefix : SUPPORTED_IMAGE_MIME_PREFIXES) {
      if (mimeType.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  private static Long estimateBytesFromBase64(String base64Data) {
    if (String.isBlank(base64Data)) {
      return 0;
    }
    Long length = Long.valueOf(String.valueOf(base64Data.length()));
    Long padding = 0;
    if (base64Data.endsWith('==')) {
      padding = 2;
    } else if (base64Data.endsWith('=')) {
      padding = 1;
    }
    return ((length * 3) / 4) - padding;
  }

  @TestVisible
  private static Boolean isBase64Char(String c) {
    if (String.isBlank(c) || c.length() != 1) {
      return false;
    }
    String base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    return base64Chars.contains(c);
  }

  @TestVisible
  private static void updateRecordField(
    Id recordId,
    String fieldApiName,
    String value
  ) {
    Schema.SObjectType sObjType = recordId.getSObjectType();
    if (sObjType == null) {
      throw new MarkdownImageHandlerException(
        'Cannot resolve SObjectType from recordId.'
      );
    }
    Map<String, Schema.SObjectField> fieldMap = sObjType.getDescribe()
      .fields.getMap();
    Schema.SObjectField field = null;
    for (String fieldNameKey : fieldMap.keySet()) {
      if (fieldNameKey.equalsIgnoreCase(fieldApiName)) {
        field = fieldMap.get(fieldNameKey);
        break;
      }
    }
    if (field == null) {
      throw new MarkdownImageHandlerException(
        'Field not found: ' + fieldApiName
      );
    }
    Schema.DescribeFieldResult dfr = field.getDescribe();
    if (!dfr.isUpdateable()) {
      throw new MarkdownImageHandlerException(
        'Field is not updateable: ' + fieldApiName
      );
    }
    SObject record = sObjType.newSObject(recordId);
    record.put(fieldApiName, value);
    update as user record;
  }

  @TestVisible
  private static String mimeTypeToExtension(String mimeType) {
    if (String.isBlank(mimeType) || !mimeType.contains('/')) {
      return 'bin';
    }
    String subtype = mimeType.substringAfter('/');
    if (subtype.contains('+')) {
      subtype = subtype.substringBefore('+');
    }
    if (subtype.equalsIgnoreCase('jpeg')) {
      return 'jpg';
    }
    return subtype.toLowerCase();
  }

  @TestVisible
  private static String replaceFirst(
    String source,
    String target,
    String replacement
  ) {
    if (source == null || target == null) {
      return source;
    }
    Integer idx = source.indexOf(target);
    if (idx < 0) {
      return source;
    }
    return source.substring(0, idx) +
      replacement +
      source.substring(idx + target.length());
  }

  @TestVisible
  private class DataUriMatch {
    public String fullMatch;
    public String mimeType;
    public String base64Data;
  }

  public class MarkdownImageHandlerException extends Exception {
  }
}
