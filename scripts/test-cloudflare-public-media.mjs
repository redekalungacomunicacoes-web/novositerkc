import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const worker = process.env.RKC_MEDIA_WORKER_URL;
if (!worker) throw new Error("RKC_MEDIA_WORKER_URL must point to an isolated staging Worker; production URLs are not accepted by default.");
const originProbeUrl = new URL("/functions/v1/drive-media", "https://yycfqeymdsjyulexwrlb.supabase.co");
originProbeUrl.searchParams.set("id", "materia-1Q0Z0z47Kxc5KV6hhO4cQkgbD-73xbuOe");
const originProbe = await fetch(originProbeUrl, { method: "HEAD", headers: { "Cache-Control": "no-cache" } });
const originProbeBody = await originProbe.text();
const originGetProbe = await fetch(originProbeUrl, {
  method: "GET",
  headers: { Range: "bytes=0-0", "Cache-Control": "no-cache" },
});
const originGetProbeBody = await originGetProbe.text();
console.log(JSON.stringify({
  originGetStatus: originGetProbe.status,
  originGetErrorCode: originGetProbe.headers.get("sb-error-code"),
  originGetBody: originGetProbeBody.slice(0, 500),
}));
console.log(JSON.stringify({
  originHeadStatus: originProbe.status,
  originHeadCacheControl: originProbe.headers.get("cache-control"),
  originHeadContentType: originProbe.headers.get("content-type"),
  originHeadErrorCode: originProbe.headers.get("sb-error-code"),
  originHeadBody: originProbeBody.slice(0, 500),
}));
const cases = [
  { id: "materia-1Q0Z0z47Kxc5KV6hhO4cQkgbD-73xbuOe", type: "image/jpeg" },
  { id: "materia-1f8zr8fWpoZz30ipp0aJfaCggeO6WxDhT", type: "image/png" },
  { id: "materia-03437a4c-44e6-4185-84cd-2544e5d6f39c", type: "image/webp" },
];

for (const item of cases) {
  const url = `${worker.replace(/\/$/, "")}/media?id=${encodeURIComponent(item.id)}`;
  const first = await fetch(url, { headers: { Accept: "image/*" } });
  const firstBytes = Buffer.from(await first.arrayBuffer());
  assert.equal(first.status, 200, `first request failed for ${item.id}: ${first.status}: ${firstBytes.toString("utf8").slice(0,240)}`);
  assert.equal(first.headers.get("x-rkc-media-cache"), "MISS");
  assert.ok(first.headers.get("content-type")?.toLowerCase().includes(item.type), `wrong MIME for ${item.id}`);

  const second = await fetch(url, { headers: { Accept: "image/*" } });
  const secondBytes = Buffer.from(await second.arrayBuffer());
  assert.equal(second.status, 200, `second request failed for ${item.id}: ${second.status}`);
  assert.equal(second.headers.get("x-rkc-media-cache"), "HIT", `second request was not an app-cache HIT for ${item.id}`);
  assert.equal(createHash("sha256").update(firstBytes).digest("hex"), createHash("sha256").update(secondBytes).digest("hex"));
  let afterPurge = "not-tested";
  if (process.env.RKC_CACHE_PURGE_SECRET) {
    const purge = await fetch(`${worker.replace(/\/$/, "")}/__cache/purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RKC_CACHE_PURGE_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: [`media-${item.id}`] }),
    });
    assert.equal(purge.status, 200, `staging purge failed for ${item.id}: ${purge.status}`);
    const purged = await fetch(url);
    assert.equal(purged.status, 200);
    assert.equal(purged.headers.get("x-rkc-media-cache"), "MISS", "purged item must miss cache");
    afterPurge = "MISS";
  }
  console.log(JSON.stringify({ id: item.id, mime: item.type, first: "MISS", second: "HIT", afterPurge, bytes: secondBytes.length }));
}

const negativeId = `materia-rkc-private-control-${Date.now()}`;
const negative = await fetch(`${worker.replace(/\/$/, "")}/media?id=${encodeURIComponent(negativeId)}`);
assert.equal(negative.status, 404);
assert.equal(negative.headers.get("cache-control"), "no-store");
console.log(JSON.stringify({ negativeControl: true, status: negative.status }));
