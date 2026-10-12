import { describe, expect, it } from 'vitest';
import { buildTree, validate, type Block } from '../../src/lib/tree';

const block = (id: string, data: Partial<Block['data']> = {}, body = ''): Block => ({
  id,
  body,
  data: { title: id, parent: 'map', layer: 'schools', order: 1, status: 'draft', sources: [{ id: 'w' }], related: [], ...data },
});

const fixture = [
  block('vedanta', { order: 7 }),
  block('mimamsa', { order: 6 }),
  block('advaita', { parent: 'vedanta', layer: undefined, order: 1 }),
  block('dvaita', { parent: 'vedanta', layer: undefined, order: 3, status: 'stub', sources: [] }),
  block('sankara', { parent: 'advaita', layer: undefined }),
  block('samskrta', { layer: 'foundation' }),
];

describe('buildTree', () => {
  const tree = buildTree(fixture);

  it('lists children in order', () => {
    expect(tree.children('vedanta').map((b) => b.id)).toEqual(['advaita', 'dvaita']);
  });

  it('lists the top-level blocks of a layer in order', () => {
    expect(tree.topLevel('schools').map((b) => b.id)).toEqual(['mimamsa', 'vedanta']);
  });

  it('returns ancestors root-first, without the block itself', () => {
    expect(tree.ancestors('sankara').map((b) => b.id)).toEqual(['vedanta', 'advaita']);
    expect(tree.ancestors('vedanta')).toEqual([]);
  });

  it('finds the layer through the top-level ancestor', () => {
    expect(tree.layerOf('sankara')).toBe('schools');
    expect(tree.layerOf('samskrta')).toBe('foundation');
  });
});

describe('validate', () => {
  it('accepts a consistent tree', () => {
    expect(validate(fixture)).toEqual([]);
  });

  it('rejects non-ASCII and reserved block names', () => {
    expect(validate([block('śaṅkara'), block('about')])).toEqual([
      'śaṅkara: file name must be lower-case ASCII words joined by hyphens',
      'about: that name is reserved for a fixed page',
    ]);
  });

  it('reports a missing parent', () => {
    expect(validate([block('x', { parent: 'nowhere', layer: undefined })])).toEqual(['x: parent "nowhere" does not exist']);
  });

  it('requires a layer on top-level blocks and forbids it below', () => {
    expect(validate([block('a', { layer: undefined }), block('b', { parent: 'a', layer: 'vada' })])).toEqual([
      'a: a top-level block needs a layer',
      'b: only top-level blocks set a layer',
    ]);
  });

  it('reports a parent loop', () => {
    const errors = validate([block('a', { parent: 'b', layer: undefined }), block('b', { parent: 'a', layer: undefined })]);
    expect(errors).toContain('a: parent chain loops through "a"');
  });

  it('requires a source on every written block but not on stubs', () => {
    expect(validate([block('a', { sources: [] }), block('b', { status: 'stub', sources: [] })])).toEqual([
      'a: a written block needs at least one source',
    ]);
  });

  it('reports a missing related block, a duplicate source id and an unknown citation', () => {
    const errors = validate([block('a', { sources: [{ id: 'w' }, { id: 'w' }], related: ['ghost'] }, 'Text :cite[sep].')]);
    expect(errors).toEqual([
      'a: related block "ghost" does not exist',
      'a: source id "w" is used twice',
      'a: :cite[sep] has no matching source',
    ]);
  });

  it('reports links to missing pages and to stubs, and allows the fixed pages', () => {
    const errors = validate([...fixture, block('z', {}, 'See [x](/nothing), [d](/dvaita) and [g](/glossary).')]);
    expect(errors).toEqual([
      'z: link to /nothing goes nowhere',
      'z: link to /dvaita points at a page that does not exist yet',
    ]);
  });
});
