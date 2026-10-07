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

export const testData = {
  async getFile(bindingKey: string): Promise<string> {
    const manifest = await loadManifest();
    const entry = manifest?.resources?.[bindingKey];
    if (entry?.localPath) {
      return entry.localPath;
    }
    throw new Error(
      `Data Center file binding "${bindingKey}" is not available. Ensure the resource is bound and the test run manifest was prepared.`,
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
};

export function resetTestDataCache(): void {
  cachedManifest = undefined;
}
