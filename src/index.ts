import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/loader.js";
import { initLocale } from "./i18n/index.js";
import { initLogger, getLogger } from "./logging/logger.js";
import { registerShutdownHandlers, registerCleanup } from "./shutdown/manager.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();

  initLogger(process.env.IMAP_MCP_DEBUG ? "debug" : config.logLevel);
  initLocale(process.env.IMAP_MCP_LOCALE ?? config.locale);

  const log = getLogger("main");

  registerShutdownHandlers();

  const { server, pool } = createServer(config);
  registerCleanup(() => pool.drain());

  const transport = new StdioServerTransport();

  await server.connect(transport);

  if (config.accounts.length === 0) {
    process.stderr.write(
      "\nimap-mcp: No accounts configured.\n" +
      "Ask Claude to run 'setup_account' to add your first email account.\n" +
      "Your password will be entered in this terminal — never in the chat.\n\n",
    );
  }

  log.info({ accounts: config.accounts.length }, "imap-mcp server ready");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
