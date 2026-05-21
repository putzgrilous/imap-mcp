import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("imap-fetch");

export interface AttachmentResult {
  filename: string;
  contentType: string;
  size: number;
  data: string;
}

export async function fetchAttachment(
  client: ImapFlow,
  folder: string,
  uid: number,
  index: number,
): Promise<AttachmentResult> {
  const lock = await client.getMailboxLock(folder);
  try {
    for await (const msg of client.fetch([uid], { source: true })) {
      const parsed = await simpleParser(msg.source as Buffer);
      const att = parsed.attachments[index];
      if (!att) {
        throw new Error(
          `Attachment index ${index} not found. Email has ${parsed.attachments.length} attachment(s).`,
        );
      }
      log.debug({ uid, folder, index, filename: att.filename }, "fetchAttachment");
      return {
        filename: att.filename ?? `attachment-${index}`,
        contentType: att.contentType,
        size: att.size,
        data: att.content.toString("base64"),
      };
    }
    throw new Error(`Email UID ${uid} not found in ${folder}.`);
  } finally {
    lock.release();
  }
}
