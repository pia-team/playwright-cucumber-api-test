export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static enableConsole: boolean = true;
  private static enableFile: boolean = false;
  private static logFile: string = 'logs/test-execution.log';

  static setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  static setConsoleOutput(enabled: boolean): void {
    this.enableConsole = enabled;
  }

  static setFileOutput(enabled: boolean, filePath?: string): void {
    this.enableFile = enabled;
    if (filePath) {
      this.logFile = filePath;
    }
  }

  private static formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  private static writeLog(level: string, message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(level, message, ...args);

    if (this.enableConsole) {
      switch (level) {
        case 'ERROR':
          console.error(formattedMessage);
          break;
        case 'WARN':
          console.warn(formattedMessage);
          break;
        case 'DEBUG':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    if (this.enableFile) {
      // File logging would require fs module
      // For now, we'll keep it simple with console only
      // Can be extended with fs.appendFileSync if needed
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.writeLog('DEBUG', message, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.writeLog('INFO', message, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.writeLog('WARN', message, ...args);
    }
  }

  static error(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.writeLog('ERROR', message, ...args);
    }
  }

  static logRequest(method: string, url: string, headers?: Record<string, string>, body?: any): void {
    this.info(`HTTP Request: ${method} ${url}`);
    if (headers) {
      this.debug('Request Headers:', headers);
    }
    if (body) {
      this.debug('Request Body:', body);
    }
  }

  static logResponse(status: number, statusText: string, headers?: Record<string, string>, body?: any): void {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    this[level](`HTTP Response: ${status} ${statusText}`);
    if (headers) {
      this.debug('Response Headers:', headers);
    }
    if (body) {
      this.debug('Response Body:', body);
    }
  }

  static logStep(stepType: string, stepText: string): void {
    this.info(`Step: ${stepType} ${stepText}`);
  }

  static logScenario(scenarioName: string): void {
    this.info(`\n=== Scenario: ${scenarioName} ===`);
  }

  static logFeature(featureName: string): void {
    this.info(`\n>>> Feature: ${featureName} <<<`);
  }
}

// Export a default instance for convenience
export const logger = Logger;
