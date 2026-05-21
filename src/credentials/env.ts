// Reads credentials from environment variables.
// Format: IMAP_PASSWORD_<EMAIL> where email is uppercased,
// '@' replaced by '_AT_', and '.' replaced by '_DOT_'.
// Example: user@gmail.com → IMAP_PASSWORD_USER_AT_GMAIL_DOT_COM

export function sanitizeEmailForEnv(email: string): string {
  return email
    .toUpperCase()
    .replace(/@/g, "_AT_")
    .replace(/\./g, "_DOT_")
    .replace(/[^A-Z0-9_]/g, "_");
}

export function getPasswordFromEnv(email: string): string | undefined {
  const key = `IMAP_PASSWORD_${sanitizeEmailForEnv(email)}`;
  return process.env[key];
}
