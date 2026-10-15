import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every `*.svg` in `dir`, as id → SVG text; the id is the file name without `.svg`.
 *
 * A plain object, not a Map, sorted by id: Astro's content cache keys on the serialized config,
 * so an edited figure changes the digest and the pages that draw it are rebuilt.
 */
export function loadFigures(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.svg'))
    .map((e) => e.name)
    .sort();
  return Object.fromEntries(files.map((f) => [f.slice(0, -'.svg'.length), readFileSync(join(dir, f), 'utf8')]));
}
