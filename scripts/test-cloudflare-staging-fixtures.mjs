import assert from "node:assert/strict";

const workerUrl = (process.env.RKC_MEDIA_WORKER_URL || "").replace(/\/$/, "");
const purgeSecret = process.env.RKC_STAGING_PURGE_SECRET || "";
assert.ok(workerUrl, "RKC_MEDIA_WORKER_URL is required");
assert.ok(purgeSecret, "RKC_STAGING_PURGE_SECRET is required");

const results = [];
let bytesAvoided = 0;
function check(name, condition, details = {}) {
  results.push({ name, passed: Boolean(condition), ...details });
  assert.ok(condition, name);
}
async function stats() {
  const response = await fetch(workerUrl + "/__test/stats");
  assert.equal(response.status, 200, "staging origin stats endpoint must be available");
  return response.json();
}
async function body(response) {
  return new Uint8Array(await response.arrayBuffer());
}
async function media(id, init = {}) {
  return fetch(workerUrl + "/media?id=" + encodeURIComponent(id), init);
}
async function purge(tags, token = purgeSecret) {
  return fetch(workerUrl + "/__cache/purge", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
}

try {
  const cacheReset = await purge(["rkc-public-media"]);
  assert.equal(cacheReset.status, 200, "isolated staging cache reset");
  const reset = await fetch(workerUrl + "/__test/reset", { method: "POST" });
  assert.equal(reset.status, 200, "isolated fixture origin reset");
  await reset.json();

  const listing = await fetch(workerUrl + "/materias");
  const rows = await listing.json();
  check("public article listing rewrites cover, thumbnail and banner URLs", listing.status === 200 &&
    Array.isArray(rows) && rows.length === 1 &&
    rows[0].capa_url.includes(workerUrl + "/media?id=materia-fixture-jpeg") &&
    rows[0].capa_thumb_url.includes(workerUrl + "/media?id=materia-fixture-png") &&
    rows[0].banner_url.includes(workerUrl + "/media?id=materia-fixture-webp"), { status: listing.status, rows: rows.length });

  for (const [id, mime] of [
    ["materia-fixture-jpeg", "image/jpeg"],
    ["materia-fixture-png", "image/png"],
    ["materia-fixture-webp", "image/webp"],
  ]) {
    const before = await stats();
    const first = await media(id);
    const firstStatus = first.headers.get("x-rkc-media-cache");
    const firstType = first.headers.get("content-type");
    const firstBytes = await body(first);
    const afterMiss = await stats();

    const second = await media(id);
    const secondStatus = second.headers.get("x-rkc-media-cache");
    const secondBytes = await body(second);
    const afterHit = await stats();

    check("MISS then HIT for " + mime, first.status === 200 && second.status === 200 &&
      firstStatus === "MISS" && secondStatus === "HIT" && firstType === mime &&
      firstBytes.length > 0 && firstBytes.length === secondBytes.length &&
      firstBytes.every((value, index) => value === secondBytes[index]),
      { firstStatus, secondStatus, mime, bytes: firstBytes.length });
    check("repeated image read avoids origin bytes for " + mime,
      afterMiss.originGets === before.originGets + 1 &&
      afterHit.originGets === afterMiss.originGets &&
      afterHit.originBytes === afterMiss.originBytes,
      { originGetsAfterMiss: afterMiss.originGets, originGetsAfterHit: afterHit.originGets });
    bytesAvoided += firstBytes.length;
  }

  const beforeRange = await stats();
  const range = await media("materia-fixture-jpeg", { headers: { Range: "bytes=0-1" } });
  const rangeBytes = await body(range);
  const rangeStats = await stats();
  const contentRange = range.headers.get("content-range") || "";
  check("Range returns a correct 206 partial response", range.status === 206 &&
    /^bytes 0-1\/\d+$/.test(contentRange) &&
    range.headers.get("content-length") === "2" && rangeBytes.length === 2,
    { status: range.status, contentRange, bytes: rangeBytes.length });
  check("Range does not trigger another origin transfer",
    rangeStats.originGets === beforeRange.originGets &&
    rangeStats.originBytes === beforeRange.originBytes,
    { originGets: rangeStats.originGets });

  const beforePrivate = await stats();
  const privateResponse = await media("materia-private-file");
  const afterPrivate = await stats();
  check("private media is denied before cache/origin delivery",
    privateResponse.status === 404 &&
    afterPrivate.originGets === beforePrivate.originGets &&
    afterPrivate.originBytes === beforePrivate.originBytes,
    { status: privateResponse.status });

  const revokedId = "materia-fixture-revoked";
  const firstRevoked = await media(revokedId);
  await body(firstRevoked);
  const beforeRevoke = await stats();
  const revoke = await fetch(workerUrl + "/__test/revoke?id=" + encodeURIComponent(revokedId), { method: "POST" });
  assert.equal(revoke.status, 200, "fixture revoke action");
  const rejectedPurge = await purge(["media-" + revokedId], "wrong-staging-secret");
  const afterRevocation = await media(revokedId);
  const afterRevoke = await stats();
  check("revocation blocks cached bytes even when purge is rejected",
    firstRevoked.status === 200 && rejectedPurge.status === 401 &&
    afterRevocation.status === 404 &&
    afterRevoke.originGets === beforeRevoke.originGets &&
    afterRevoke.originBytes === beforeRevoke.originBytes,
    { firstStatus: firstRevoked.status, rejectedPurgeStatus: rejectedPurge.status,
      afterRevocationStatus: afterRevocation.status, originGetsBefore: beforeRevoke.originGets,
      originGetsAfter: afterRevoke.originGets });

  const purgeId = "materia-fixture-purge";
  const beforePurge = await stats();
  const firstPurge = await media(purgeId);
  await body(firstPurge);
  const purgeResponse = await purge(["media-" + purgeId]);
  const afterPurge = await media(purgeId);
  await body(afterPurge);
  const afterPurgeStats = await stats();
  check("authorized purge invalidates cached media",
    purgeResponse.status === 200 && afterPurge.status === 200 &&
    afterPurge.headers.get("x-rkc-media-cache") === "MISS" &&
    afterPurgeStats.originGets === beforePurge.originGets + 2,
    { purgeStatus: purgeResponse.status, nextCacheStatus: afterPurge.headers.get("x-rkc-media-cache") });

  const concurrentId = "materia-fixture-concurrent";
  const concurrent = await Promise.all(Array.from({ length: 6 }, () => media(concurrentId)));
  const concurrentBodies = await Promise.all(concurrent.map(body));
  check("six simultaneous requests return complete image bodies",
    concurrent.every((response) => response.status === 200) &&
    concurrentBodies.every((bytes) => bytes.length > 0),
    { requests: concurrent.length, bodySizes: concurrentBodies.map((bytes) => bytes.length) });
  const finalStats = await stats();

  console.log(JSON.stringify({
    ok: true,
    tests: results,
    metrics: {
      syntheticOriginGets: finalStats.originGets,
      syntheticOriginBytes: finalStats.originBytes,
      bytesAvoidedByRepeatedImageReads: bytesAvoided,
      authorizationChecks: finalStats.authCalls,
    },
    note: "All HTTP tests use synthetic fixtures through an isolated staging Worker; no production database, account records or original files were accessed.",
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, tests: results, error: String(error) }, null, 2));
  process.exitCode = 1;
}
