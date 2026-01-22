import * as fs from 'fs';

export class TestDataHelper {
  static getData<T>(fileName: string): T {
    return JSON.parse(fs.readFileSync(`test-data/${fileName}`, 'utf-8'));
  }
}
