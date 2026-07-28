/**
 * Conservative Weibo feed ad cleaner.
 *
 * Only filters entries in known timeline arrays when Weibo explicitly labels
 * the entry as an ad or promoted content. Unexpected JSON and response shapes
 * are passed through unchanged.
 */

const originalBody = $response.body;

const adLabels = new Set(["广告", "廣告", "热推", "熱推"]);

function isMarkedAd(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const data = entry.data && typeof entry.data === "object" ? entry.data : entry;
  const post = data.mblog && typeof data.mblog === "object" ? data.mblog : data;

  return (
    adLabels.has(post.mblogtypename) ||
    post.promotion?.type === "ad" ||
    post.page_info?.actionlog?.source === "ad" ||
    adLabels.has(post.content_auth_info?.content_auth_title)
  );
}

function filterTimeline(container) {
  if (!container || typeof container !== "object") {
    return 0;
  }

  let removed = 0;

  for (const key of ["statuses", "items"]) {
    if (!Array.isArray(container[key])) {
      continue;
    }

    const before = container[key].length;
    container[key] = container[key].filter((entry) => !isMarkedAd(entry));
    removed += before - container[key].length;
  }

  return removed;
}

try {
  const payload = JSON.parse(originalBody);
  let removed = filterTimeline(payload);
  removed += filterTimeline(payload?.data);

  if (removed > 0) {
    console.log(`[weibo-feed-clean] removed ${removed} marked ad item(s)`);
    $done({ body: JSON.stringify(payload) });
  } else {
    $done({ body: originalBody });
  }
} catch (error) {
  console.log(`[weibo-feed-clean] pass through: ${String(error)}`);
  $done({ body: originalBody });
}
