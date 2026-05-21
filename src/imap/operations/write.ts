import { ImapFlow } from "imapflow";
import { getLogger } from "../../logging/logger.js";

const log = getLogger("imap-write");

export async function markRead(
  client: ImapFlow,
  folder: string,
  uid: number,
  read: boolean,
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    if (read) {
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, ["\\Seen"], { uid: true });
    }
    log.debug({ uid, folder, read }, "markRead");
  } finally {
    lock.release();
  }
}

export async function moveEmail(
  client: ImapFlow,
  folder: string,
  uid: number,
  destination: string,
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    await client.messageMove({ uid }, destination, { uid: true });
    log.debug({ uid, folder, destination }, "moveEmail");
  } finally {
    lock.release();
  }
}

export async function deleteEmail(
  client: ImapFlow,
  folder: string,
  uid: number,
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    // Mark as deleted then expunge — works on all IMAP servers
    await client.messageFlagsAdd({ uid }, ["\\Deleted"], { uid: true });
    await client.messageDelete({ uid }, { uid: true });
    log.debug({ uid, folder }, "deleteEmail");
  } finally {
    lock.release();
  }
}

export async function flagEmail(
  client: ImapFlow,
  folder: string,
  uid: number,
  flagged: boolean,
): Promise<void> {
  const lock = await client.getMailboxLock(folder);
  try {
    if (flagged) {
      await client.messageFlagsAdd({ uid }, ["\\Flagged"], { uid: true });
    } else {
      await client.messageFlagsRemove({ uid }, ["\\Flagged"], { uid: true });
    }
    log.debug({ uid, folder, flagged }, "flagEmail");
  } finally {
    lock.release();
  }
}

export async function createFolder(
  client: ImapFlow,
  path: string,
): Promise<void> {
  await client.mailboxCreate(path);
  log.debug({ path }, "createFolder");
}

export async function deleteFolder(
  client: ImapFlow,
  path: string,
): Promise<void> {
  await client.mailboxDelete(path);
  log.debug({ path }, "deleteFolder");
}
