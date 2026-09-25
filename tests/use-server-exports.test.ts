import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    }),
  );
  return files.flat();
}

/** Top-level `export ...` statements, ignoring `export async function`. */
function nonActionExports(source: string): string[] {
  return (
    source
      .split('\n')
      .filter((line) => /^export\b/.test(line))
      .filter((line) => !/^export\s+async\s+function\s/.test(line))
      // `export type` / `export interface` are erased at compile time and are fine.
      .filter((line) => !/^export\s+(type|interface)\b/.test(line))
      .map((line) => line.trim())
  );
}

describe('"use server" modules', () => {
  it('only export async functions', async () => {
    const files = await sourceFiles(SRC);
    const offenders: string[] = [];
    let scanned = 0;

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      // The directive is only a directive when it is the very first statement.
      if (!/^(['"])use server\1;/.test(source.trimStart())) continue;
      scanned += 1;

      for (const line of nonActionExports(source)) {
        offenders.push(`${file.slice(SRC.length + 1)}: ${line}`);
      }
    }

    // Guards against the scan silently matching nothing and passing by default.
    expect(scanned).toBeGreaterThan(0);

    // Exporting an object, array, constant or sync function from a "use server"
    // module is a hard runtime error in the App Router:
    // "A 'use server' file can only export async functions, found object."
    expect(offenders).toEqual([]);
  });
});
