const RECOVERABLE_AUTH_ERROR_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "refresh_token_expired",
  "session_not_found",
]);

export function isRecoverableSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return (
    RECOVERABLE_AUTH_ERROR_CODES.has(code) ||
    message.includes("refresh token") ||
    message.includes("invalid refresh token") ||
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("jwt expired") ||
    message.includes("session not found")
  );
}
