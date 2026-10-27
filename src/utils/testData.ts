import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

type ManifestResource = {
  resourceId: string;
  versionId: string;
  versionNumber: number;
  type: string;
  bindingKey: string;
  localPath: string;
  mimeType?: string;
  readOnly?: boolean;
  datasetPath?: string;
  checksumSha256?: string;
  consumerRef?: string;
  resourceVersionId?: string;
};

export type DatasetRow = Record<string, string>;

export type DatasetSheetInfo = {
  name: string;
  hidden: boolean;
  headerRow: boolean;
  columns: string[];
  rowCount: number;
};

export type Dataset = {
  bindingKey: string;
  sourceFormat: string;
  defaultSheet: string | null;
  sheets: DatasetSheetInfo[];
  rows?: DatasetRow[];
};

export type DatasetRowsOptions = { sheet?: string };

export type DatasetCellOptions = {
  sheet?: string;
  /** 0-based row index; defaults to first row. */
  rowIndex?: number;
};

type DatasetFile = {
  sourceFormat: string;
  defaultSheet: string | null;
  sheets: (DatasetSheetInfo & { rows: DatasetRow[] })[];
};

const JSON_SHEET = 'default';

type ManifestConfig = {
  resourceId: string;
  versionId: string;
  versionNumber: number;
  type: string;
  entries: Record<string, string>;
};

type RunDataManifest = {
  runId: string;
  projectKey?: string;
  resources: Record<string, ManifestResource>;
  configs: Record<string, ManifestConfig>;
};

let cachedManifest: RunDataManifest | null | undefined;

async function loadManifest(): Promise<RunDataManifest | null> {
  if (cachedManifest !== undefined) {
    return cachedManifest;
  }
  const manifestPath = process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
  if (!manifestPath) {
    cachedManifest = null;
    return null;
  }
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    cachedManifest = JSON.parse(raw) as RunDataManifest;
    return cachedManifest;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') {
      cachedManifest = null;
      return null;
    }
    throw e;
  }
}

function jsonDataset(bindingKey: string, json: unknown): DatasetFile {
  const items = Array.isArray(json) ? json : json && typeof json === 'object' ? [json] : null;
  if (!items) {
    throw new Error(`Data Center dataset binding "${bindingKey}" is not valid JSON.`);
  }
  const rows = items as DatasetRow[];
  const columns = [...new Set(rows.flatMap((row) => (row && typeof row === 'object' ? Object.keys(row) : [])))];
  return {
    sourceFormat: 'JSON',
    defaultSheet: JSON_SHEET,
    sheets: [{ name: JSON_SHEET, hidden: false, headerRow: true, columns, rowCount: rows.length, rows }],
  };
}

function selectSheet(bindingKey: string, file: DatasetFile, sheet?: string): DatasetFile['sheets'][number] {
  const name = sheet ?? file.defaultSheet;
  if (name === null || name === undefined) {
    const visible = file.sheets.filter((s) => !s.hidden).map((s) => s.name);
    throw new Error(
      `Data Center dataset "${bindingKey}" has several sheets (${visible.join(', ')}); pass { sheet } to choose one.`,
    );
  }
  const selected = file.sheets.find((s) => s.name === name);
  if (!selected) {
    throw new Error(`Data Center dataset "${bindingKey}" has no sheet "${name}".`);
  }
  return selected;
}

async function loadDatasetFile(bindingKey: string): Promise<DatasetFile> {
  const manifest = await loadManifest();
  const entry = manifest?.resources?.[bindingKey];
  if (entry?.datasetPath) {
    return JSON.parse(await fs.readFile(entry.datasetPath, 'utf8')) as DatasetFile;
  }
  return jsonDataset(bindingKey, await testData.getJson(bindingKey));
}

function describeDataset(bindingKey: string, file: DatasetFile): Dataset {
  const dataset: Dataset = {
    bindingKey,
    sourceFormat: file.sourceFormat,
    defaultSheet: file.defaultSheet,
    sheets: file.sheets.map((s) => ({
      name: s.name,
      hidden: s.hidden,
      headerRow: s.headerRow,
      columns: s.columns,
      rowCount: s.rowCount,
    })),
  };
  if (file.defaultSheet !== null) {
    dataset.rows = selectSheet(bindingKey, file).rows;
  }
  return dataset;
}

