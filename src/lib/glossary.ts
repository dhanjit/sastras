import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type Glossary = Map<string, string>;

/** Reads term → meaning from YAML. Keys are lower-cased; an empty meaning is an error. */
export function loadGlossary(path = 'src/data/glossary.yaml'): Glossary {
  const raw = (parse(readFileSync(path, 'utf8')) ?? {}) as Record<string, unknown>;
  const map: Glossary = new Map();
  for (const [term, meaning] of Object.entries(raw)) {
    if (typeof meaning !== 'string' || !meaning.trim()) throw new Error(`glossary.yaml: "${term}" has no meaning`);
    map.set(term.toLowerCase(), meaning.trim());
  }
  return map;
}

export const termAnchor = (term: string) =>
  'g-' + term.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
