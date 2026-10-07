import * as fs from 'fs';
import * as path from 'path';
import { getScenarioProjectKey } from '../config/projectEnv';

/**
 * Project variables: non-secret environment / configuration values of the scenario's project, managed by
 * CoTester in config/variables/{projectKey}.json. Secrets are never stored here.
 */
const VARIABLES_DIR = path.resolve(__dirname, '../../config/variables');

function load(projectKey: string): Record<string, string> {
  const filePath = path.join(VARIABLES_DIR, `${projectKey}.json`);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Project variables file for '${projectKey}' must be a JSON object.`);
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === 'string') {
      values[key] = value;
    }
  }
  return values;
}

export const variables = {
  /** Value of a project variable; throws when the scenario project does not define it. */
  get(key: string, projectKey?: string): string {
    const project = (projectKey ?? getScenarioProjectKey() ?? process.env.API_PROJECT_KEY)?.trim();
    if (!project) {
      throw new Error(`Project variable '${key}' requested without a scenario project key.`);
    }
    const value = load(project)[key];
    if (value === undefined) {
      throw new Error(`Project variable '${key}' is not defined for project '${project}'.`);
    }
    return value;
  },
};
