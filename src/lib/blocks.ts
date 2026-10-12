import { getCollection, type CollectionEntry } from 'astro:content';
import { buildTree, validate, type Tree } from './tree';

export type BlockEntry = CollectionEntry<'blocks'>;

let cache: Promise<{ all: BlockEntry[]; tree: Tree<BlockEntry> }> | undefined;

/** Every block, checked. Any content error fails the build with the full list. */
export function loadBlocks() {
  cache ??= (async () => {
    const all = await getCollection('blocks');
    const errors = validate(all);
    if (errors.length) throw new Error(`Content errors:\n- ${errors.join('\n- ')}`);
    return { all, tree: buildTree(all) };
  })();
  return cache;
}

export const isWritten = (b: BlockEntry) => b.data.status !== 'stub';
