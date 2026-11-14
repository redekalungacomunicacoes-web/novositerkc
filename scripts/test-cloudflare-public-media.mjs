import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const worker = process.env.RKC_MEDIA_WORKER_URL;
if (!worker) throw new Error("RKC_MEDIA_WORKER_URL must point to an isolated staging Worker; production URLs are not accepted by default.");
const cases = [
  { id: "materia-1Q0Z0z47Kxc5KV6hhO4cQkgbD-73xbuOe", type: "image/jpeg" },
  { id: "materia-1f8zr8fWpoZz30ipp0aJfaCggeO6WxDhT", type: "image/png" },
  { id: "materia-03437a4c-44e6-4185-84cd-2544e5d6f39c", type: "image/webp" },
];

for (const item of cases) {
  const url = `${worker.replace(/\/$/, "")}/media?id=${encodeURIComponent(item.id)}`;
  const first = await fetch(url, { headers: { Accept: "image/*" } });
  const firstBytes = Buffer.from(await first.arrayBuffer());
  assert.equal(first.status, 200, `first request failed for ${item.id}: ${first.status}`);
  assert.equal(first.headers.get("x-rkc-media-cache"), "MISS");
  assert.ok(first.headers.get("content-type")?.toLowerCase().includes(item.type), `wrong MIME for ${item.id}`);

  const second = await fetch(url, { headers: { Accept: "image/*" } });
  const secondBytes = Buffer.from(await second.arrayBuffer());
  assert.equal(second.status, 200, `second request failed for ${item.id}: ${second.status}`);
  assert.equal(second.headers.get("x-rkc-media-cache"), "HIT", `second request was not an app-cache HIT for ${item.id}`);
  assert.equal(createHash("sha256").update(firstBytes).digest("hex"), createHash("sha256").update(secondBytes).digest("hex"));
  console.log(JSON.stringify({ id: item.id, mime: item.type, first: "MISS", second: "HIT", bytes: secondBytes.length }));
}

const negativeId = `materia-rkc-private-control-${Date.now()}`;
const negative = await fetch(`${worker.replace(/\/$/, "")}/media?id=${encodeURIComponent(negativeId)}`);
assert.equal(negative.status, 404);
assert.equal(negative.headers.get("cache-control"), "no-store");
console.log(JSON.stringify({ negativeControl: true, status: negative.status }));
