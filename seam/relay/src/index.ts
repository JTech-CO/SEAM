// seam-relay entrypoint: TradingView alert() webhook → Telegram.
import { createServer } from 'node:http';
import { describe, loadConfig, secretsOf, type Config } from './config.ts';
import { createLogger } from './log.ts';
import { createHandler } from './server.ts';
import { createDryRunSender, createTelegramSender } from './telegram.ts';

function boot(): Config {
  try {
    return loadConfig();
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exit(1);
  }
}

const config = boot();

const logger = createLogger(secretsOf(config));
const sender = config.dryRun
  ? createDryRunSender(logger)
  : createTelegramSender({ token: config.botToken, apiBase: config.apiBase, logger });

const server = createServer(createHandler({ config, sender, logger }));
server.requestTimeout = 10_000;
server.headersTimeout = 5_000;
server.keepAliveTimeout = 5_000;

server.listen(config.port, config.host, () => {
  logger.info('seam-relay listening', describe(config));
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    logger.info('shutting down', { signal: sig });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
