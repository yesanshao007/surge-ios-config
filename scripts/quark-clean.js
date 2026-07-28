/**
 * Quark open-cms response cleaner.
 *
 * Only removes keys beginning with "cms_" from the top-level result object.
 * Any unexpected response shape or JSON error is passed through unchanged.
 */

const originalBody = $response.body;

try {
  const payload = JSON.parse(originalBody);
  const result = payload && payload.result;

  if (result && typeof result === "object" && !Array.isArray(result)) {
    for (const key of Object.keys(result)) {
      if (key.startsWith("cms_")) {
        delete result[key];
      }
    }
  }

  $done({ body: JSON.stringify(payload) });
} catch (error) {
  console.log(`[quark-clean] pass through: ${String(error)}`);
  $done({ body: originalBody });
}
