import pino, { Logger as PinoLogger } from 'pino';
import fs from 'fs';
import path from 'path';

function getLogFilePath() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return path.join(logDir, `api-${yyyy}-${mm}-${dd}.log`);
}

class Logger {
  private pinoLogger: PinoLogger | null;
  private isProd: boolean;

  constructor() {
    this.isProd = process.env.NODE_ENV === 'production';
    if (this.isProd) {
      const dest = pino.destination({ dest: getLogFilePath(), sync: false });
      this.pinoLogger = pino({ level: 'info' }, dest);
    } else {
      this.pinoLogger = null;
    }
  }
  info(...args: Parameters<PinoLogger['info']>) {
    if (this.isProd && this.pinoLogger) {
      this.pinoLogger.info(...args);
    } else {
      console.info('\x1b[32m[INFO]\x1b[0m', ...args);
    }
  }
  error(...args: Parameters<PinoLogger['error']>) {
    if (this.isProd && this.pinoLogger) {
      this.pinoLogger.error(...args);
    } else {
      console.error('\x1b[31m[ERROR]\x1b[0m', ...args);
    }
  }
  warn(...args: Parameters<PinoLogger['warn']>) {
    if (this.isProd && this.pinoLogger) {
      this.pinoLogger.warn(...args);
    } else {
      console.warn('\x1b[33m[WARN]\x1b[0m', ...args);
    }
  }
  debug(...args: Parameters<PinoLogger['debug']>) {
    if (this.isProd && this.pinoLogger) {
      this.pinoLogger.debug(...args);
    } else {
      console.debug('\x1b[36m[DEBUG]\x1b[0m', ...args);
    }
  }
}

const logger = new Logger();
export default logger;
