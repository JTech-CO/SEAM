// JSON-line logger that masks secrets (bot token, webhook token, HMAC secret) everywhere.

export type Level = 'info' | 'warn' | 'error';
export type Logger = Record<Level, (msg: string, fields?: Record<string, unknown>) => void>;

export function mask(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join('***');
  }
  // Telegram bot tokens that slipped in from elsewhere (e.g. an upstream error message)
  return out.replace(/\d{6,}:[A-Za-z0-9_-]{30,}/g, '***');
}

export function createLogger(secrets: readonly string[], sink: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): Logger {
  const write = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
    sink(mask(line, secrets));
  };
  return {
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
  };
}
