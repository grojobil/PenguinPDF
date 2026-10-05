/** @OnlyCurrentDoc */

var REVIEW_RATING_TITLE = "How would you rate PenguinPDF? / ¿Cómo valorarías PenguinPDF?";
var REVIEW_COMMENT_TITLE = "Your feedback (optional) / Tu comentario (opcional)";
var REVIEW_NAME_TITLE = "Display name (optional) / Nombre público (opcional)";
var REVIEW_CONSENT_TITLE = "May we feature your comment? (optional) / ¿Podemos publicar tu comentario? (opcional)";
var REVIEW_CONSENT = "Yes, PenguinPDF may publish my comment and display name on its website. / Sí, PenguinPDF puede publicar mi comentario y nombre público en su web.";

var REVIEW_META_PROPERTY = "reviews.feed.meta.v1";
var REVIEW_CARD_PROPERTY_PREFIX = "reviews.feed.card.v1.";
var REVIEW_MAX_CARDS = 10;
var REVIEW_PROPERTY_BYTE_LIMIT = 9000;
var REVIEW_CHUNK_PROPERTY_PREFIX = "reviews.feed.chunk.v2.";
var REVIEW_SNAPSHOT_BYTE_LIMIT = 200000;
var REVIEW_STORE_BYTE_LIMIT = 500000;
var REVIEW_MAX_REVIEWS = 5000;
// Import provenance for historical feedback whose original date is unknown.
var REVIEW_IMPORTED_DATES = {
  "08a753a8049a8577": "2026-09-29",
  "0969b2c71863b53e": "2026-09-29",
  "223b930c536cf617": "2026-09-29",
  "2aecb54689af13cb": "2026-09-29",
  "2b9142dc7acc4101": "2026-09-29",
  "2ba51b646a79f140": "2026-09-29",
  "2ef259a2d2529c81": "2026-09-29",
  "39972d1114ef4b85": "2026-09-29",
  "42f9b298d488885e": "2026-09-29",
  "4d9f331de13051b0": "2026-09-29",
  "56b3bfde068ab427": "2026-09-29",
  "57cb49fec740d730": "2026-09-29",
  "5a61e3255dd4937f": "2026-09-29",
  "60d4b7d7e8bcee36": "2026-09-29",
  "6bba5654cd0cece5": "2026-09-29",
  "760af31f5cf0979c": "2026-09-29",
  "819a0a413c7f7c4f": "2026-09-29",
  "84347bfd1fe0c7e9": "2026-09-29",
  "8c143a39cd649dba": "2026-09-29",
  "92b174a051df4ac4": "2026-09-29",
  "9944a3ce2b429cfb": "2026-09-29",
  "9a4b7eaa50de1a32": "2026-09-29",
  "a9a6cb2ec3fa46e3": "2026-09-29",
  "b10c00e3ec040d4b": "2026-09-29",
  "b57b5c7de6c6af0b": "2026-09-29",
  "c7ba09b083ba0efc": "2026-09-29",
  "cd2d3171ea190316": "2026-09-29",
  "d2846bf7a1983b98": "2026-09-29",
  "d38a1fdb53a7c0e9": "2026-09-29",
  "ea7f2d8d6e9f5bb7": "2026-09-29",
};
// Original feedback dates recovered by the owner, matched to exact source records.
var REVIEW_HISTORICAL_FEEDBACK_DATES = {
  "08a753a8049a8577": "2026-08-18",
  "0969b2c71863b53e": "2026-04-06",
  "223b930c536cf617": "2026-07-18",
  "2aecb54689af13cb": "2026-04-12",
  "2b9142dc7acc4101": "2026-04-24",
  "2ba51b646a79f140": "2026-08-30",
  "2ef259a2d2529c81": "2026-09-11",
  "39972d1114ef4b85": "2026-06-30",
  "42f9b298d488885e": "2026-06-24",
  "4d9f331de13051b0": "2026-05-12",
  "56b3bfde068ab427": "2026-04-30",
  "57cb49fec740d730": "2026-05-31",
  "5a61e3255dd4937f": "2026-05-18",
  "60d4b7d7e8bcee36": "2026-09-17",
  "6bba5654cd0cece5": "2026-08-24",
  "760af31f5cf0979c": "2026-08-11",
  "819a0a413c7f7c4f": "2026-07-06",
  "84347bfd1fe0c7e9": "2026-09-29",
  "8c143a39cd649dba": "2026-06-06",
  "92b174a051df4ac4": "2026-07-30",
  "9944a3ce2b429cfb": "2026-07-24",
  "9a4b7eaa50de1a32": "2026-05-25",
  "a9a6cb2ec3fa46e3": "2026-07-12",
  "b10c00e3ec040d4b": "2026-06-18",
  "b57b5c7de6c6af0b": "2026-04-18",
  "c7ba09b083ba0efc": "2026-09-23",
  "cd2d3171ea190316": "2026-06-12",
  "d2846bf7a1983b98": "2026-05-06",
  "d38a1fdb53a7c0e9": "2026-08-05",
  "ea7f2d8d6e9f5bb7": "2026-09-05",
};

