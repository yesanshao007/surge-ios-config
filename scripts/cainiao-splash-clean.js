/**
 * Cainiao startup-ad response cleaner.
 * Only removes result entries explicitly marked as splash ads.
 * Unexpected response shapes pass through unchanged.
 */

const splashEndpoint = /^https?:\/\/netflow-mtop\.cainiao\.com\/gw\/mtop\.cainiao\.guoguo\.nbnetflow\.ads\.show\.cn(?:\/|\?|$)/;

try {
  if (!splashEndpoint.test($request.url)) {
    $done();
  } else {
    const payload = JSON.parse($response.body);
    const result = payload && payload.data && payload.data.result;

    if (!Array.isArray(result)) {
      $done();
    } else {
      const retained = result.filter((entry) => {
        const mapper = entry && entry.materialContentMapper;
        const properties = mapper && mapper.adProperties;
        const category = properties && properties.splashAdCategory;
        return typeof category !== "string" || category.trim().length === 0;
      });

      if (retained.length === result.length) {
        $done();
      } else {
        payload.data.result = retained;
        $done({ body: JSON.stringify(payload) });
      }
    }
  }
} catch (_) {
  $done();
}
