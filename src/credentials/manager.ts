import { getLogger } from "../logging/logger.js";
import { CredentialNotFoundError } from "../errors/types.js";
import type { AccountConfig, ResolvedCredentials } from "../config/schema.js";
import { getPasswordFromEnv } from "./env.js";
import { getKeychainPassword } from "./keychain.js";

const log = getLogger("credentials");

export async function getCredentials(account: AccountConfig): Promise<ResolvedCredentials> {
  const { email, name } = account;

  // 1. OS keychain (most secure)
  const keychainPassword = await getKeychainPassword(email);
  if (keychainPassword) {
    log.debug({ email }, "credentials resolved from keychain");
    return { type: "password", value: keychainPassword };
  }

  // 2. Environment variable
  const envPassword = getPasswordFromEnv(email);
  if (envPassword) {
    log.debug({ email }, "credentials resolved from environment variable");
    return { type: "password", value: envPassword };
  }

  // 3. Plain-text config.json (deprecated — warn loudly)
  if (account.password) {
    log.warn(
      { email, name },
      "Using plain-text password from config.json. " +
        "Run 'npx imap-mcp setup' to migrate to secure storage.",
    );
    return { type: "password", value: account.password };
  }

  throw new CredentialNotFoundError(email);
}