function buildPublicReviews(records, updatedAt) {
  if (!Array.isArray(records) || typeof updatedAt !== "string" || !isValidDateString_(updatedAt)) {
    throw new Error("Invalid review records.");
  }

  var validated = records.map(validateRecord_);
  validated.sort(function (left, right) {
    if (left.date !== right.date) return left.date > right.date ? -1 : 1;
    if (left.timestampMs !== right.timestampMs) return right.timestampMs - left.timestampMs;
    return left.sourceId < right.sourceId ? -1 : left.sourceId > right.sourceId ? 1 : 0;
  });

  var seenSourceIds = Object.create(null);
  var ratingCount = 0;
  var ratingSum = 0;
  var candidates = [];

  validated.forEach(function (record) {
    if (seenSourceIds[record.sourceId]) return;
    seenSourceIds[record.sourceId] = true;
    if (hasQaPrefix_(record.comment) || hasQaPrefix_(record.displayName)) return;

    ratingCount += 1;
    ratingSum += record.rating;
    if (record.consent !== true || !record.comment.trim()) return;
    if (codePointLength_(record.comment) > 600 || codePointLength_(record.displayName) > 60) return;
    if (hasObviousContactOrLink_(record.comment) || hasObviousContactOrLink_(record.displayName)) return;

    candidates.push(record);
  });

  var selectedNormalized = [];
  var featured = [];
  var reviews = candidates.map(publicReview_);
  for (var index = 0; index < candidates.length && featured.length < REVIEW_MAX_CARDS; index += 1) {
    var candidate = candidates[index];
    if (candidate.rating !== 5) continue;
    var normalized = normalizeComment_(candidate.comment);
    var repeated = selectedNormalized.some(function (prior) {
      return commentsAreNearDuplicate_(normalized, prior);
    });
    if (repeated) continue;
    selectedNormalized.push(normalized);
    featured.push(Object.assign({}, reviews[index]));
  }

  var snapshot = {
    schemaVersion: 2,
    updatedAt: updatedAt,
    ratingCount: ratingCount,
    ratingSum: ratingSum,
    featured: featured,
    reviews: reviews,
  };
  if (!isValidPublicSnapshot_(snapshot)) throw new Error("Invalid review snapshot.");
  assertSnapshotSize_(snapshot);
  return snapshot;
}

function refreshReviews() {
  try {
    var form = FormApp.getActiveForm();
    if (!form) throw new Error("Missing form.");
    validateForm_(form);
    var records = form.getResponses().map(readFormResponse_);
    var snapshot = buildPublicReviews(records, new Date().toISOString());
    storeSnapshot_(snapshot);
    return snapshot;
  } catch (error) {
    throw new Error("Review refresh failed.");
  }
}

function doGet() {
  var body;
  try {
    body = JSON.stringify(readStoredSnapshot_());
  } catch (error) {
    body = JSON.stringify({ error: "Reviews unavailable." });
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function setupReviewAutomation() {
  refreshReviews();
  var hasHourlyRefresh = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === "refreshReviews" &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  });
  if (!hasHourlyRefresh) {
    ScriptApp.newTrigger("refreshReviews").timeBased().everyHours(1).create();
  }
}

function expectedFormItems_() {
  return [
    { title: REVIEW_RATING_TITLE, type: FormApp.ItemType.RATING },
    { title: REVIEW_COMMENT_TITLE, type: FormApp.ItemType.PARAGRAPH_TEXT },
    { title: REVIEW_NAME_TITLE, type: FormApp.ItemType.TEXT },
    { title: REVIEW_CONSENT_TITLE, type: FormApp.ItemType.CHECKBOX },
  ];
}

