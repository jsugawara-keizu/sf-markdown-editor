public with sharing class MarkdownImageHandler {
  private static final String DOWNLOAD_URL_TEMPLATE = '/sfc/servlet.shepherd/document/download/{0}';
  private static final Integer MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
  private static final Integer MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
  private static final Integer CPU_TIME_THRESHOLD_MS = 10000; // 10 seconds
  private static final Integer HEAP_BUFFER_BYTES = 256 * 1024; // 256 KB
  // Bound for findBase64RunEnd()'s per-chunk regex scan. Confirmed against
  // this org: Pattern-based matching starts throwing "Regex too complicated"
  // somewhere between 1,000,000 and 1,500,000 characters in a single call,
  // and a naive one-character-at-a-time loop exhausts the Apex CPU time
  // governor limit even earlier (~700,000-900,000 characters) due to
  // per-character method-call overhead. 200,000 leaves wide headroom below
  // both limits while keeping the number of chunk operations small even for
  // a 2MB (~2,796,204 character) image.
  private static final Integer BASE64_SCAN_CHUNK_SIZE = 200000;
  private static final Pattern NON_BASE64_CHAR_PATTERN = Pattern.compile('[^A-Za-z0-9+/=]');
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
      throw friendlyError(mie.getMessage());
    } catch (System.LimitException le) {
      throw friendlyError(
        'Failed to save markdown due to Salesforce runtime limits. Reduce the number or size of embedded images and try again. ' +
        le.getMessage()
      );
    } catch (DmlException de) {
      throw friendlyError(
        'Failed to save embedded images. Reduce the number or size of images and try again. ' +
        de.getMessage()
      );
    } catch (Exception e) {
      throw friendlyError('Failed to save markdown with images: ' + e.getMessage());
    }
  }

  // AuraHandledException's own message constructor argument is NOT what
  // getMessage() returns on the client — confirmed against this org,
  // getMessage() always comes back as the generic "Script-thrown exception"
  // unless setMessage() is called explicitly first. Every friendly message
  // this class builds (image too large, unsupported type, runtime-limit
  // guidance, etc.) was silently being replaced with that generic string
  // before reaching the LWC caller. Centralized here so every throw site
  // gets the fix instead of relying on each call site to remember it.
  private static AuraHandledException friendlyError(String message) {
    AuraHandledException ex = new AuraHandledException(message);
    ex.setMessage(message);
    return ex;
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
      throw friendlyError(mie.getMessage());
    } catch (MarkdownRecordFieldAccessor.FieldAccessException fae) {
      throw friendlyError(fae.getMessage());
    } catch (Exception e) {
      throw friendlyError('Failed to toggle checkbox: ' + e.getMessage());
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
    checkRuntimeLimits(
      Limits.getCpuTime(),
      Limits.getHeapSize(),
      Limits.getLimitHeapSize()
    );
  }

  // Split out from checkRuntimeLimits() so the threshold decision itself is
  // unit-testable with explicit boundary values — actually driving real CPU
  // time or heap usage past the threshold from a test is impractical and
  // flaky, which is why this comparison logic previously had no regression
  // coverage at all.
  @TestVisible
  private static void checkRuntimeLimits(
    Integer cpuTime,
    Integer heapSize,
    Integer heapLimit
  ) {
    if (cpuTime > CPU_TIME_THRESHOLD_MS) {
      throw new MarkdownImageHandlerException(
        'Processing is too close to Salesforce CPU time limit. Reduce the size or number of embedded images and try again.'
      );
    }

    if (heapSize > heapLimit - HEAP_BUFFER_BYTES) {
      throw new MarkdownImageHandlerException(
        'Processing is too close to Salesforce heap limit. Reduce the size or number of embedded images and try again.'
      );
    }
  }

  // Finds where a run of base64-alphabet characters (plus '=' padding)
  // starting at `start` ends, by scanning in bounded chunks with one regex
  // find() per chunk rather than one method call per character — see
  // BASE64_SCAN_CHUNK_SIZE for why. Each chunk stays far under both the
  // regex-engine and per-character-loop limits regardless of total input
  // size, at the cost of stopping at most BASE64_SCAN_CHUNK_SIZE characters
  // late if the run's true end isn't the first non-base64 character
  // scanned — which never happens here since the pattern matches exactly
  // the complement of the base64 alphabet.
  @TestVisible
  private static Integer findBase64RunEnd(String text, Integer start) {
    Integer cursor = start;
    Integer textLength = text.length();
    while (cursor < textLength) {
      Integer chunkEnd = Math.min(cursor + BASE64_SCAN_CHUNK_SIZE, textLength);
      Matcher notBase64 = NON_BASE64_CHAR_PATTERN.matcher(
        text.substring(cursor, chunkEnd)
      );
      if (notBase64.find()) {
        return cursor + notBase64.start();
      }
      cursor = chunkEnd;
    }
    return textLength;
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
      Integer cursor = findBase64RunEnd(markdown, base64Start);

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

  @TestVisible
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

  @TestVisible
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

  // Deliberately avoids Pattern.matches() and any per-character loop: both
  // throw "System.LimitException: Regex too complicated" / "Apex CPU time
  // limit exceeded" once base64Data crosses roughly 1-1.5 million characters
  // (well inside the advertised 2MB-per-image limit, ~2.8 million
  // characters) — confirmed against this org. extractDataUris() already
  // guarantees base64Data contains nothing outside the base64 alphabet plus
  // '=' (findBase64RunEnd()'s scan only advances past characters matching
  // that alphabet), so the only thing left worth checking here — cheaply,
  // via a couple of native String scans instead of one per character — is
  // that any padding is a well-formed trailing block, not scattered through
  // the middle.
  @TestVisible
  private static Boolean isValidBase64(String base64Data) {
    if (String.isBlank(base64Data)) {
      return false;
    }
    Integer contentLength = base64Data.length();
    if (base64Data.endsWith('==')) {
      contentLength -= 2;
    } else if (base64Data.endsWith('=')) {
      contentLength -= 1;
    }
    if (contentLength <= 0) {
      return false;
    }
    return !base64Data.substring(0, contentLength).contains('=');
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
