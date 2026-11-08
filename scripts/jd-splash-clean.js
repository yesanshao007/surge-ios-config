/**
 * Disable marked startup images in JD's historical start response.
 * Preserve other startup data, including features used after launch.
 */

const startEndpoint = /^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=start(?:&|$)/;

try {
  if (!startEndpoint.test($request.url)) {
    $done();
  } else {
    const payload = JSON.parse($response.body);
    const imageGroups = payload && payload.images;
    let changed = false;

    if (Array.isArray(imageGroups)) {
      for (const group of imageGroups) {
        if (!Array.isArray(group)) continue;

        for (const image of group) {
          if (
            image &&
            typeof image === "object" &&
            Object.prototype.hasOwnProperty.call(image, "showTimes") &&
            Number(image.showTimes) > 0
          ) {
            image.showTimes = 0;
            image.onlineTime = "2099-01-01 00:00:00";
            image.referralsTime = "2099-01-02 00:00:00";
            image.time = 0;
            changed = true;
          }
        }
      }
    }

    $done(changed ? { body: JSON.stringify(payload) } : undefined);
  }
} catch (_) {
  $done();
}
