/**
 * Weibo ad-only response cleaner.
 *
 * It covers common timeline and card response shapes, but removes an entry
 * only when Weibo supplies a specific advertising marker or advertising ID.
 * Search terms, comments, profiles, menus and other normal content are not
 * rewritten. Unexpected JSON is passed through unchanged.
 */

const originalBody = $response.body;

const explicitAdLabels = new Set(["广告", "廣告"]);
const promotedPostLabels = new Set(["广告", "廣告", "热推", "熱推"]);
const arrayKeys = [
  "statuses",
  "items",
  "cards",
  "card_group",
  "banners",
  "banner_list",
  "carousel",
  "carousel_list",
  "card_list",
];
const wrapperKeys = [
  "data",
  "result",
  "payload",
  "header",
  "content",
  "container",
  "module",
];
const adObjectKeys = [
  "banner",
  "banner_data",
  "top_banner",
  "ad_banner",
  "carousel",
];
const hotSearchKeys = [
  "hotwords",
  "hot_words",
  "hot_search",
  "search_words",
  "trends",
];
const labelContainerPattern =
  /(?:^|_)(?:ad|ads|advert|advertise|badge|label|mark|tag)(?:_|$)/i;

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

function isPositiveAdValue(value) {
  if (value === true || value === 1 || value === "1") {
    return true;
  }

  const text = normalized(value);
  return text === "ad" || text === "ads" || explicitAdLabels.has(value);
}

function hasStructuredAdLabel(value, depth = 0, insideLabelContainer = false) {
  if (depth > 6 || value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return insideLabelContainer && explicitAdLabels.has(value.trim());
  }

  if (Array.isArray(value)) {
    return value.some((entry) =>
      hasStructuredAdLabel(entry, depth + 1, insideLabelContainer)
    );
  }

  if (!isObject(value)) {
    return false;
  }

  for (const [key, entry] of Object.entries(value)) {
    // Child feed/card arrays are evaluated entry by entry. Do not let a label
    // buried in one child cause the whole surrounding section to be removed.
    if (arrayKeys.includes(key)) {
      continue;
    }

    const nextInside =
      insideLabelContainer ||
      labelContainerPattern.test(key) ||
      ["title_extra_text", "card_type_name"].includes(key);

    if (hasStructuredAdLabel(entry, depth + 1, nextInside)) {
      return true;
    }
  }

  return false;
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

  const hasMblog =
    isObject(entry.mblog) ||
    isObject(entry.data?.mblog);

  for (const candidate of getCandidates(entry)) {
    if (
      promotedPostLabels.has(candidate.mblogtypename) ||
      explicitAdLabels.has(candidate.adType) ||
      explicitAdLabels.has(candidate.content_auth_info?.content_auth_title) ||
      normalized(candidate.promotion?.type) === "ad" ||
      hasAdSource(candidate.page_info?.actionlog?.source) ||
      hasAdSource(candidate.actionlog?.source) ||
      hasAdSource(candidate.actionlog?.ext) ||
      hasAdSource(candidate.itemid) ||
      hasAdSource(candidate.itemId) ||
      isPositiveAdValue(candidate.is_ad) ||
      isPositiveAdValue(candidate.isAd) ||
      isPositiveAdValue(candidate.ad_state) ||
      isPositiveAdValue(candidate.adState) ||
      isPositiveAdValue(candidate.ad_flag) ||
      isPositiveAdValue(candidate.adFlag) ||
      isPositiveAdValue(candidate.ad_mark) ||
      isPositiveAdValue(candidate.adMark) ||
      isPositiveAdValue(candidate.ad_label) ||
      isPositiveAdValue(candidate.adLabel)
    ) {
      return true;
    }
  }

  // Promotional banner cards often have no mblog object. Their visible
  // "广告" badge is nested under a badge/label/tag container instead.
  if (!hasMblog && hasStructuredAdLabel(entry)) {
    return true;
  }

  // This is an established Weibo card marker used inside nested action data.
  // Exclude child content arrays: an ad child must not cause its surrounding
  // hot-search/feed section to be classified as an ad.
  try {
    const serialized = JSON.stringify(entry, (key, value) =>
      arrayKeys.includes(key) ? undefined : value
    ).toLowerCase();
    return (
      serialized.includes("res_from:ads") ||
      /[?&](?:adid|ad_id|adsid|creative_id)=/i.test(serialized)
    );
  } catch {
    return false;
  }
}

function getContentArrayStats(value, depth = 0) {
  if (!isObject(value) || depth > 3) {
    return { arrays: 0, entries: 0 };
  }

  let arrays = 0;
  let entries = 0;

  for (const key of arrayKeys) {
    if (Array.isArray(value[key])) {
      arrays += 1;
      entries += value[key].length;
    }
  }

  for (const key of wrapperKeys) {
    const nested = getContentArrayStats(value[key], depth + 1);
    arrays += nested.arrays;
    entries += nested.entries;
  }

  return { arrays, entries };
}

function hasProtectedHotSearchContent(value, depth = 0) {
  if (!isObject(value) || depth > 3) {
    return false;
  }

  for (const key of hotSearchKeys) {
    if (
      (Array.isArray(value[key]) && value[key].length > 0) ||
      isObject(value[key])
    ) {
      return true;
    }
  }

  for (const key of ["title", "name", "card_type_name"]) {
    const text = typeof value[key] === "string" ? value[key] : "";
    if (/(?:微博)?热搜|热榜/.test(text)) {
      return true;
    }
  }

  return wrapperKeys.some((key) =>
    hasProtectedHotSearchContent(value[key], depth + 1)
  );
}

function cleanArray(entries, advertiseIds, depth) {
  let removed = 0;
  const output = [];

  for (const entry of entries) {
    const before = getContentArrayStats(entry);
    const protectsHotSearch = hasProtectedHotSearchContent(entry);

    // Structural parent groups (such as the combined hot-search + banner
    // section) are never classified from their own ad metadata. Clean their
    // child cards individually so one promotional child cannot remove the
    // surrounding hot-search block.
    if (before.arrays > 0 || protectsHotSearch) {
      const nestedRemoved = cleanContainer(entry, advertiseIds, depth + 1);
      const after = getContentArrayStats(entry);
      removed += nestedRemoved;

      if (
        !protectsHotSearch &&
        before.entries > 0 &&
        after.entries === 0 &&
        nestedRemoved > 0
      ) {
        removed += 1;
        continue;
      }

      output.push(entry);
      continue;
    }

    if (isMarkedAd(entry, advertiseIds)) {
      removed += 1;
      continue;
    }

    const nestedRemoved = cleanContainer(entry, advertiseIds, depth + 1);
    removed += nestedRemoved;
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

  for (const key of adObjectKeys) {
    if (!isObject(container[key])) {
      continue;
    }

    if (isMarkedAd(container[key], advertiseIds)) {
      delete container[key];
      removed += 1;
    } else {
      removed += cleanContainer(container[key], advertiseIds, depth + 1);
    }
  }

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
