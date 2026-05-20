const cache = new Map();

export async function withCache(key, ttlMs, producer) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && now - cached.createdAt < ttlMs) {
    return {
      data: cached.data,
      meta: buildMeta({ cached: true, createdAt: cached.createdAt, ttlMs }),
    };
  }

  const data = await producer();
  cache.set(key, { createdAt: now, data });

  return {
    data,
    meta: buildMeta({ cached: false, createdAt: now, ttlMs }),
  };
}

function buildMeta({ cached, createdAt, ttlMs }) {
  return {
    cached,
    cachedAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + ttlMs).toISOString(),
    fallback: true,
    source: "mock",
    ttlMs,
  };
}
