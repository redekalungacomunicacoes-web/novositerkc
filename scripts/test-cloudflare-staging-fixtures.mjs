import assert from "node:assert/strict";

const workerUrl = (process.env.RKC_MEDIA_WORKER_URL || "").replace(/\/$/, "");
const testRunId = process.env.GITHUB_RUN_ID || String(Date.now());
assert.ok(workerUrl, "RKC_MEDIA_WORKER_URL is required");

const results = [];
let bytesAvoided = 0;
function check(name, condition, details = {}) {
  results.push({ name, passed: Boolean(condition), ...details });
  assert.ok(condition, name);
}
async function body(response) {
  return new Uint8Array(await response.arrayBuffer());
}
async function media(id, init = {}) {
  return fetch(workerUrl + "/media?id=" + encodeURIComponent(id) + "&testRun=" + encodeURIComponent(testRunId), init);
}
function fixtureId(id) { return id + "-" + testRunId; }
async function purge(tags, token = "invalid-staging-token") {
  return fetch(workerUrl + "/__cache/purge", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  });
}

try {
  const listing = await fetch(workerUrl + "/materias");
  const rows = await listing.json();
  check("public article listing rewrites cover, thumbnail and banner URLs", listing.status === 200 &&
    Array.isArray(rows) && rows.length === 1 &&
    rows[0].capa_url.includes(workerUrl + "/media?id=materia-fixture-jpeg") &&
    rows[0].capa_thumb_url.includes(workerUrl + "/media?id=materia-fixture-png") &&
    rows[0].banner_url.includes(workerUrl + "/media?id=materia-fixture-webp"), { status: listing.status, rows: rows.length });

  for (const [id, mime] of [
    [fixtureId("materia-fixture-jpeg"), "image/jpeg"],
    [fixtureId("materia-fixture-png"), "image/png"],
    [fixtureId("materia-fixture-webp"), "image/webp"],
  ]) {
    const first = await media(id);
    const firstStatus = first.headers.get("x-rkc-media-cache");
    const firstType = first.headers.get("content-type");
    const firstBytes = await body(first);

    const second = await media(id);
    const secondStatus = second.headers.get("x-rkc-media-cache");
    const secondBytes = await body(second);

    check("MISS then HIT for " + mime, first.status === 200 && second.status === 200 &&
      firstStatus === "MISS" && secondStatus === "HIT" && firstType === mime &&
      firstBytes.length > 0 && firstBytes.length === secondBytes.length &&
      firstBytes.every((value, index) => value === secondBytes[index]),
      { firstStatus, secondStatus, mime, bytes: firstBytes.length });
    const missTransferBytes = Number(first.headers.get("x-rkc-origin-transfer-bytes") || "0");
    const hitTransferBytes = Number(second.headers.get("x-rkc-origin-transfer-bytes") || "0");
    check("origin transfer byte instrumentation records MISS and zero-byte HIT for " + mime,
      missTransferBytes === firstBytes.length && hitTransferBytes === 0,
      { missTransferBytes, hitTransferBytes, bodyBytes: firstBytes.length });
    bytesAvoided += hitTransferBytes === 0 ? secondBytes.length : 0;
  }

  const range = await media(fixtureId("materia-fixture-jpeg"), { headers: { Range: "bytes=0-1" } });
  const rangeBytes = await body(range);
  const contentRange = range.headers.get("content-range") || "";
  check("Range returns a correct 206 partial response", range.status === 206 &&
    /^bytes 0-1\/\d+$/.test(contentRange) &&
    range.headers.get("content-length") === "2" && rangeBytes.length === 2,
    { status: range.status, contentRange, bytes: rangeBytes.length });
  check("Range served from cached image without origin transfer",
    Number(range.headers.get("x-rkc-origin-transfer-bytes") || "0") === 0,
    { originTransferBytes: range.headers.get("x-rkc-origin-transfer-bytes") });

  const privateResponse = await media(fixtureId("materia-private-file"));
  check("private media is denied before cache/origin delivery",
    privateResponse.status === 404,
    { status: privateResponse.status });

  const revokedId = fixtureId("materia-fixture-revoked");
  const firstRevoked = await media(revokedId);
  await body(firstRevoked);
  const revoke = await fetch(workerUrl + "/__test/revoke?id=" + encodeURIComponent(revokedId), { method: "POST" });
  assert.equal(revoke.status, 200, "fixture revoke action");
  const rejectedPurge = await purge(["media-" + revokedId], "wrong-staging-secret");
  const afterRevocation = await media(revokedId);
  check("revocation blocks cached bytes even when purge is rejected",
    firstRevoked.status === 200 && rejectedPurge.status === 401 &&
    afterRevocation.status === 404,
    { firstStatus: firstRevoked.status, rejectedPurgeStatus: rejectedPurge.status,
      afterRevocationStatus: afterRevocation.status });

  const rejectedPurgeOnly = await purge(["media-" + fixtureId("materia-fixture-purge")]);
  check("purge endpoint rejects unauthenticated staging requests", rejectedPurgeOnly.status === 401,
    { status: rejectedPurgeOnly.status });

  const purgeId = fixtureId("materia-fixture-purge");
  const purgeMiss = await media(purgeId);
  const purgeMissBytes = await body(purgeMiss);
  const purgeHit = await media(purgeId);
  const purgeHitBytes = await body(purgeHit);
  const validPurge = await fetch(workerUrl + "/__test/purge-valid?testRun=" + encodeURIComponent(testRunId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purgeEverything: true }),
  });
  const afterValidPurge = await media(purgeId);
  const afterValidPurgeBytes = await body(afterValidPurge);
  check("authorized purge invalidates cached media and next request is MISS",
    purgeMiss.status === 200 && purgeMiss.headers.get("x-rkc-media-cache") === "MISS" &&
    purgeHit.status === 200 && purgeHit.headers.get("x-rkc-media-cache") === "HIT" &&
    validPurge.status === 200 && afterValidPurge.status === 200 &&
    afterValidPurge.headers.get("x-rkc-media-cache") === "MISS" &&
    purgeMissBytes.length === purgeHitBytes.length && afterValidPurgeBytes.length === purgeMissBytes.length,
    { first: purgeMiss.headers.get("x-rkc-media-cache"), second: purgeHit.headers.get("x-rkc-media-cache"),
      purgeStatus: validPurge.status, afterPurge: afterValidPurge.headers.get("x-rkc-media-cache"),
      originBytesAfterPurge: afterValidPurge.headers.get("x-rkc-origin-transfer-bytes") });

  const concurrentId = fixtureId("materia-fixture-concurrent");
  const concurrent = await Promise.all(Array.from({ length: 6 }, () => media(concurrentId)));
  const concurrentBodies = await Promise.all(concurrent.map(body));
  check("six simultaneous requests return complete image bodies",
    concurrent.every((response) => response.status === 200) &&
    concurrentBodies.every((bytes) => bytes.length > 0),
    { requests: concurrent.length, bodySizes: concurrentBodies.map((bytes) => bytes.length) });

  console.log(JSON.stringify({
    ok: true,
    tests: results,
    metrics: {
      bytesAvoidedByCacheHits: bytesAvoided,
    },
    note: "All HTTP tests use synthetic fixtures through an isolated staging Worker; no production database, account records or original files were accessed.",
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, tests: results, error: String(error) }, null, 2));
  process.exitCode = 1;
}
