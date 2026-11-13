import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const worker = "https://rkc-public-materias-cache.redekalungacomunicacoes.workers.dev";
const cases = [
  { id: "materia-1Q0Z0z47Kxc5KV6hhO4cQkgbD-73xbuOe", type: "image/jpeg" },
  { id: "materia-1f8zr8fWpoZz30ipp0aJfaCggeO6WxDhT", type: "image/png" },
  { id: "materia-03437a4c-44e6-4185-84cd-2544e5d6f39c", type: "image/webp" },
];

for (const item of cases) {
  const url = \`\${worker}/media?id=\${encodeURIComponent(item.id)}\`;
  const first = await fetch(url, { headers: { Accept: "image/*" } });
  const firstBytes = Buffer.from(await first.arrayBuffer());
  const firstCacheStatus = first.headers.get("cf-cache-status")?.toUpperCase();
  assert.ok(["MISS", "EXPIRED", "REVALIDATED"].includes(firstCacheStatus), `first request should reach origin for ${item.id}: ${firstCacheStatus || "header missing"}`);
  assert.equal(first.status, 200, \`first request failed for \${item.id}: \${first.status}\`);
  assert.ok(first.headers.get("content-type")?.toLowerCase().includes(item.type), \`wrong MIME for \${item.id}\`);

  const second = await fetch(url, { headers: { Accept: "image/*" } });
  const secondBytes = Buffer.from(await second.arrayBuffer());
  const cacheStatus = second.headers.get("cf-cache-status")?.toUpperCase();
  assert.equal(second.status, 200, \`second request failed for \${item.id}: \${second.status}\`);
  assert.equal(cacheStatus, "HIT", \`second request was not a cache HIT for \${item.id}: \${cacheStatus || "header missing"}\`);
  assert.ok(second.headers.get("age") !== null, \`Age header missing for \${item.id}\`);
  assert.equal(createHash("sha256").update(firstBytes).digest("hex"), createHash("sha256").update(secondBytes).digest("hex"), \`body changed between requests for \${item.id}\`);
  console.log(JSON.stringify({
    id: item.id,
    mime: item.type,
    firstCacheStatus: first.headers.get("cf-cache-status"),
    secondCacheStatus: cacheStatus,
    age: second.headers.get("age"),
    bytes: secondBytes.length,
    secondRequestOriginExpected: "not invoked on HIT",
  }));
}

const negativeId = \`materia-rkc-private-control-\${Date.now()}\`;
const negative = await fetch(\`\${worker}/media?id=\${encodeURIComponent(negativeId)}\`);
const negativeBody = await negative.arrayBuffer();
assert.equal(negative.status, 404, "unknown/private control ID must not be delivered");
assert.equal(negative.headers.get("cache-control"), "no-store", "negative/private response must never be cached");
console.log(JSON.stringify({ negativeControl: true, status: negative.status, cacheControl: negative.headers.get("cache-control"), bytes: negativeBody.byteLength }));
