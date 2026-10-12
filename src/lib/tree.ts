import type { Layer, Status } from './vocab';

export const ROOT = 'map';
export const PAGES = ['about', 'glossary'] as const;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set<string>([ROOT, 'index', '404', 'og', ...PAGES]);

export interface Block {
  id: string;
  body?: string;
  data: {
    title: string;
    parent: string;
    layer?: Layer;
    order: number;
    status: Status;
    sources: { id: string }[];
    related: string[];
  };
}

export interface Tree<T extends Block> {
  get(id: string): T | undefined;
  children(id: string): T[];
  ancestors(id: string): T[];
  layerOf(id: string): Layer | undefined;
  topLevel(layer: Layer): T[];
}

const byOrder = (a: Block, b: Block) => a.data.order - b.data.order || a.id.localeCompare(b.id);

export function buildTree<T extends Block>(blocks: T[]): Tree<T> {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const kids = new Map<string, T[]>();
  for (const b of blocks) kids.set(b.data.parent, [...(kids.get(b.data.parent) ?? []), b]);
  for (const list of kids.values()) list.sort(byOrder);

  const ancestors = (id: string): T[] => {
    const chain: T[] = [];
    const seen = new Set([id]);
    let cur = byId.get(id)?.data.parent;
    while (cur && cur !== ROOT && !seen.has(cur)) {
      const b = byId.get(cur);
      if (!b) break;
      seen.add(cur);
      chain.unshift(b);
      cur = b.data.parent;
    }
    return chain;
  };

  return {
    get: (id) => byId.get(id),
    children: (id) => kids.get(id) ?? [],
    ancestors,
    layerOf: (id) => (ancestors(id)[0] ?? byId.get(id))?.data.layer,
    topLevel: (layer) => (kids.get(ROOT) ?? []).filter((b) => b.data.layer === layer),
  };
}

const CITE = /:cite\[([^\]]*)\]/g;
const LINK = /\]\(\/([a-z0-9-]+)\)/g;

export function validate(blocks: Block[]): string[] {
  const errors: string[] = [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  for (const b of blocks) {
    const { parent, layer, related, sources, status } = b.data;
    if (!SLUG.test(b.id)) errors.push(`${b.id}: file name must be lower-case ASCII words joined by hyphens`);
    if (RESERVED.has(b.id)) errors.push(`${b.id}: that name is reserved for a fixed page`);
    if (parent === ROOT) {
      if (!layer) errors.push(`${b.id}: a top-level block needs a layer`);
    } else {
      if (!byId.has(parent)) errors.push(`${b.id}: parent "${parent}" does not exist`);
      if (layer) errors.push(`${b.id}: only top-level blocks set a layer`);
    }
    const seen = new Set([b.id]);
    for (let cur = parent; cur !== ROOT && byId.has(cur); cur = byId.get(cur)!.data.parent) {
      if (seen.has(cur)) {
        errors.push(`${b.id}: parent chain loops through "${cur}"`);
        break;
      }
      seen.add(cur);
    }
    if (status !== 'stub' && sources.length === 0) errors.push(`${b.id}: a written block needs at least one source`);
    for (const r of related) if (!byId.has(r)) errors.push(`${b.id}: related block "${r}" does not exist`);
    const ids = sources.map((s) => s.id);
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`${b.id}: source id "${id}" is used twice`);
    const body = b.body ?? '';
    for (const [, id] of body.matchAll(CITE)) if (!ids.includes(id)) errors.push(`${b.id}: :cite[${id}] has no matching source`);
    for (const [, slug] of body.matchAll(LINK)) {
      const target = byId.get(slug);
      if (!target && !(PAGES as readonly string[]).includes(slug)) errors.push(`${b.id}: link to /${slug} goes nowhere`);
      else if (target?.data.status === 'stub') errors.push(`${b.id}: link to /${slug} points at a page that does not exist yet`);
    }
  }
  return errors;
}
