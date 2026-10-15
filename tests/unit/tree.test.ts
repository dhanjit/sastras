import { describe, expect, it } from 'vitest';
import { buildTree, validate, type Block } from '../../src/lib/tree';

const block = (id: string, data: Partial<Block['data']> = {}, body = ''): Block => {
  const d: Block['data'] = { title: id, parent: 'map', layer: 'schools', order: 1, status: 'draft', sources: [{ id: 'w' }], related: [], ...data };
  // A top-level school must say whether it accepts the Veda; give the fixtures one unless a test sets it explicitly.
  if (d.parent === 'map' && d.layer === 'schools' && !('vedic_authority' in data)) d.vedic_authority = 'accepts';
  return { id, body, data: d };
};

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
    expect(validate([block('śaṅkara'), block('about'), block('home')])).toEqual([
      'śaṅkara: file name must be lower-case ASCII words joined by hyphens',
      'about: that name is reserved for a fixed page',
      'home: that name is reserved for a fixed page',
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

  it('requires a school to say whether it accepts the Veda', () => {
    expect(validate([block('a', { vedic_authority: undefined })])).toEqual(['a: a school needs vedic_authority']);
  });

  it.each<[string, Partial<Block['data']>]>([
    ['pramanas', { pramanas: ['pratyaksa'] }],
    ['pramanas_per', { pramanas: ['pratyaksa'], pramanas_per: 'Advaita' }],
    ['vedic_authority', { vedic_authority: 'accepts' }],
  ])('lets only schools set %s', (field, extra) => {
    const nested = block('b', { parent: 'a', layer: undefined, ...extra });
    const otherLayer = block('c', { layer: 'foundation', ...extra });
    const errors = validate([block('a'), nested, otherLayer]);
    expect(errors.filter((e) => e.endsWith(`only schools set ${field}`))).toEqual([
      `b: only schools set ${field}`,
      `c: only schools set ${field}`,
    ]);
  });

  it('requires pramanas wherever pramanas_per is given', () => {
    expect(validate([block('a', { pramanas_per: 'Advaita' })])).toEqual(['a: pramanas_per needs pramanas']);
  });

  it('accepts a school that sets all three fields', () => {
    expect(validate([block('a', { pramanas: ['pratyaksa'], pramanas_per: 'Advaita', vedic_authority: 'accepts' })])).toEqual([]);
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

  it('reports a misspelt directive instead of letting the renderer drop it', () => {
    expect(validate([block('a', {}, 'A :ntoe[typo] here.')])).toEqual(['a: ":ntoe[…]" is not a directive (use :note or :cite)']);
  });

  it('leaves ordinary colons alone', () => {
    expect(validate([block('a', {}, 'Gītā 2:47 says.')])).toEqual([]);
  });

  it('rejects a note on its own line, which the renderer would not turn into a margin note', () => {
    expect(validate([block('a', {}, 'Claim.\n\n::note[x]')])).toEqual(['a: write :note[…] inline, not on its own line']);
  });

  it('rejects a note without text', () => {
    expect(validate([block('a', {}, 'A claim:note[].')])).toEqual(['a: :note needs text, like :note[…]']);
  });

  it('rejects a note inside a link', () => {
    expect(validate([block('a', {}, '[a link:note[x]](/glossary)')])).toEqual(['a: :note cannot sit inside a link']);
  });

  it('rejects a note inside a heading', () => {
    expect(validate([block('a', {}, '## Heading:note[x]')])).toEqual(['a: :note cannot sit inside a heading']);
  });

  it('rejects a note inside another note', () => {
    expect(validate([block('a', {}, 'A:note[outer :note[inner]]')])).toEqual(['a: :note cannot sit inside another :note']);
  });

  it('rejects a citation inside a link', () => {
    expect(validate([block('a', {}, '[a link:cite[w]](/glossary)')])).toEqual(['a: :cite[w] cannot sit inside a link']);
  });

  it('rejects a citation inside a heading', () => {
    expect(validate([block('a', {}, '## Heading:cite[w]')])).toEqual(['a: :cite[w] cannot sit inside a heading']);
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

  it('accepts a figure on its own line with an id and a caption that cites', () => {
    expect(validate([block('a', {}, 'Text.\n\n::figure[The cycle, as the sūtra states:cite[w]]{#rope-snake}\n\nMore.')])).toEqual([]);
  });

  it('rejects a figure written inline', () => {
    expect(validate([block('a', {}, 'Text :figure[A caption]{#rope-snake} here.')])).toEqual(['a: write ::figure[…]{#id} on its own line']);
  });

  it('rejects a figure without an id', () => {
    expect(validate([block('a', {}, '::figure[A caption]')])).toEqual(['a: ::figure needs an id, like {#rope-snake}']);
  });

  it('rejects a figure without a caption', () => {
    expect(validate([block('a', {}, '::figure[]{#rope-snake}')])).toEqual(['a: ::figure{#rope-snake} needs a caption']);
    expect(validate([block('a', {}, '::figure{#rope-snake}')])).toEqual(['a: ::figure{#rope-snake} needs a caption']);
  });

  it('rejects a figure id that is not lower-case ASCII words joined by hyphens', () => {
    expect(validate([block('a', {}, '::figure[A caption]{#Rope_Snake}')])).toEqual([
      'a: ::figure{#Rope_Snake} id must be lower-case ASCII words joined by hyphens',
    ]);
  });

  it('rejects the same figure twice on one page, which would repeat its ids', () => {
    expect(validate([block('a', {}, '::figure[One]{#rope-snake}\n\n::figure[Two]{#rope-snake}')])).toEqual([
      'a: ::figure{#rope-snake} is used twice',
    ]);
  });

  it('checks a citation inside a figure caption', () => {
    expect(validate([block('a', {}, '::figure[A caption:cite[sep]]{#rope-snake}')])).toEqual(['a: :cite[sep] has no matching source']);
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