function validateForm_(form) {
  var items = form.getItems();
  var expected = expectedFormItems_();
  if (!Array.isArray(items) || items.length !== expected.length) throw new Error("Unexpected form.");

  var found = Object.create(null);
  items.forEach(function (item) {
    var title = item.getTitle();
    if (found[title]) throw new Error("Unexpected form.");
    found[title] = item.getType();
  });
  expected.forEach(function (definition) {
    if (!Object.prototype.hasOwnProperty.call(found, definition.title) || found[definition.title] !== definition.type) {
      throw new Error("Unexpected form.");
    }
  });
}

function readFormResponse_(response) {
  var values = Object.create(null);
  var types = Object.create(null);
  expectedFormItems_().forEach(function (definition) {
    values[definition.title] = null;
    types[definition.title] = definition.type;
  });

  var itemResponses = response.getItemResponses();
  if (!Array.isArray(itemResponses) || itemResponses.length > 4) throw new Error("Invalid response.");
  itemResponses.forEach(function (itemResponse) {
    var item = itemResponse.getItem();
    var title = item.getTitle();
    if (!Object.prototype.hasOwnProperty.call(values, title) || values[title] !== null || item.getType() !== types[title]) {
      throw new Error("Invalid response.");
    }
    values[title] = itemResponse.getResponse();
  });

  var rating = values[REVIEW_RATING_TITLE];
  var comment = values[REVIEW_COMMENT_TITLE] === null ? "" : values[REVIEW_COMMENT_TITLE];
  var displayName = values[REVIEW_NAME_TITLE] === null ? "" : values[REVIEW_NAME_TITLE];
  var consentResponse = values[REVIEW_CONSENT_TITLE] === null ? [] : values[REVIEW_CONSENT_TITLE];
  var validRating = (typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5) ||
    (typeof rating === "string" && /^[1-5]$/.test(rating));
  if (!validRating ||
      typeof comment !== "string" || typeof displayName !== "string" || !Array.isArray(consentResponse) ||
      (consentResponse.length !== 0 && (consentResponse.length !== 1 || consentResponse[0] !== REVIEW_CONSENT))) {
    throw new Error("Invalid response.");
  }

  return {
    id: response.getId(),
    rating: typeof rating === "number" ? rating : Number(rating),
    comment: comment,
    displayName: displayName,
    consent: consentResponse.length === 1,
    timestamp: response.getTimestamp(),
  };
}

function validateRecord_(record) {
  if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id ||
      record.id.length > 1024 || !Number.isInteger(record.rating) || record.rating < 1 || record.rating > 5 ||
      typeof record.comment !== "string" || typeof record.displayName !== "string" ||
      typeof record.consent !== "boolean" ||
      !(record.timestamp instanceof Date || typeof record.timestamp === "string")) {
    throw new Error("Invalid review records.");
  }
  var timestampMs = new Date(record.timestamp).getTime();
  if (!Number.isFinite(timestampMs)) throw new Error("Invalid review records.");
  var validated = {
    sourceId: record.id,
    rating: record.rating,
    comment: record.comment,
    displayName: record.displayName,
    consent: record.consent,
    timestampMs: timestampMs,
  };
  var metadata = reviewDate_(validated);
  validated.date = metadata.date;
  validated.dateType = metadata.dateType;
  return validated;
}

function reviewDate_(candidate) {
  var fingerprint = publicReviewId_(JSON.stringify([
    candidate.rating, candidate.comment.trim(), candidate.displayName.trim(),
    new Date(Math.floor(candidate.timestampMs / 1000) * 1000).toISOString(),
  ]));
  var imported = Object.prototype.hasOwnProperty.call(REVIEW_IMPORTED_DATES, fingerprint);
  var recovered = Object.prototype.hasOwnProperty.call(REVIEW_HISTORICAL_FEEDBACK_DATES, fingerprint);
  var date = recovered ? REVIEW_HISTORICAL_FEEDBACK_DATES[fingerprint] : imported ? REVIEW_IMPORTED_DATES[fingerprint] :
    Utilities.formatDate(new Date(candidate.timestampMs), "America/Los_Angeles", "yyyy-MM-dd");
  if (!isValidCalendarDay_(date)) throw new Error("Invalid review date.");
  return { date: date, dateType: imported && !recovered ? "imported" : "submitted" };
}

