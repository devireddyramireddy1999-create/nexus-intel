export type AccessStatus = {
  authorized: boolean;
  required: boolean;
};

type AccessResponse = AccessStatus & {
  token: string | null;
};

const ACCESS_TOKEN_KEY = "nexus-intel-access-token";

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? "";
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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
    window.localStorage.setItem(ACCESS_TOKEN_KEY, result.token);
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
