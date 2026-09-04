/**
 * Surge iOS evidence push.
 *
 * Reads the local recent-request API, reduces it to domain/rule/result counts,
 * and uploads only that sanitized aggregate to an authenticated Tailnet sink.
 * No URL path, query, header, body, note, IP address, credential, or node name
 * is included in the payload.
 */

function parseArgument(value) {
  const result = {};
  String(value || "")
    .split(";")
    .forEach((entry) => {
      const index = entry.indexOf("=");
      if (index > 0) {
        result[entry.slice(0, index).trim()] = entry.slice(index + 1).trim();
      }
    });
  return result;
}

function validTailnetEndpoint(value) {
  const match = String(value || "").match(
    /^http:\/\/(100)\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{2,5})\/v1\/ingest$/
  );
  if (!match) return false;
  const second = Number(match[2]);
  const third = Number(match[3]);
  const fourth = Number(match[4]);
  const port = Number(match[5]);
  return (
    second >= 64 &&
    second <= 127 &&
    third <= 255 &&
    fourth <= 255 &&
    port >= 1024 &&
    port <= 65535
  );
}

function extractDomain(request) {
  let host = typeof request.remoteHost === "string" ? request.remoteHost : "";
  if (!host && typeof request.URL === "string") {
    const match = request.URL.match(
      /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?(\[[^\]]+\]|[^/:?#]+)/i
    );
    host = match ? match[1] : "";
  }
  host = host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host || host.length > 253 || host.includes(":")) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  if (!/^[a-z0-9_](?:[a-z0-9_.-]*[a-z0-9_])?$/.test(host)) return null;
  return host;
}

function safeToken(value, fallback) {
  const token = String(value || "").trim();
  return token && token.length <= 80 && /^[\w.+() -]+$/u.test(token)
    ? token
    : fallback;
}

function ruleLabel(rule) {
  const parts = String(rule || "").split(",", 3);
  const kind = String(parts[0] || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (!kind) return "UNKNOWN";
  if (kind === "RULE-SET") {
    const source = String(parts[1] || "").split(/[?#]/, 1)[0];
    const label = safeToken(source.split("/").pop(), "local");
    return `RULE-SET:${label}`;
  }
  if (kind === "GEOIP") {
    const country = String(parts[1] || "").toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? `GEOIP:${country}` : "GEOIP";
  }
  return kind;
}

function policyClass(value) {
  const name = String(value || "").toUpperCase();
  if (name === "DIRECT") return "direct";
  if (/^REJECT(?:-[A-Z0-9_-]+)?$/.test(name)) return "reject";
  return "proxy";
}

function resultClass(request) {
  if (request.rejected) return "rejected";
  if (request.failed) return "failed";
  if (request.completed) return "completed";
  return "active";
}

function hourBucket(value) {
  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().replace(/:\d{2}:\d{2}\.\d{3}Z$/, ":00:00Z");
}

function summarize(requests) {
  const counts = Object.create(null);
  let skipped = 0;
  requests.slice(0, 250).forEach((request) => {
    const domain = extractDomain(request);
    if (!domain) {
      skipped += 1;
      return;
    }
    const fields = [
      hourBucket(request.startDate),
      domain,
      ruleLabel(request.rule),
      policyClass(request.originalPolicyName),
      policyClass(request.policyName),
      resultClass(request),
    ];
    const key = fields.join("\u001f");
    counts[key] = (counts[key] || 0) + 1;
  });

  const rows = Object.keys(counts)
    .sort()
    .map((key) => {
      const fields = key.split("\u001f");
      return {
        hour: fields[0],
        domain: fields[1],
        rule: fields[2],
        original_policy_class: fields[3],
        effective_policy_class: fields[4],
        result: fields[5],
        count: counts[key],
      };
    });

  return {
    sample_size: Math.min(requests.length, 250),
    skipped_ip_or_invalid_host: skipped,
    rows,
  };
}

const options = parseArgument(typeof $argument === "undefined" ? "" : $argument);
if (
  !validTailnetEndpoint(options.endpoint) ||
  !/^[a-f0-9]{64}$/.test(options.token || "") ||
  !/^[a-f0-9]{16}$/.test(options.device || "")
) {
  $surge.logbook("iOS evidence push: invalid private argument");
  $done();
} else {
  $httpAPI("GET", "/v1/requests/recent", {}, (result) => {
    const requests = result && Array.isArray(result.requests) ? result.requests : [];
    const payload = {
      schema_version: 1,
      source: "surge-ios-push",
      captured_at: new Date().toISOString(),
      device_hash: options.device,
      requests: summarize(requests),
    };

    $httpClient.post(
      {
        url: options.endpoint,
        headers: {
          "Content-Type": "application/json",
          "X-Ingest-Key": options.token,
        },
        body: JSON.stringify(payload),
        policy: "Tailscale",
        timeout: 15,
      },
      (error, response) => {
        if (!error && response && Number(response.status) >= 200 && Number(response.status) < 300) {
          $surge.logbook(`iOS evidence push: success rows=${payload.requests.rows.length}`);
        } else {
          $surge.logbook("iOS evidence push: upload unavailable");
        }
        $done();
      }
    );
  });
}
