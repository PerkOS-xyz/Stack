type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
  private isDev = process.env.NODE_ENV === "development";

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logObj = {
      timestamp,
      level,
      message,
      ...(meta && { ...meta }),
    };

    if (this.isDev) {
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta || "");
    } else {
      console.log(JSON.stringify(logObj));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.isDev) {
      this.log("debug", message, meta);
    }
  }
}

export const logger = new Logger();
