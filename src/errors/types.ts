export type ImapMcpErrorCode =
  | "CONNECTION_FAILED"
  | "CONNECTION_TIMEOUT"
  | "AUTH_FAILED"
  | "ACCOUNT_NOT_FOUND"
  | "FOLDER_NOT_FOUND"
  | "EMAIL_NOT_FOUND"
  | "CREDENTIAL_NOT_FOUND"
  | "CONFIG_INVALID"
  | "OPERATION_TIMEOUT"
  | "SMTP_FAILED";

export class ImapMcpError extends Error {
  constructor(
    public readonly code: ImapMcpErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImapMcpError";
  }
}

export class ImapConnectionError extends ImapMcpError {
  constructor(message: string, cause?: unknown) {
    super("CONNECTION_FAILED", message, true, cause);
    this.name = "ImapConnectionError";
  }
}

export class ImapTimeoutError extends ImapMcpError {
  constructor(message: string, cause?: unknown) {
    super("OPERATION_TIMEOUT", message, true, cause);
    this.name = "ImapTimeoutError";
  }
}

export class ImapAuthError extends ImapMcpError {
  constructor(message: string, cause?: unknown) {
    super("AUTH_FAILED", message, false, cause);
    this.name = "ImapAuthError";
  }
}

export class AccountNotFoundError extends ImapMcpError {
  constructor(email: string) {
    super("ACCOUNT_NOT_FOUND", `Account not found: ${email}`, false);
    this.name = "AccountNotFoundError";
  }
}

export class FolderNotFoundError extends ImapMcpError {
  constructor(folder: string) {
    super("FOLDER_NOT_FOUND", `Folder not found: ${folder}`, false);
    this.name = "FolderNotFoundError";
  }
}

export class EmailNotFoundError extends ImapMcpError {
  constructor(uid: number) {
    super("EMAIL_NOT_FOUND", `Email not found: UID ${uid}`, false);
    this.name = "EmailNotFoundError";
  }
}

export class CredentialNotFoundError extends ImapMcpError {
  constructor(email: string) {
    super(
      "CREDENTIAL_NOT_FOUND",
      `No credentials found for ${email}. Run 'npx imap-mcp setup' to configure.`,
      false,
    );
    this.name = "CredentialNotFoundError";
  }
}

export class ConfigValidationError extends ImapMcpError {
  constructor(message: string) {
    super("CONFIG_INVALID", message, false);
    this.name = "ConfigValidationError";
  }
}
