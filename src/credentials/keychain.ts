import { getLogger } from "../logging/logger.js";

const SERVICE_NAME = "imap-mcp";
const log = getLogger("keychain");

// keytar is an optional native dependency — gracefully degrade if unavailable
type Keytar = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

let keytar: Keytar | null = null;
let loadAttempted = false;

function loadKeytar(): Keytar | null {
  if (loadAttempted) return keytar;
  loadAttempted = true;
  try {
    // Dynamic require so pkg/bundlers don't hard-fail on missing native module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    keytar = require("keytar") as Keytar;
    log.debug("keytar loaded successfully");
  } catch {
    log.debug(
      "keytar not available — OS keychain storage disabled. " +
        "Install keytar or use IMAP_PASSWORD_* env vars instead.",
    );
  }
  return keytar;
}

export async function getKeychainPassword(email: string): Promise<string | undefined> {
  const kt = loadKeytar();
  if (!kt) return undefined;
  const value = await kt.getPassword(SERVICE_NAME, email);
  return value ?? undefined;
}

export async function setKeychainPassword(email: string, password: string): Promise<boolean> {
  const kt = loadKeytar();
  if (!kt) return false;
  await kt.setPassword(SERVICE_NAME, email, password);
  return true;
}

export async function deleteKeychainPassword(email: string): Promise<boolean> {
  const kt = loadKeytar();
  if (!kt) return false;
  return kt.deletePassword(SERVICE_NAME, email);
}

export function isKeychainAvailable(): boolean {
  return loadKeytar() !== null;
}
