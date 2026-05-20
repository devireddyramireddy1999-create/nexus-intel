const cache = new Map();

export async function withCache(key, ttlMs, producer) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.createdAt < ttlMs) {
    return {
      data: cached.data,
      meta: buildMeta({ cached: true, createdAt: cached.createdAt, ttlMs, ...cached.meta }),
    };
  }

  const produced = await producer();
  const data = isEnvelope(produced) ? produced.data : produced;
  const meta = isEnvelope(produced) ? produced.meta : {};
  cache.set(key, { createdAt: now, data, meta });

  return {
    data,
    meta: buildMeta({ cached: false, createdAt: now, ttlMs, ...meta }),
  };
}

function buildMeta({ cached, createdAt, ttlMs, fallback = true, source = "mock", error }) {
  return {
    cached,
    cachedAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + ttlMs).toISOString(),
    fallback,
    source,
    ttlMs,
    ...(error ? { error } : {}),
  };
}

function isEnvelope(value) {
  return Boolean(value && typeof value === "object" && "data" in value && "meta" in value);
}
