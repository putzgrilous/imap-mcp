export interface ProviderPreset {
  host: string;
  port: number;
  secure: boolean;
  appPasswordUrl?: string;
  notes?: string;
}

export const PROVIDERS: Record<string, ProviderPreset> = {
  gmail: {
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    notes:
      "Gmail requires an App Password when 2-Step Verification is enabled. " +
      "Do NOT use your regular Gmail password.",
  },
  outlook: {
    host: "outlook.office365.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://account.microsoft.com/security",
    notes:
      "Outlook/Microsoft 365 requires an App Password when MFA is enabled.",
  },
  yahoo: {
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://login.yahoo.com/account/security",
    notes: "Yahoo requires an App Password. Max 4 concurrent IMAP connections.",
  },
  icloud: {
    host: "imap.mail.me.com",
    port: 993,
    secure: true,
    appPasswordUrl: "https://appleid.apple.com/account/manage",
    notes:
      "iCloud Mail requires an App-Specific Password from Apple ID settings.",
  },
};

export function detectProvider(email: string): ProviderPreset | undefined {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return undefined;

  if (domain === "gmail.com" || domain === "googlemail.com")
    return PROVIDERS.gmail;
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain.endsWith(".onmicrosoft.com")
  )
    return PROVIDERS.outlook;
  if (domain === "yahoo.com" || domain === "yahoo.com.br")
    return PROVIDERS.yahoo;
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com")
    return PROVIDERS.icloud;

  return undefined;
}
