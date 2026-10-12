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

  it('falls back to the id when the order is equal', () => {
    const t = buildTree([block('b', { order: 1 }), block('a', { order: 1 })]);
    expect(t.topLevel('schools').map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('returns a copy of the children, so callers cannot change the tree', () => {
    const t = buildTree(fixture);
    t.children('vedanta').reverse();
    expect(t.children('vedanta').map((b) => b.id)).toEqual(['advaita', 'dvaita']);
  });

  it('does not hang on a parent loop', () => {
    const loop = [
      block('c', { parent: 'a', layer: undefined }),
      block('a', { parent: 'b', layer: undefined }),
      block('b', { parent: 'a', layer: undefined }),
    ];
    const t = buildTree(loop);
    expect(Array.isArray(t.ancestors('c'))).toBe(true);
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

  it('accepts valid citations and links', () => {
    expect(
      validate([...fixture, block('ok', {}, 'A :cite[w] claim; see [a](/advaita), [home](/), [g](/glossary#g-atman).')]),
    ).toEqual([]);
  });

  it('checks every link form', () => {
    const body = [
      '[a](/dvaita#x)',
      '[b](/nothing "t")',
      '[c](/dvaita?x=1)',
      '[d](</nothing>)',
      '[e][r]',
      '[f](/Nothing)',
      '[g](/nothing/)',
      '[h](dvaita)',
      '',
      '[r]: /dvaita',
    ].join('\n\n');
    expect(validate([...fixture, block('z', {}, body)])).toEqual([
      'z: link to /dvaita#x points at a page that does not exist yet',
      'z: link to /nothing goes nowhere',
      'z: link to /dvaita?x=1 points at a page that does not exist yet',
      'z: link to /nothing goes nowhere',
      'z: link to /Nothing goes nowhere',
      'z: link to /nothing/ goes nowhere',
      'z: link "dvaita" must start with / (write /slug)',
      // the definition sits last in the body, so its error comes last
      'z: link to /dvaita points at a page that does not exist yet',
    ]);
  });

  it('ignores links inside code', () => {
    const body = '`[x](/nothing)`\n\n```\n[y](/nothing)\n```\n';
    expect(validate([block('a', {}, body)])).toEqual([]);
  });

  it('reads footnote definitions as GFM does, not as link definitions', () => {
    expect(validate([block('a', {}, 'A claim[^1].\n\n[^1]: Ibid')])).toEqual([]);
  });

  it('rejects a citation on its own line, which the renderer would not turn into a link', () => {
    expect(validate([block('a', {}, 'Claim.\n\n::cite[w]')])).toEqual(['a: write :cite[w] inline, not on its own line']);
  });

  it('rejects a citation without an id', () => {
    expect(validate([block('a', {}, 'See :cite.')])).toEqual(['a: :cite needs a source id, like :cite[wiki]']);
  });

  it('requires every ancestor of a written block to be written, so the map can reach it', () => {
    expect(validate([...fixture, block('x', { parent: 'dvaita', layer: undefined })])).toContain(
      'x: sits under "dvaita", which is not written yet; write it first or keep this block a stub',
    );
  });

  it('allows a stub under a stub', () => {
    expect(validate([...fixture, block('y', { parent: 'dvaita', layer: undefined, status: 'stub', sources: [] })])).toEqual([]);
  });

  it('rejects a block that lists itself as related', () => {
    expect(validate([block('a', { related: ['a'] })])).toEqual(['a: lists itself as related']);
  });

  it('reports a self-parent and a chain that runs into a loop', () => {
    expect(validate([block('s', { parent: 's', layer: undefined })])).toContain('s: parent chain loops through "s"');
    const errors = validate([
      block('c', { parent: 'a', layer: undefined }),
      block('a', { parent: 'b', layer: undefined }),
      block('b', { parent: 'a', layer: undefined }),
    ]);
    expect(errors.some((e) => e.startsWith('c: parent chain loops'))).toBe(true);
  });
});
