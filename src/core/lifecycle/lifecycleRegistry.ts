/**
 * Scoped lifecycle registry for migrated tests. Generated registration modules (one per migrated feature) register
 * their BEFORE/AFTER actions under a stable feature key; the single Before and After hooks in
 * src/core/hooks/beforeEach.ts dispatch to them by the normalized pickle uri. There is never a hook per test.
 *
 * - BEFORE actions run in ordinal order; the first failure stops the remaining BEFORE actions and fails the scenario.
 * - AFTER actions always all run in ordinal order; failures are collected and reported together.
 */
export type GeneratedLifecycleAction = {
  id: string;
  ordinal: number;
  run: (world: any) => unknown | Promise<unknown>;
};

export type GeneratedLifecycleEntry = {
  before: GeneratedLifecycleAction[];
  after: GeneratedLifecycleAction[];
};

const registry = new Map<string, GeneratedLifecycleEntry>();

/** `<projectKey>/<path>.feature` from a feature uri (relative or absolute, any separator). */
export function lifecycleKeyFromUri(uri: string | undefined | null): string | undefined {
  if (!uri) {
    return undefined;
  }
  const match = uri.replace(/\\/g, '/').match(/(?:^|\/)features\/(.+\.feature)$/i);
  return match ? match[1] : undefined;
}

/** Registers (or replaces) the generated lifecycle of one feature. */
export function registerGeneratedLifecycle(featureKey: string, entry: GeneratedLifecycleEntry): void {
  const byOrdinal = (a: GeneratedLifecycleAction, b: GeneratedLifecycleAction) => a.ordinal - b.ordinal;
  registry.set(featureKey.replace(/\\/g, '/'), {
    before: [...entry.before].sort(byOrdinal),
    after: [...entry.after].sort(byOrdinal),
  });
}

export function generatedLifecycleFor(uri: string | undefined | null): GeneratedLifecycleEntry | undefined {
  const key = lifecycleKeyFromUri(uri);
  return key ? registry.get(key) : undefined;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runGeneratedBefore(uri: string | undefined | null, world: unknown): Promise<void> {
  const entry = generatedLifecycleFor(uri);
  if (!entry) {
    return;
  }
  for (const action of entry.before) {
    try {
      await action.run(world);
    } catch (error) {
      const wrapped = new Error(`Generated BEFORE lifecycle action ${action.id} failed: ${describe(error)}`);
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
  }
}

export async function runGeneratedAfter(uri: string | undefined | null, world: unknown): Promise<void> {
  const entry = generatedLifecycleFor(uri);
  if (!entry) {
    return;
  }
  const failures: string[] = [];
  for (const action of entry.after) {
    try {
      await action.run(world);
    } catch (error) {
      failures.push(`${action.id}: ${describe(error)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Generated AFTER lifecycle actions failed (${failures.length}): ${failures.join('; ')}`);
  }
}

/** Test support only. */
export function resetGeneratedLifecycleRegistry(): void {
  registry.clear();
}
