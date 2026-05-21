import { ImapFlow } from "imapflow";
import type { AccountConfig } from "../config/schema.js";
import { getCredentials } from "../credentials/manager.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("imap-idle");

export interface NewEmailNotification {
  email: string;
  folder: string;
  uid: number;
  subject: string;
  from: string;
  date: Date | undefined;
}

export type IdleCallback = (notification: NewEmailNotification) => void;

interface WatchHandle {
  stop: () => Promise<void>;
}

export async function watchFolder(
  account: AccountConfig,
  folder: string,
  onNewEmail: IdleCallback,
): Promise<WatchHandle> {
  const credentials = await getCredentials(account);
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: { user: account.email, pass: credentials.value },
    logger: false,
    tls: { rejectUnauthorized: true },
  });

  await client.connect();
  const lock = await client.getMailboxLock(folder);

  // Track the highest UID seen at watch start
  let highestUid = (client.mailbox as { uidNext?: number }).uidNext ?? 1;

  client.on("exists", async () => {
    try {
      // Fetch any new messages since we started watching
      const uids = await client.search({ uid: `${highestUid}:*` });
      const newUids = (uids || []).filter((u: number) => u >= highestUid);
      if (newUids.length === 0) return;

      for await (const msg of client.fetch(newUids, { envelope: true, uid: true })) {
        if (msg.uid >= highestUid) {
          highestUid = msg.uid + 1;
          onNewEmail({
            email: account.email,
            folder,
            uid: msg.uid,
            subject: msg.envelope?.subject ?? "(no subject)",
            from: msg.envelope?.from?.[0]?.address ?? "",
            date: msg.envelope?.date,
          });
        }
      }
    } catch (err) {
      log.warn({ err }, "watch_folder: error handling EXISTS notification");
    }
  });

  // Start IDLE — imapflow manages the IDLE loop internally
  client.idle().catch((err) => {
    log.warn({ err }, "watch_folder: IDLE ended");
  });

  log.info({ email: account.email, folder }, "watch_folder: started");

  return {
    stop: async () => {
      lock.release();
      await client.logout().catch(() => {});
      log.info({ email: account.email, folder }, "watch_folder: stopped");
    },
  };
}
