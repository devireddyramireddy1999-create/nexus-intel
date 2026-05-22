export type AccessStatus = {
  authorized: boolean;
  required: boolean;
};

type AccessResponse = AccessStatus & {
  expiresAt?: string;
  token: string | null;
  unlockedAt?: string;
};

export type AccessRecord = {
  expiresAt: string;
  token: string;
  unlockedAt: string;
};

const ACCESS_TOKEN_KEY = "nexus-intel-access-token";
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;

export const ACCESS_LOCK_EVENT = "nexus-intel-lock";

export function getAccessToken() {
  return getAccessRecord()?.token ?? "";
}

export function getAccessRecord(): AccessRecord | null {
  if (typeof window === "undefined") return null;

  const rawRecord = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!rawRecord) return null;

  try {
    const parsed = JSON.parse(rawRecord) as unknown;

    if (!isAccessRecord(parsed) || isExpired(parsed)) {
      clearStoredAccess({ notify: isAccessRecord(parsed) });
      return null;
    }

    return parsed;
  } catch {
    clearStoredAccess({ notify: false });
    return null;
  }
}

export function clearAccessToken() {
  clearStoredAccess({ notify: true });
}

export async function getAccessStatus(): Promise<AccessStatus> {
  const response = await fetch("/api/access/status", {
    headers: buildAccessHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Access status failed: ${response.status}`);
  }

  return response.json() as Promise<AccessStatus>;
}

export async function unlockWithAccessCode(code: string): Promise<AccessStatus> {
  const response = await fetch("/api/access", {
    body: JSON.stringify({ code }),
    headers: {
      "Content-Type": "application/json",
      ...buildAccessHeaders(),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Invalid access code.");
  }

  const result = (await response.json()) as AccessResponse;

  if (result.token) {
    storeAccessToken(result.token, result.unlockedAt, result.expiresAt);
  }

  return {
    authorized: result.authorized,
    required: result.required,
  };
}

export function buildAccessHeaders(): Record<string, string> {
  const token = getAccessToken();

  return token ? { "X-NEXUS-ACCESS": token } : {};
}

function storeAccessToken(token: string, unlockedAt?: string, expiresAt?: string) {
  if (typeof window === "undefined") return;

  const fallbackUnlockedAt = Date.now();
  const unlockedAtMs = parseTimestamp(unlockedAt) ?? fallbackUnlockedAt;
  const expiresAtMs = parseTimestamp(expiresAt) ?? unlockedAtMs + ACCESS_TTL_MS;

  const record: AccessRecord = {
    expiresAt: new Date(expiresAtMs).toISOString(),
    token,
    unlockedAt: new Date(unlockedAtMs).toISOString(),
  };

  window.localStorage.setItem(ACCESS_TOKEN_KEY, JSON.stringify(record));
}

function clearStoredAccess({ notify }: { notify: boolean }) {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);

  if (notify) {
    window.dispatchEvent(new Event(ACCESS_LOCK_EVENT));
  }
}

function isAccessRecord(value: unknown): value is AccessRecord {
  if (!value || typeof value !== "object") return false;

  const record = value as Partial<AccessRecord>;
  return typeof record.token === "string" && typeof record.unlockedAt === "string" && typeof record.expiresAt === "string";
}

function isExpired(record: AccessRecord) {
  const expiresAt = parseTimestamp(record.expiresAt);
  return !expiresAt || expiresAt <= Date.now();
}

function parseTimestamp(value?: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
