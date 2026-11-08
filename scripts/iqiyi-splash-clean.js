/**
 * Remove the historical iQIYI splash adSlots from mixer responses.
 * Leave unknown responses unchanged.
 */

const mixerEndpoint = /^https?:\/\/(?:t7z|kjp)\.cupid\.iqiyi\.com\/mixer\?/;

try {
  if (!mixerEndpoint.test($request.url)) {
    $done();
  } else {
    const payload = JSON.parse($response.body);

    if (
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !Object.prototype.hasOwnProperty.call(payload, "adSlots")
    ) {
      $done();
    } else {
      delete payload.adSlots;
      $done({ body: JSON.stringify(payload) });
    }
  }
} catch (_) {
  $done();
}
