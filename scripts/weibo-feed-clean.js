/**
 * Weibo ad-only response cleaner.
 *
 * It covers common timeline and card response shapes, but removes an entry
 * only when Weibo supplies a specific advertising marker or advertising ID.
 * Search terms, comments, profiles, menus and other normal content are not
 * rewritten. Unexpected JSON is passed through unchanged.
 */

const originalBody = $response.body;

const adLabels = new Set(["广告", "廣告", "热推", "熱推"]);
const adCardTypes = new Set([118, 180, 1007]);
const arrayKeys = ["statuses", "items", "cards", "card_group"];
const wrapperKeys = ["data", "result", "payload", "header"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalized(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasAdSource(value) {
  const source = normalized(value);
  return (
    source === "ad" ||
    source.startsWith("ad_") ||
    source.includes("res_from:ads") ||
    source.includes("ads_word")
  );
}

function getCandidates(entry) {
  const candidates = [];

  if (isObject(entry)) {
    candidates.push(entry);
  }
  if (isObject(entry?.data)) {
    candidates.push(entry.data);
  }
  if (isObject(entry?.mblog)) {
    candidates.push(entry.mblog);
  }
  if (isObject(entry?.data?.mblog)) {
    candidates.push(entry.data.mblog);
  }

  return candidates;
}

function getEntryIds(entry) {
  const ids = new Set();

  for (const candidate of getCandidates(entry)) {
    for (const key of ["id", "idstr", "mid", "mblogid"]) {
      if (candidate[key] !== undefined && candidate[key] !== null) {
        ids.add(String(candidate[key]));
      }
    }
  }

  return ids;
}

function collectAdvertiseIds(container, target) {
  if (!Array.isArray(container?.advertises)) {
    return;
  }

  for (const entry of container.advertises) {
    if (typeof entry === "string" || typeof entry === "number") {
      target.add(String(entry));
      continue;
    }

    for (const id of getEntryIds(entry)) {
      target.add(id);
    }
  }
}

function isMarkedAd(entry, advertiseIds) {
  if (!isObject(entry)) {
    return false;
  }

  for (const id of getEntryIds(entry)) {
    if (advertiseIds.has(id)) {
      return true;
    }
  }

  for (const candidate of getCandidates(entry)) {
    if (
      adLabels.has(candidate.mblogtypename) ||
      adLabels.has(candidate.adType) ||
      adLabels.has(candidate.content_auth_info?.content_auth_title) ||
      normalized(candidate.promotion?.type) === "ad" ||
      hasAdSource(candidate.page_info?.actionlog?.source) ||
      hasAdSource(candidate.actionlog?.source) ||
      hasAdSource(candidate.actionlog?.ext) ||
      hasAdSource(candidate.itemid) ||
      hasAdSource(candidate.itemId) ||
      candidate.is_ad === true ||
      candidate.is_ad === 1 ||
      candidate.isAd === true ||
      candidate.isAd === 1 ||
      adCardTypes.has(candidate.card_type)
    ) {
      return true;
    }
  }

  // This is an established Weibo card marker used inside nested action data.
  // Limit the string scan to unambiguous tokens instead of generic "ad" text.
  try {
    const serialized = JSON.stringify(entry).toLowerCase();
    return (
      serialized.includes("res_from:ads") ||
      serialized.includes("\"ads_word\"")
    );
  } catch {
    return false;
  }
}

function cleanArray(entries, advertiseIds, depth) {
  let removed = 0;
  const output = [];

  for (const entry of entries) {
    if (isMarkedAd(entry, advertiseIds)) {
      removed += 1;
      continue;
    }

    removed += cleanContainer(entry, advertiseIds, depth + 1);
    output.push(entry);
  }

  return { output, removed };
}

function cleanContainer(container, advertiseIds, depth = 0) {
  if (!isObject(container) || depth > 6) {
    return 0;
  }

  collectAdvertiseIds(container, advertiseIds);
  let removed = 0;

  for (const key of arrayKeys) {
    if (!Array.isArray(container[key])) {
      continue;
    }

    const result = cleanArray(container[key], advertiseIds, depth);
    if (result.removed > 0) {
      container[key] = result.output;
      removed += result.removed;
    }
  }

  for (const key of wrapperKeys) {
    removed += cleanContainer(container[key], advertiseIds, depth + 1);
  }

  if (isObject(container.channelInfo) && Array.isArray(container.channelInfo.channels)) {
    for (const channel of container.channelInfo.channels) {
      removed += cleanContainer(channel?.payload, advertiseIds, depth + 1);
    }
  }

  for (const key of ["ad", "ads", "advertises"]) {
    if (Array.isArray(container[key]) && container[key].length > 0) {
      removed += container[key].length;
      container[key] = [];
    }
  }

  return removed;
}

try {
  const payload = JSON.parse(originalBody);
  const advertiseIds = new Set();

  // Collect the ID lists before filtering because some responses keep the
  // marker list at the root and the matching posts in a nested data object.
  collectAdvertiseIds(payload, advertiseIds);
  collectAdvertiseIds(payload?.data, advertiseIds);

  const removed = cleanContainer(payload, advertiseIds);
  const hadAdMetadata = advertiseIds.size > 0;

  if (removed > 0 || hadAdMetadata) {
    console.log(
      `[weibo-feed-clean] removed ${removed} ad item(s), matched ${advertiseIds.size} ad id(s)`
    );
    $done({ body: JSON.stringify(payload) });
  } else {
    $done({ body: originalBody });
  }
} catch (error) {
  console.log(`[weibo-feed-clean] pass through: ${String(error)}`);
  $done({ body: originalBody });
}
