import type { Layer, Pramana, Side, Status } from './vocab';
import { extractRefs } from './refs';

export const ROOT = 'map';
export const PAGES = ['about', 'glossary'] as const;
/** Block ids, source ids and figure ids: lower-case ASCII words joined by hyphens. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set<string>([ROOT, 'index', '404', 'og', 'home', ...PAGES]);

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
    vedic_authority?: Side;
    pramanas?: Pramana[];
    pramanas_per?: string;
  };
}

export interface Tree<T extends Block> {
  get(id: string): T | undefined;
  children(id: string): T[];
  ancestors(id: string): T[];
  layerOf(id: string): Layer | undefined;
  topLevel(layer: Layer): T[];
}

const byOrder = (a: Block, b: Block) => a.data.order - b.data.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

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
    children: (id) => [...(kids.get(id) ?? [])],
    ancestors,
    layerOf: (id) => (ancestors(id)[0] ?? byId.get(id))?.data.layer,
    topLevel: (layer) => (kids.get(ROOT) ?? []).filter((b) => b.data.layer === layer),
  };
}

export function validate(blocks: Block[]): string[] {
  const errors: string[] = [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  for (const b of blocks) {
    const { parent, layer, related, sources, status, vedic_authority, pramanas, pramanas_per } = b.data;
    if (!SLUG.test(b.id)) errors.push(`${b.id}: file name must be lower-case ASCII words joined by hyphens`);
    if (RESERVED.has(b.id)) errors.push(`${b.id}: that name is reserved for a fixed page`);
    if (parent === ROOT) {
      if (!layer) errors.push(`${b.id}: a top-level block needs a layer`);
    } else {
      if (!byId.has(parent)) errors.push(`${b.id}: parent "${parent}" does not exist`);
      if (layer) errors.push(`${b.id}: only top-level blocks set a layer`);
    }
    const isSchool = parent === ROOT && layer === 'schools';
    if (isSchool && !vedic_authority) errors.push(`${b.id}: a school needs vedic_authority`);
    if (!isSchool) {
      const set = { pramanas, pramanas_per, vedic_authority };
      for (const [field, value] of Object.entries(set)) if (value !== undefined) errors.push(`${b.id}: only schools set ${field}`);
    }
    if (pramanas_per !== undefined && !pramanas?.length) errors.push(`${b.id}: pramanas_per needs pramanas`);
    const seen = new Set([b.id]);
    let stubAbove: string | undefined;
    for (let cur = parent; cur !== ROOT && byId.has(cur); cur = byId.get(cur)!.data.parent) {
      if (seen.has(cur)) {
        errors.push(`${b.id}: parent chain loops through "${cur}"`);
        break;
      }
      seen.add(cur);
      if (status !== 'stub' && !stubAbove && byId.get(cur)!.data.status === 'stub') stubAbove = cur;
    }
    // Pages are reached through their parents on the map, so a written block cannot sit under a stub.
    if (stubAbove) errors.push(`${b.id}: sits under "${stubAbove}", which is not written yet; write it first or keep this block a stub`);
    if (status !== 'stub' && sources.length === 0) errors.push(`${b.id}: a written block needs at least one source`);
    for (const r of related) {
      if (r === b.id) errors.push(`${b.id}: lists itself as related`);
      else if (!byId.has(r)) errors.push(`${b.id}: related block "${r}" does not exist`);
    }
    const ids = sources.map((s) => s.id);
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`${b.id}: source id "${id}" is used twice`);
    const { cites, notes, figures, unknown, links } = extractRefs(b.body ?? '');
    for (const n of notes) {
      if (!n.inline) errors.push(`${b.id}: write :note[…] inline, not on its own line`);
      if (n.empty) errors.push(`${b.id}: :note needs text, like :note[…]`);
      if (n.inLink) errors.push(`${b.id}: :note cannot sit inside a link`);
      if (n.inHeading) errors.push(`${b.id}: :note cannot sit inside a heading`);
      if (n.inNote) errors.push(`${b.id}: :note cannot sit inside another :note`);
    }
    for (const c of cites) {
      const id = c.id;
      if (!c.inline) errors.push(`${b.id}: write :cite[${id ?? '…'}] inline, not on its own line`);
      if (id === null) errors.push(`${b.id}: :cite needs a source id, like :cite[wiki]`);
      else {
        if (!ids.includes(id)) errors.push(`${b.id}: :cite[${id}] has no matching source`);
        if (c.inLink) errors.push(`${b.id}: :cite[${id}] cannot sit inside a link`);
        if (c.inHeading) errors.push(`${b.id}: :cite[${id}] cannot sit inside a heading`);
      }
    }
    const figureIds = new Set<string>();
    for (const f of figures) {
      if (!f.leaf) errors.push(`${b.id}: write ::figure[…]{#id} on its own line`);
      if (f.id === null) {
        errors.push(`${b.id}: ::figure needs an id, like {#rope-snake}`);
        continue;
      }
      if (!SLUG.test(f.id)) errors.push(`${b.id}: ::figure{#${f.id}} id must be lower-case ASCII words joined by hyphens`);
      if (!f.caption) errors.push(`${b.id}: ::figure{#${f.id}} needs a caption`);
      // the figure's element ids come from its id, so a second copy on the page would repeat them
      if (figureIds.has(f.id)) errors.push(`${b.id}: ::figure{#${f.id}} is used twice`);
      figureIds.add(f.id);
    }
    for (const name of unknown) errors.push(`${b.id}: ":${name}[…]" is not a directive (use :note or :cite)`);
    for (const { url, path } of links) {
      if (path === null) {
        errors.push(`${b.id}: link "${url}" must start with / (write /slug)`);
        continue;
      }
      if (path === '') continue; // the home page
      const target = byId.get(path);
      if (!target && !(PAGES as readonly string[]).includes(path)) errors.push(`${b.id}: link to ${url} goes nowhere`);
      else if (target?.data.status === 'stub') errors.push(`${b.id}: link to ${url} points at a page that does not exist yet`);
    }
  }
  return errors;
}