function publicReview_(candidate) {
  return {
    id: publicReviewId_(candidate.sourceId),
    rating: candidate.rating,
    comment: candidate.comment,
    displayName: candidate.displayName,
    date: candidate.date,
    dateType: candidate.dateType,
  };
}

function hasQaPrefix_(value) {
  return value.replace(/^\s+/u, "").toUpperCase().indexOf("QA TEST") === 0;
}

function codePointLength_(value) {
  return Array.from(value).length;
}

function normalizeComment_(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function commentsAreNearDuplicate_(left, right) {
  if (left === right) return true;
  var shorter = left.length <= right.length ? left : right;
  var longer = left.length > right.length ? left : right;
  if (shorter.length >= 20 && longer.indexOf(shorter) !== -1 && shorter.length / longer.length >= 0.85) return true;

  var leftTokens = uniqueTokens_(left);
  var rightTokens = uniqueTokens_(right);
  if (Math.min(leftTokens.length, rightTokens.length) < 4) return false;
  var rightSet = Object.create(null);
  rightTokens.forEach(function (token) { rightSet[token] = true; });
  var intersection = leftTokens.filter(function (token) { return rightSet[token]; }).length;
  var union = leftTokens.length + rightTokens.length - intersection;
  return union > 0 && intersection / union >= 0.9;
}

function uniqueTokens_(value) {
  var seen = Object.create(null);
  return value.split(" ").filter(function (token) {
    if (!token || seen[token]) return false;
    seen[token] = true;
    return true;
  });
}

function hasObviousContactOrLink_(value) {
  return /(?:https?:\/\/|www\.)\S+/iu.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(value) ||
    /(?:^|\s)\+?\d[\d\s().-]{7,}\d(?:$|\s)/u.test(value);
}

function storeSnapshot_(snapshot) {
  if (!isValidPublicSnapshot_(snapshot)) throw new Error("Invalid review snapshot.");
  var serializedSnapshot = assertSnapshotSize_(snapshot);
  var generation = publicReviewId_(serializedSnapshot);
  var entries = [];
  if (snapshot.schemaVersion === 2) {
    splitSnapshot_(serializedSnapshot).forEach(function (chunk, index) {
      entries.push({ key: chunkPropertyKey_(generation, index), value: chunk });
    });
  } else {
    snapshot.featured.forEach(function (card, index) {
      entries.push({ key: cardPropertyKey_(generation, index), value: JSON.stringify(card) });
    });
  }
  var meta = {
    schemaVersion: snapshot.schemaVersion,
    updatedAt: snapshot.updatedAt,
    ratingCount: snapshot.ratingCount,
    ratingSum: snapshot.ratingSum,
    cardCount: snapshot.featured.length,
    generation: generation,
  };
  if (snapshot.schemaVersion === 2) meta.chunkCount = entries.length;
  var serializedMeta = JSON.stringify(meta);
  entries.forEach(function (entry) { assertPropertySize_(entry.value); });
  assertPropertySize_(serializedMeta);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var previousMeta = parseMeta_(properties.getProperty(REVIEW_META_PROPERTY));
    if (previousMeta && previousMeta.schemaVersion === 2 && snapshot.schemaVersion === 1) {
      throw new Error("Review snapshot downgrade refused.");
    }
    // Include unrelated properties and both generations before the pointer switch.
    var projected = properties.getProperties();
    entries.forEach(function (entry) { projected[entry.key] = entry.value; });
    var oldMetaBytes = byteLength_(projected[REVIEW_META_PROPERTY] || "");
    projected[REVIEW_META_PROPERTY] = serializedMeta;
    var totalBytes = Object.keys(projected).reduce(function (total, key) {
      return total + byteLength_(key) + byteLength_(projected[key]);
    }, 0);
    totalBytes += Math.max(0, oldMetaBytes - byteLength_(serializedMeta));
    if (totalBytes > REVIEW_STORE_BYTE_LIMIT) throw new Error("Review storage capacity exceeded.");
    var newKeys = [];

    try {
      entries.forEach(function (entry) {
        newKeys.push(entry.key);
        properties.setProperty(entry.key, entry.value);
      });
      properties.setProperty(REVIEW_META_PROPERTY, serializedMeta);
    } catch (error) {
      if (!previousMeta || previousMeta.generation !== generation) {
        newKeys.forEach(function (key) {
          try { properties.deleteProperty(key); } catch (ignored) {}
        });
      }
      throw error;
    }

    if (previousMeta && previousMeta.generation !== generation) {
      var oldCount = previousMeta.schemaVersion === 2 ? previousMeta.chunkCount : previousMeta.cardCount;
      for (var oldIndex = 0; oldIndex < oldCount; oldIndex += 1) {
        var oldKey = previousMeta.schemaVersion === 2 ? chunkPropertyKey_(previousMeta.generation, oldIndex) :
          cardPropertyKey_(previousMeta.generation, oldIndex);
        try { properties.deleteProperty(oldKey); } catch (ignored) {}
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function readStoredSnapshot_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var meta = parseMeta_(properties.getProperty(REVIEW_META_PROPERTY));
    if (!meta) throw new Error("Unavailable.");
    if (meta.schemaVersion === 2) {
      var chunks = [];
      var bytes = 0;
      for (var chunkIndex = 0; chunkIndex < meta.chunkCount; chunkIndex += 1) {
        var chunk = properties.getProperty(chunkPropertyKey_(meta.generation, chunkIndex));
        if (typeof chunk !== "string") throw new Error("Unavailable.");
        assertPropertySize_(chunk);
        bytes += byteLength_(chunk);
        if (bytes > REVIEW_SNAPSHOT_BYTE_LIMIT) throw new Error("Unavailable.");
        chunks.push(chunk);
      }
      var prepared = JSON.parse(chunks.join(""));
      if (!isValidPublicSnapshot_(prepared) || prepared.schemaVersion !== 2 ||
          prepared.updatedAt !== meta.updatedAt || prepared.ratingCount !== meta.ratingCount ||
          prepared.ratingSum !== meta.ratingSum || prepared.featured.length !== meta.cardCount) throw new Error("Unavailable.");
      return prepared;
    }
    var featured = [];
    for (var index = 0; index < meta.cardCount; index += 1) {
      var serialized = properties.getProperty(cardPropertyKey_(meta.generation, index));
      if (typeof serialized !== "string") throw new Error("Unavailable.");
      assertPropertySize_(serialized);
      featured.push(JSON.parse(serialized));
    }
    var snapshot = {
      schemaVersion: meta.schemaVersion,
      updatedAt: meta.updatedAt,
      ratingCount: meta.ratingCount,
      ratingSum: meta.ratingSum,
      featured: featured,
    };
    if (!isValidPublicSnapshot_(snapshot)) throw new Error("Unavailable.");
    assertSnapshotSize_(snapshot);
    return snapshot;
  } finally {
    lock.releaseLock();
  }
}

function parseMeta_(serialized) {
  if (typeof serialized !== "string") return null;
  try {
    var meta = JSON.parse(serialized);
    if (!meta || (meta.schemaVersion !== 1 && meta.schemaVersion !== 2) ||
        !hasExactKeys_(meta, meta.schemaVersion === 2 ?
          ["schemaVersion", "updatedAt", "ratingCount", "ratingSum", "cardCount", "generation", "chunkCount"] :
          ["schemaVersion", "updatedAt", "ratingCount", "ratingSum", "cardCount", "generation"]) ||
        (meta.schemaVersion === 2 && (!Number.isInteger(meta.chunkCount) || meta.chunkCount < 1 || meta.chunkCount > 26)) ||
        typeof meta.updatedAt !== "string" || !isValidDateString_(meta.updatedAt) ||
        !isSafeNonnegativeInteger_(meta.ratingCount) || !isSafeNonnegativeInteger_(meta.ratingSum) ||
        !Number.isInteger(meta.cardCount) || meta.cardCount < 0 || meta.cardCount > REVIEW_MAX_CARDS ||
        typeof meta.generation !== "string" || !/^[a-f0-9]{16}$/.test(meta.generation)) return null;
    return meta;
  } catch (error) {
    return null;
  }
}

function isValidPublicSnapshot_(snapshot) {
  var v2 = snapshot && snapshot.schemaVersion === 2;
  if (!snapshot || !hasExactKeys_(snapshot, v2 ? ["schemaVersion", "updatedAt", "ratingCount", "ratingSum", "featured", "reviews"] :
      ["schemaVersion", "updatedAt", "ratingCount", "ratingSum", "featured"]) ||
      (!v2 && snapshot.schemaVersion !== 1) || typeof snapshot.updatedAt !== "string" ||
      !isValidDateString_(snapshot.updatedAt) || !isSafeNonnegativeInteger_(snapshot.ratingCount) ||
      snapshot.ratingCount > Math.floor(Number.MAX_SAFE_INTEGER / 5) || !isSafeNonnegativeInteger_(snapshot.ratingSum) ||
      snapshot.ratingSum < snapshot.ratingCount || snapshot.ratingSum > snapshot.ratingCount * 5 ||
      !Array.isArray(snapshot.featured) || snapshot.featured.length > Math.min(REVIEW_MAX_CARDS, snapshot.ratingCount)) return false;

  var collection = v2 ? snapshot.reviews : snapshot.featured;
  if (!Array.isArray(collection) || collection.length > snapshot.ratingCount ||
      (v2 && collection.length > REVIEW_MAX_REVIEWS)) return false;
  var ids = Object.create(null);
  var sum = 0;
  var validCards = Array.from(collection).every(function (card) {
    if (!hasValidReviewFields_(card) ||
        typeof card.id !== "string" || !/^[a-f0-9]{16}$/.test(card.id) || ids[card.id] ||
        !Number.isInteger(card.rating) || card.rating < 1 || card.rating > 5 ||
        typeof card.comment !== "string" || !card.comment.trim() ||
        codePointLength_(card.comment) > 600 || typeof card.displayName !== "string" ||
        codePointLength_(card.displayName) > 60) return false;
    ids[card.id] = card;
    sum += card.rating;
    return true;
  });
  if (!validCards) return false;
  var featuredIds = Object.create(null);
  if (v2 && !Array.from(snapshot.featured).every(function (card) {
    if (!hasValidReviewFields_(card) || featuredIds[card.id]) return false;
    featuredIds[card.id] = true;
    var match = ids[card.id];
    return match && ["id", "rating", "comment", "displayName", "date", "dateType"].every(function (key) {
      return card[key] === match[key];
    });
  })) return false;
  var remaining = snapshot.ratingCount - collection.length;
  return snapshot.ratingSum >= sum + remaining && snapshot.ratingSum <= sum + remaining * 5;
}

function hasExactKeys_(value, expected) {
  var keys = Object.keys(value).sort();
  var wanted = expected.slice().sort();
  return keys.length === wanted.length && keys.every(function (key, index) { return key === wanted[index]; });
}

function hasValidReviewFields_(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return false;
  return hasExactKeys_(card, ["id", "rating", "comment", "displayName"]) ||
    (hasExactKeys_(card, ["id", "rating", "comment", "displayName", "date", "dateType"]) &&
      isValidCalendarDay_(card.date) && (card.dateType === "submitted" || card.dateType === "imported"));
}

function isValidCalendarDay_(value) {
  if (typeof value !== "string" || value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  var parts = value.split("-").map(Number);
  var year = parts[0];
  var month = parts[1];
  var day = parts[2];
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function isSafeNonnegativeInteger_(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidDateString_(value) {
  return Number.isFinite(new Date(value).getTime());
}

function cardPropertyKey_(generation, index) {
  return REVIEW_CARD_PROPERTY_PREFIX + generation + "." + index;
}

function assertPropertySize_(serialized) {
  if (byteLength_(serialized) > REVIEW_PROPERTY_BYTE_LIMIT) {
    throw new Error("Review property is too large.");
  }
}

function byteLength_(value) {
  return Utilities.newBlob(value).getBytes().length;
}

function assertSnapshotSize_(snapshot) {
  var serialized = JSON.stringify(snapshot);
  if (byteLength_(serialized) > REVIEW_SNAPSHOT_BYTE_LIMIT) throw new Error("Review snapshot is too large.");
  return serialized;
}

function chunkPropertyKey_(generation, index) {
  return REVIEW_CHUNK_PROPERTY_PREFIX + generation + "." + index;
}

function splitSnapshot_(serialized) {
  var chunks = [];
  var chunk = "";
  var bytes = 0;
  Array.from(serialized).forEach(function (character) {
    var point = character.codePointAt(0);
    var size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes + size > 8000) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += character;
    bytes += size;
  });
  if (chunk) chunks.push(chunk);
  return chunks;
}

function publicReviewId_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function (byte) { return ("0" + ((byte + 256) % 256).toString(16)).slice(-2); })
    .join("").slice(0, 16);
}
