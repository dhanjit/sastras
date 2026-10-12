import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type Glossary = Map<string, string>;

/**
 * Anchor for a term. Long vowels are doubled before the marks are stripped, so words that differ
 * only in vowel length (kāla "time" / kala "part", bhāva / bhava) keep distinct anchors.
 */
export const termAnchor = (term: string) =>
  'g-' +
  term
    .normalize('NFC')
    .toLowerCase()
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ū/g, 'uu')
    .replace(/ṝ/g, 'rr')
    .replace(/ḹ/g, 'll')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Reads term → meaning from YAML. Keys are NFC-normalized and lower-cased. An empty meaning, a term
 * listed twice, or two terms with the same anchor is an error: each would silently drop an entry.
 */
export function loadGlossary(path = 'src/data/glossary.yaml'): Glossary {
  const raw = parse(readFileSync(path, 'utf8')) ?? {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('glossary.yaml must map terms to meanings');
  const map: Glossary = new Map();
  const byAnchor = new Map<string, string>();
  for (const [term, meaning] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof meaning !== 'string' || !meaning.trim()) throw new Error(`glossary.yaml: "${term}" has no meaning`);
    const key = term.normalize('NFC').toLowerCase();
    if (map.has(key)) throw new Error(`glossary.yaml: "${term}" is listed twice`);
    const anchor = termAnchor(key);
    const other = byAnchor.get(anchor);
    if (other !== undefined) throw new Error(`glossary.yaml: "${other}" and "${term}" share the anchor ${anchor}`);
    byAnchor.set(anchor, term);
    map.set(key, meaning.trim());
  }
  return map;
}
