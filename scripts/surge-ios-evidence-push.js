/**
 * Surge iOS evidence push.
 *
 * Reads the local recent-request API and always uploads a sanitized aggregate.
 * Failed/rejected requests and policy-class mismatches are additionally sent as
 * complete request records to the authenticated Tailnet-only temporary inbox.
 * The receiver limits retention and never writes request bodies to service logs.
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

function requestSignature(request) {
  const domain = extractDomain(request);
  if (!domain) return null;
  return {
    domain,
    rule: ruleLabel(request.rule),
    original: policyClass(request.originalPolicyName),
    effective: policyClass(request.policyName),
  };
}

function readBaselines() {
  try {
    const raw = $persistentStore.read("surge-ios-evidence-classification-baseline-v1");
    const parsed = JSON.parse(raw || "{}");
    const result = Object.create(null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return result;
    Object.keys(parsed).forEach((domain) => {
      const value = parsed[domain];
      if (
        /^[a-z0-9_](?:[a-z0-9_.-]*[a-z0-9_])?$/.test(domain) &&
        value && typeof value === "object" &&
        typeof value.rule === "string" &&
        ["direct", "reject", "proxy"].includes(value.original) &&
        ["direct", "reject", "proxy"].includes(value.effective)
      ) result[domain] = { domain, rule: value.rule, original: value.original, effective: value.effective };
    });
    return result;
  } catch (_) {
    return Object.create(null);
  }
}

function anomalyReasons(request, previous) {
  const reasons = [];
  if (request.rejected === true) reasons.push("rejected");
  if (request.failed === true) reasons.push("failed");
  const ruleKind = String(request.rule || "").split(",", 1)[0].trim().toUpperCase();
  if (ruleKind === "FINAL" || ruleKind === "UNKNOWN") reasons.push("fallback-rule");
  const original = policyClass(request.originalPolicyName);
  const effective = policyClass(request.policyName);
  if (original !== effective) reasons.push("policy-class-mismatch");
  const current = requestSignature(request);
  if (
    previous && current &&
    (previous.rule !== current.rule || previous.original !== current.original || previous.effective !== current.effective)
  ) reasons.push("classification-drift");
  return reasons;
}

function hash32(value, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function anomalyFingerprint(request) {
  // Hash in memory only; the URL and other source fields are never persisted as
  // deduplication state on the phone.
  const identity = JSON.stringify([
    request.id,
    request.startDate,
    request.remoteHost,
    request.URL,
    request.rule,
    request.originalPolicyName,
    request.policyName,
    request.failed === true,
    request.rejected === true,
  ]);
  return hash32(identity, 2166136261) + hash32(identity, 2246822519);
}

function utf8Length(value) {
  try {
    return unescape(encodeURIComponent(value)).length;
  } catch (_) {
    return value.length * 3;
  }
}

function readRecentFingerprints() {
  try {
    const raw = $persistentStore.read("surge-ios-evidence-anomaly-hashes-v1");
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => /^[a-f0-9]{16}$/.test(value)) : [];
  } catch (_) {
    return [];
  }
}

function rememberFingerprints(values, baselineUpdates) {
  const merged = Array.from(new Set(readRecentFingerprints().concat(values))).slice(-500);
  $persistentStore.write(JSON.stringify(merged), "surge-ios-evidence-anomaly-hashes-v1");
  const baselines = readBaselines();
  const updatedDomains = new Set(Object.keys(baselineUpdates));
  const keys = Object.keys(baselines).filter((domain) => !updatedDomains.has(domain))
    .concat(Object.keys(baselineUpdates)).slice(-500);
  const bounded = Object.create(null);
  keys.forEach((domain) => { bounded[domain] = baselineUpdates[domain] || baselines[domain]; });
  $persistentStore.write(JSON.stringify(bounded), "surge-ios-evidence-classification-baseline-v1");
}

function prepareAnomalies(requests, deviceHash) {
  const seen = new Set(readRecentFingerprints());
  const priorBaselines = readBaselines();
  const baselineUpdates = Object.create(null);
  const candidates = [];
  requests
    .filter((request) => request && typeof request === "object")
    .slice()
    .sort((left, right) => Number(right.startDate || 0) - Number(left.startDate || 0))
    .forEach((request) => {
      const signature = requestSignature(request);
      const reasons = anomalyReasons(request, signature ? priorBaselines[signature.domain] : null);
      if (reasons.length > 0) candidates.push({ request, reasons, signature });
      else if (signature && !Object.prototype.hasOwnProperty.call(baselineUpdates, signature.domain)) {
        baselineUpdates[signature.domain] = signature;
      }
    });
  const envelope = {
    schema_version: 1,
    source: "surge-ios-anomaly-push",
    captured_at: new Date().toISOString(),
    device_hash: deviceHash,
    records: [],
  };
  const fingerprints = [];
  const pendingBaselines = Object.create(null);
  let duplicates = 0;
  let omitted = 0;

  candidates.forEach(({ request, reasons, signature }) => {
    const fingerprint = anomalyFingerprint(request);
    if (seen.has(fingerprint)) {
      duplicates += 1;
      if (signature && !Object.prototype.hasOwnProperty.call(pendingBaselines, signature.domain)) {
        pendingBaselines[signature.domain] = signature;
      }
      return;
    }
    if (envelope.records.length >= 50) {
      omitted += 1;
      return;
    }
    const wrapped = { reasons, record: request };
    const next = envelope.records.concat([wrapped]);
    const trial = Object.assign({}, envelope, { records: next });
    if (utf8Length(JSON.stringify(trial)) > 256 * 1024) {
      omitted += 1;
      return;
    }
    envelope.records.push(wrapped);
    fingerprints.push(fingerprint);
    seen.add(fingerprint);
    if (signature && !Object.prototype.hasOwnProperty.call(pendingBaselines, signature.domain)) {
      pendingBaselines[signature.domain] = signature;
    }
  });

  Object.keys(pendingBaselines).forEach((domain) => { baselineUpdates[domain] = pendingBaselines[domain]; });
  return { envelope, fingerprints, duplicates, omitted, baselineUpdates, candidateCount: candidates.length };
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
  console.log("iOS evidence push: configuration invalid");
  $surge.logbook("iOS evidence push: invalid private argument");
  $done();
} else {
  console.log("iOS evidence push: configuration accepted");
  $httpAPI("GET", "/v1/requests/recent", {}, (result) => {
    if (!result || !Array.isArray(result.requests)) {
      console.log("iOS evidence push: recent requests unavailable");
      $surge.logbook("iOS evidence push: recent requests unavailable");
      $done();
      return;
    }

    const requests = result.requests;
    console.log(`iOS evidence push: recent requests=${requests.length}`);
    const payload = {
      schema_version: 1,
      source: "surge-ios-push",
      captured_at: new Date().toISOString(),
      device_hash: options.device,
      requests: summarize(requests),
    };
    const anomalies = prepareAnomalies(requests, options.device);

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
          console.log(`iOS evidence push: upload succeeded status=${Number(response.status)}`);
          $surge.logbook(`iOS evidence push: success rows=${payload.requests.rows.length}`);
        } else {
          console.log(
            `iOS evidence push: upload failed status=${response ? Number(response.status) : 0}`
          );
          $surge.logbook("iOS evidence push: upload unavailable");
          $done();
          return;
        }

        if (anomalies.envelope.records.length === 0) {
          rememberFingerprints([], anomalies.baselineUpdates);
          console.log(
            `iOS evidence push: no new anomaly records; duplicates=${anomalies.duplicates}`
          );
          $done();
          return;
        }

        const anomalyEndpoint = options.endpoint.replace(/\/v1\/ingest$/, "/v1/anomalies/ingest");
        $httpClient.post(
          {
            url: anomalyEndpoint,
            headers: {
              "Content-Type": "application/json",
              "X-Ingest-Key": options.token,
            },
            body: JSON.stringify(anomalies.envelope),
            policy: "Tailscale",
            timeout: 15,
          },
          (anomalyError, anomalyResponse) => {
            if (
              !anomalyError && anomalyResponse &&
              Number(anomalyResponse.status) >= 200 && Number(anomalyResponse.status) < 300
            ) {
              rememberFingerprints(anomalies.fingerprints, anomalies.baselineUpdates);
              console.log(
                `iOS evidence push: anomaly upload succeeded records=${anomalies.envelope.records.length} omitted=${anomalies.omitted}`
              );
              $surge.logbook(
                `iOS evidence push: anomaly records uploaded=${anomalies.envelope.records.length}`
              );
            } else {
              console.log(
                `iOS evidence push: anomaly upload unavailable status=${anomalyResponse ? Number(anomalyResponse.status) : 0}`
              );
              $surge.logbook("iOS evidence push: anomaly upload unavailable");
            }
            $done();
          }
        );
      }
    );
  });
}
