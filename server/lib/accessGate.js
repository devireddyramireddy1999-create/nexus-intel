import crypto from "node:crypto";

const ACCESS_HEADER = "x-nexus-access";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function getAccessStatus(request) {
  const required = isAccessGateEnabled();

  return {
    authorized: !required || validateAccessToken(getAccessTokenFromRequest(request)),
    required,
  };
}

export function issueAccessToken(code) {
  const accessCode = getAccessCode();

  if (!accessCode) {
    return null;
  }

  if (code !== accessCode) {
    throw new Error("Invalid access code.");
  }

  const payload = encodeBase64Url(
    JSON.stringify({
      exp: Date.now() + TOKEN_TTL_MS,
      iat: Date.now(),
    }),
  );
  const signature = sign(payload);

  return `${payload}.${signature}`;
}

export function requireAppAccess(request, response, next) {
  const status = getAccessStatus(request);

  if (status.authorized) {
    next();
    return;
  }

  response.status(401).json({
    access: status,
    error: {
      message: "App access required.",
    },
  });
}

function isAccessGateEnabled() {
  return Boolean(getAccessCode());
}

function validateAccessToken(token) {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));
    return Number.isFinite(parsed.exp) && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function getAccessTokenFromRequest(request) {
  const headerToken = request.get(ACCESS_HEADER);
  if (headerToken) return headerToken;

  const authorization = request.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

function getAccessCode() {
  return process.env.APP_ACCESS_CODE?.trim() ?? "";
}

function sign(payload) {
  return crypto.createHmac("sha256", getAccessCode()).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}
