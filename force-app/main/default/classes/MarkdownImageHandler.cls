public with sharing class MarkdownImageHandler {
  private static final String DOWNLOAD_URL_TEMPLATE = '/sfc/servlet.shepherd/document/download/{0}';
  private static final Integer MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
  private static final Integer MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
  private static final Integer CPU_TIME_THRESHOLD_MS = 10000; // 10 seconds
  private static final Integer HEAP_BUFFER_BYTES = 256 * 1024; // 256 KB
  private static final Set<String> SUPPORTED_IMAGE_MIME_TYPES = new Set<String>{
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/gif',
    'image/webp'
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

      // 末尾から置換することで、先行する置換がオフセットに影響しないようにする
      String modifiedMarkdown = markdownContent;
      for (Integer i = matches.size() - 1; i >= 0; i--) {
        DataUriMatch m = matches[i];
        ContentVersion saved = reloaded.get(versionsToInsert[i].Id);
        if (saved == null || saved.ContentDocumentId == null) {
          continue;
        }
        String downloadUrl = String.format(
          DOWNLOAD_URL_TEMPLATE,
          new List<String>{ String.valueOf(saved.ContentDocumentId) }
        );
        modifiedMarkdown =
          modifiedMarkdown.substring(0, m.startIndex) +
          downloadUrl +
          modifiedMarkdown.substring(m.endIndex);
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

  @AuraEnabled
  public static String toggleCheckboxLine(
    Id recordId,
    String objectApiName,
    String fieldApiName,
    Integer line,
    Boolean checked
  ) {
    try {
      if (recordId == null) {
        throw new MarkdownImageHandlerException('recordId is required.');
      }
      if (String.isBlank(fieldApiName)) {
        throw new MarkdownImageHandlerException('fieldApiName is required.');
      }
      if (line == null || line < 1) {
        throw new MarkdownImageHandlerException('line must be a positive integer.');
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

      String currentValue = MarkdownRecordFieldAccessor.queryFieldValue(
        recordId,
        fieldApiName
      );
      String updatedValue = toggleCheckboxAtLine(currentValue, line, checked);
      updateRecordField(recordId, fieldApiName, updatedValue);
      return updatedValue;
    } catch (MarkdownImageHandlerException mie) {
      throw new AuraHandledException(mie.getMessage());
    } catch (MarkdownRecordFieldAccessor.FieldAccessException fae) {
      throw new AuraHandledException(fae.getMessage());
    } catch (Exception e) {
      throw new AuraHandledException(
        'Failed to toggle checkbox: ' + e.getMessage()
      );
    }
  }

  // line は1始まり（markdown-core の data-md-line、mdast/hast の
  // position.start.line に対応）。split/join を使うと Apex の split() が
  // 末尾の空行を落とすため、対象行の範囲だけを文字列操作で置換する。
  @TestVisible
  private static String toggleCheckboxAtLine(
    String text,
    Integer line,
    Boolean checked
  ) {
    if (String.isBlank(text)) {
      return text;
    }

    Integer currentLine = 1;
    Integer searchFrom = 0;
    while (currentLine < line) {
      Integer nlIdx = text.indexOf('\n', searchFrom);
      if (nlIdx < 0) {
        return text;
      }
      searchFrom = nlIdx + 1;
      currentLine++;
    }

    Integer lineStart = searchFrom;
    Integer lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd < 0) {
      lineEnd = text.length();
    }

    String lineText = text.substring(lineStart, lineEnd);
    Pattern taskListMarker = Pattern.compile('^(\\s*[-*+]\\s+)\\[[ xX]\\]');
    Matcher m = taskListMarker.matcher(lineText);
    if (!m.find()) {
      return text;
    }

    String prefix = m.group(1);
    String mark = checked ? 'x' : ' ';
    String newLineText = prefix + '[' + mark + ']' + lineText.substring(m.end());
    return text.substring(0, lineStart) + newLineText + text.substring(lineEnd);
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
      match.startIndex = dataStart;
      match.endIndex = cursor;
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

      if (!isValidBase64(match.base64Data)) {
        throw new MarkdownImageHandlerException(
          'Embedded image data is not valid Base64.'
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
    return SUPPORTED_IMAGE_MIME_TYPES.contains(mimeType.toLowerCase());
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
  private static Boolean isValidBase64(String base64Data) {
    if (String.isBlank(base64Data)) {
      return false;
    }
    return Pattern.matches('[A-Za-z0-9+/]+=*', base64Data) &&
      base64Data.length() > 0;
  }

  // Centralizes the write path for every caller (save w/ or w/o images,
  // checkbox toggle) so the Markdown -> Task status sync always runs
  // wherever the field actually ends up being persisted, regardless of
  // which entry point wrote it.
  private static void updateRecordField(
    Id recordId,
    String fieldApiName,
    String value
  ) {
    MarkdownRecordFieldAccessor.updateRecordField(recordId, fieldApiName, value);
    MarkdownTaskSync.syncCheckboxStatesFromMarkdown(recordId, fieldApiName, value);
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
    public Integer startIndex;
    public Integer endIndex;
  }

  public class MarkdownImageHandlerException extends Exception {
  }
}
