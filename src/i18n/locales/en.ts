export const en = {
  // Startup
  "startup.config_not_found":
    "No config file found. Run 'npx imap-mcp setup' to get started.",
  "startup.config_invalid": "Invalid configuration: {{details}}",
  "startup.deprecated_password":
    "Warning: account '{{name}}' has a plain-text password in config.json. " +
    "Run 'npx imap-mcp setup' to migrate to secure storage.",
  "startup.ready": "imap-mcp server ready",

  // Account errors
  "account.not_found": "Account not found: {{email}}",
  "account.no_credentials":
    "No credentials found for {{email}}. Run 'npx imap-mcp setup' to configure.",

  // Tool: list_accounts
  "tool.list_accounts.description": "List all configured email accounts",
  "tool.list_accounts.no_accounts": "No accounts configured.",

  // Tool: list_folders
  "tool.list_folders.description": "List all folders/labels in an email account",
  "tool.list_folders.param_email": "Email address of the account",

  // Tool: list_emails
  "tool.list_emails.description": "List recent emails from a folder. Use pageToken for pagination.",
  "tool.list_emails.param_page_token_out": "Token to pass as pageToken to get the next page",
  "tool.list_emails.param_email": "Email address of the account",
  "tool.list_emails.param_folder": "Folder name (default: INBOX)",
  "tool.list_emails.param_limit": "Maximum number of emails to return (default: 20)",
  "tool.list_emails.param_page_token": "Pagination token from a previous response",
  "tool.list_emails.empty": "No emails found in {{folder}}.",

  // Tool: search_emails
  "tool.search_emails.description": "Search emails by sender, subject, or body content",
  "tool.search_emails.param_email": "Email address of the account",
  "tool.search_emails.param_query": "Search query (matches sender, subject, or body)",
  "tool.search_emails.param_folder": "Folder to search in (default: INBOX)",
  "tool.search_emails.param_unread_only": "Only return unread emails",
  "tool.search_emails.no_results": "No emails found matching '{{query}}'.",

  // Tool: get_email
  "tool.get_email.description": "Get the full content of an email by its UID",
  "tool.get_email.param_email": "Email address of the account",
  "tool.get_email.param_uid": "Unique ID of the email",
  "tool.get_email.param_folder": "Folder containing the email (default: INBOX)",
  "tool.get_email.empty_body": "(empty body)",

  // Tool: get_attachment
  "tool.get_attachment.description": "Download an attachment from an email by its index",
  "tool.get_attachment.param_email": "Email address of the account",
  "tool.get_attachment.param_uid": "Unique ID of the email",
  "tool.get_attachment.param_folder": "Folder containing the email (default: INBOX)",
  "tool.get_attachment.param_index": "Zero-based index of the attachment (0 = first)",

  // Tool: reply_email
  "tool.reply_email.description": "Reply to an email, automatically setting In-Reply-To and References headers",
  "tool.reply_email.param_email": "Email address of the sender account",
  "tool.reply_email.param_uid": "UID of the email to reply to",
  "tool.reply_email.param_folder": "Folder containing the original email (default: INBOX)",
  "tool.reply_email.param_text": "Plain text reply body",
  "tool.reply_email.param_html": "HTML reply body (optional)",
  "tool.reply_email.param_cc": "CC recipients (optional)",
  "tool.reply_email.param_bcc": "BCC recipients (optional)",
  "tool.reply_email.param_reply_all": "Reply to all original recipients, not just the sender (default: false)",
  "tool.reply_email.success": "Reply sent. Message-ID: {{messageId}}",

  // Tool: flag_email
  "tool.flag_email.description": "Star or unstar an email (\\Flagged)",
  "tool.flag_email.param_email": "Email address of the account",
  "tool.flag_email.param_uid": "Unique ID of the email",
  "tool.flag_email.param_folder": "Folder containing the email (default: INBOX)",
  "tool.flag_email.param_flagged": "True to star, false to unstar",
  "tool.flag_email.success": "Email {{uid}} {{status}}.",

  // Tool: create_folder
  "tool.create_folder.description": "Create a new folder/mailbox",
  "tool.create_folder.param_email": "Email address of the account",
  "tool.create_folder.param_path": "Full path of the folder to create (e.g. 'Archive/2024')",
  "tool.create_folder.success": "Folder '{{path}}' created.",

  // Tool: delete_folder
  "tool.delete_folder.description": "Delete a folder/mailbox and all its contents",
  "tool.delete_folder.param_email": "Email address of the account",
  "tool.delete_folder.param_path": "Full path of the folder to delete",
  "tool.delete_folder.success": "Folder '{{path}}' deleted.",

  // Tool: watch_folder
  "tool.watch_folder.description": "Watch a folder for new emails using IMAP IDLE. Returns immediately with a watch ID; new email notifications are sent as they arrive",
  "tool.watch_folder.param_email": "Email address of the account",
  "tool.watch_folder.param_folder": "Folder to watch (default: INBOX)",
  "tool.watch_folder.started": "Watching '{{folder}}' for new emails. Watch ID: {{watchId}}",
  "tool.watch_folder.stopped": "Stopped watching '{{folder}}'.",

  // Tool: unwatch_folder
  "tool.unwatch_folder.description": "Stop watching a folder (cancel a watch started with watch_folder)",
  "tool.unwatch_folder.param_watch_id": "Watch ID returned by watch_folder",
  "tool.unwatch_folder.not_found": "Watch ID '{{watchId}}' not found.",

  // Tool: mark_read
  "tool.mark_read.description": "Mark an email as read or unread",
  "tool.mark_read.param_email": "Email address of the account",
  "tool.mark_read.param_uid": "Unique ID of the email",
  "tool.mark_read.param_folder": "Folder containing the email (default: INBOX)",
  "tool.mark_read.param_read": "True to mark as read, false to mark as unread",
  "tool.mark_read.success": "Email {{uid}} marked as {{status}}.",

  // Tool: move_email
  "tool.move_email.description": "Move an email to a different folder",
  "tool.move_email.param_email": "Email address of the account",
  "tool.move_email.param_uid": "Unique ID of the email",
  "tool.move_email.param_folder": "Source folder containing the email (default: INBOX)",
  "tool.move_email.param_destination": "Destination folder path",
  "tool.move_email.success": "Email {{uid}} moved to {{destination}}.",

  // Tool: delete_email
  "tool.delete_email.description": "Permanently delete an email",
  "tool.delete_email.param_email": "Email address of the account",
  "tool.delete_email.param_uid": "Unique ID of the email",
  "tool.delete_email.param_folder": "Folder containing the email (default: INBOX)",
  "tool.delete_email.success": "Email {{uid}} deleted.",

  // Tool: search_emails (advanced filters)
  "tool.search_emails.param_since": "Return emails received after this date (ISO 8601, e.g. '2024-01-01')",
  "tool.search_emails.param_before": "Return emails received before this date (ISO 8601)",
  "tool.search_emails.param_larger_than": "Return emails larger than this size in bytes",
  "tool.search_emails.param_smaller_than": "Return emails smaller than this size in bytes",
  "tool.search_emails.param_has_attachment": "Only return emails with attachments",
  "tool.search_emails.param_flagged": "Only return starred/flagged emails",
  "tool.search_emails.param_limit": "Maximum number of results to return (default: 30)",

  // Tool: send_email
  "tool.send_email.description": "Send an email from a configured account",
  "tool.send_email.param_email": "Email address of the sender account",
  "tool.send_email.param_to": "Recipient email address(es), comma-separated or array",
  "tool.send_email.param_subject": "Email subject",
  "tool.send_email.param_text": "Plain text body",
  "tool.send_email.param_html": "HTML body (optional, used instead of text if provided)",
  "tool.send_email.param_cc": "CC recipients (optional)",
  "tool.send_email.param_bcc": "BCC recipients (optional)",
  "tool.send_email.param_reply_to": "Reply-To address (optional)",
  "tool.send_email.param_in_reply_to": "Message-ID of the email being replied to (optional)",
  "tool.send_email.param_attachments": "Email attachments encoded as base64 (optional)",
  "tool.send_email.param_attachment_filename": "Attachment filename",
  "tool.send_email.param_attachment_content_base64": "Attachment content encoded as base64",
  "tool.send_email.param_attachment_content_type": "Attachment MIME type (optional)",
  "tool.send_email.param_attachment_cid": "Content-ID for inline attachment (optional)",
  "tool.send_email.success": "Email sent. Message-ID: {{messageId}}",

  // Errors
  "error.connection_failed": "Failed to connect to IMAP server: {{details}}",
  "error.operation_timeout": "Operation timed out after {{ms}}ms",
  "error.folder_not_found": "Folder not found: {{folder}}",
  "error.email_not_found": "Email not found: UID {{uid}}",
  "error.unexpected": "Unexpected error: {{details}}",
} as const;

export type MessageKey = keyof typeof en;
