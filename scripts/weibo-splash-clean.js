/**
 * Weibo splash-ad response cleaner.
 *
 * Known splash payloads are neutralized by moving their active window into
 * the future and resetting all display counters. Realtime ad arrays are
 * cleared because those responses are disposable. Unknown or malformed
 * responses are passed through unchanged.
 */

const originalBody = $response.body;
const requestUrl = $request.url;
const futureStart = 2681574400;
const futureEnd = 2681660799;
const futureStartText = "2054-12-30 00:00:00";
const futureEndText = "2054-12-30 23:59:59";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function setValue(target, key, value) {
  if (target[key] === value) {
    return 0;
  }

  target[key] = value;
  return 1;
}

function setExistingValue(target, key, value) {
  if (!Object.prototype.hasOwnProperty.call(target, key)) {
    return 0;
  }

  return setValue(target, key, value);
}

function neutralizeAd(ad) {
  if (!isObject(ad)) {
    return 0;
  }

  let changes = 0;

  for (const key of ["start_time", "start_date", "begintime"]) {
    changes += setExistingValue(
      ad,
      key,
      key === "begintime" ? futureStartText : futureStart
    );
  }

  for (const key of ["end_time", "end_date", "endtime"]) {
    changes += setExistingValue(
      ad,
      key,
      key === "endtime" ? futureEndText : futureEnd
    );
  }

  for (const key of [
    "display_duration",
    "daily_display_cnt",
    "total_display_cnt",
    "show_count",
    "duration",
    "displaytime",
    "allowdaydisplaynum",
    "displaynum",
  ]) {
    changes += setExistingValue(ad, key, 0);
  }

  changes += setExistingValue(ad, "displayintervel", 86400);

  // Some newer payloads omit the historical field names. Add the smallest
  // compatible scheduling set so the entry cannot become active immediately.
  if (changes === 0) {
    changes += setValue(ad, "start_time", futureStart);
    changes += setValue(ad, "end_time", futureEnd);
    changes += setValue(ad, "display_duration", 0);
  }

  return changes;
}

function cleanContainer(container, depth = 0) {
  if (!isObject(container) || depth > 5) {
    return 0;
  }

  let changes = 0;
  const isRealtime = requestUrl.includes("/ad/realtime");

  if (Array.isArray(container.ads)) {
    if (isRealtime) {
      if (container.ads.length > 0) {
        changes += container.ads.length;
        container.ads = [];
      }
    } else {
      for (const ad of container.ads) {
        changes += neutralizeAd(ad);
      }
    }
  }

  if (isObject(container.cached_ad) && Array.isArray(container.cached_ad.ads)) {
    for (const ad of container.cached_ad.ads) {
      changes += neutralizeAd(ad);
    }
  }

  for (const key of ["data", "result", "payload", "cached_ad"]) {
    changes += cleanContainer(container[key], depth + 1);
  }

  for (const key of [
    "show_push_splash_ad",
    "background_delay_display_time",
    "lastAdShow_delay_display_time",
    "realtime_ad_video_stall_time",
    "realtime_ad_timeout_duration",
  ]) {
    const value = key === "show_push_splash_ad" ? false : 0;
    changes += setExistingValue(container, key, value);
  }

  changes += setExistingValue(container, "last_ad_show_interval", 86400);

  if (isRealtime && depth === 0) {
    changes += setExistingValue(container, "code", 4016);
  }

  return changes;
}

function parseBody(body) {
  try {
    return { payload: JSON.parse(body), prefix: "", suffix: "" };
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new Error("response does not contain a JSON object");
    }

    return {
      payload: JSON.parse(body.slice(start, end + 1)),
      prefix: body.slice(0, start),
      suffix: body.slice(end + 1),
    };
  }
}

try {
  const parsed = parseBody(originalBody);
  const changes = cleanContainer(parsed.payload);

  if (changes > 0) {
    console.log(`[weibo-splash-clean] neutralized ${changes} splash field(s)`);
    $done({
      body: `${parsed.prefix}${JSON.stringify(parsed.payload)}${parsed.suffix}`,
    });
  } else {
    $done({ body: originalBody });
  }
} catch (error) {
  console.log(`[weibo-splash-clean] pass through: ${String(error)}`);
  $done({ body: originalBody });
}