async function assertSafeManifestFile(
  bindingKey: string,
  entry: ManifestResource,
): Promise<string> {
  const localPath = entry.localPath;
  if (!localPath || typeof localPath !== 'string') {
    throw new Error(
      `PREFLIGHT: Data Center file binding "${bindingKey}" has no localPath in the run manifest.`,
    );
  }
  const resolved = path.resolve(localPath);
  const manifestPath = process.env.COTESTER_RUN_DATA_MANIFEST_PATH;
  if (manifestPath) {
    const workRoot = path.resolve(path.dirname(manifestPath));
    if (!resolved.startsWith(workRoot + path.sep) && resolved !== workRoot) {
      throw new Error(
        `PREFLIGHT: Data Center file binding "${bindingKey}" localPath is outside the run work directory.`,
      );
    }
  }
  try {
    await fs.access(resolved);
  } catch {
    throw new Error(
      `PREFLIGHT: Data Center file binding "${bindingKey}" is missing on disk (resource unavailable).`,
    );
  }
  if (entry.checksumSha256) {
    const buf = await fs.readFile(resolved);
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    if (actual.toLowerCase() !== String(entry.checksumSha256).toLowerCase()) {
      throw new Error(
        `PREFLIGHT: Data Center file binding "${bindingKey}" checksum mismatch (corrupted or stale materialization).`,
      );
    }
  }
  return resolved;
}

export const testData = {
  async getFile(bindingKey: string): Promise<string> {
    const manifest = await loadManifest();
    const entry = manifest?.resources?.[bindingKey];
    if (entry?.localPath) {
      return assertSafeManifestFile(bindingKey, entry);
    }
    throw new Error(
      `PREFLIGHT: Data Center file binding "${bindingKey}" is not available. Bind the resource and re-run; this is not a test assertion failure.`,
    );
  },

  async getJson(bindingKey: string): Promise<unknown> {
    const filePath = await this.getFile(bindingKey);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  },

  async getConfig(bindingKey: string): Promise<Record<string, string>> {
    const manifest = await loadManifest();
    const entry = manifest?.configs?.[bindingKey];
    if (entry?.entries) {
      return entry.entries;
    }
    throw new Error(`Data Center config binding "${bindingKey}" is not available.`);
  },

  /** Structure of a DATASET binding; `rows` holds the default sheet's rows when the dataset has one. */
  async getDataset(bindingKey: string): Promise<Dataset> {
    return describeDataset(bindingKey, await loadDatasetFile(bindingKey));
  },

  /** Rows of a DATASET binding; multi-sheet workbooks require `{ sheet }`. */
  async getRows(bindingKey: string, options: DatasetRowsOptions = {}): Promise<DatasetRow[]> {
    return selectSheet(bindingKey, await loadDatasetFile(bindingKey), options.sheet).rows;
  },

  /**
   * Single cell from a DATASET binding (DATA-2). Fail-closed on empty dataset,
   * missing column, or out-of-range row. Values stay strings for runner compatibility.
   */
  async getCell(
    bindingKey: string,
    column: string,
    options: DatasetCellOptions = {},
  ): Promise<string> {
    if (!column || !String(column).trim()) {
      throw new Error(`Data Center dataset "${bindingKey}" column name is required.`);
    }
    const col = String(column);
    const rows = await this.getRows(bindingKey, { sheet: options.sheet });
    if (!rows.length) {
      throw new Error(`Data Center dataset "${bindingKey}" has no rows.`);
    }
    // DATA-3: job-scoped iteration overrides authoring-time rowIndex so every
    // field bound to this dataset reads the same row in the current iteration.
    const envRaw = process.env.COTESTER_DATASET_ROW_INDEX;
    let index = options.rowIndex == null ? 0 : options.rowIndex;
    if (envRaw != null && String(envRaw).trim() !== '') {
      const parsed = Number.parseInt(String(envRaw).trim(), 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(
          `COTESTER_DATASET_ROW_INDEX must be a non-negative integer (got "${envRaw}").`,
        );
      }
      index = parsed;
    }
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
      throw new Error(
        `Data Center dataset "${bindingKey}" has no row at index ${index} (${rows.length} rows).`,
      );
    }
    const row = rows[index];
    if (!row || !Object.prototype.hasOwnProperty.call(row, col)) {
      throw new Error(`Data Center dataset "${bindingKey}" has no column "${col}".`);
    }
    return String(row[col] ?? '');
  },
};

export function resetTestDataCache(): void {
  cachedManifest = undefined;
}
