import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { loadGlossary, termAnchor } from '../../src/lib/glossary';
import { rehypeGloss } from '../../src/lib/rehype-gloss';
import { remarkNote } from '../../src/lib/remark-note';

const glossary = new Map([
  ['ātman', 'the self'],
  ['brahman', 'ultimate reality'],
  ['brahmasūtra', 'aphorisms on brahman'],
]);

const terms = Object.fromEntries(glossary); // a plain object, so Astro's content cache sees glossary edits

async function gloss(src: string, path?: string, t: Record<string, string> = terms) {
  const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeGloss, { terms: t }).use(rehypeStringify).process({ value: src, path });
  return String(file);
}

async function glossWithNotes(src: string) {
  const file = await unified()
    .use(remarkParse).use(remarkDirective).use(remarkNote).use(remarkRehype)
    .use(rehypeGloss, { terms }).use(rehypeStringify)
    .process(src);
  return String(file);
}

const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

describe('termAnchor', () => {
  it('strips diacritics into a stable ASCII anchor', () => {
    expect(termAnchor('Brahmasūtra')).toBe('g-brahmasuutra');
    expect(termAnchor('Navya-Nyāya')).toBe('g-navya-nyaaya');
  });

  it('keeps vowel length, so words that differ only in length stay distinct', () => {
    expect(termAnchor('kāla')).not.toBe(termAnchor('kala'));
    expect(termAnchor('bhāva')).not.toBe(termAnchor('bhava'));
    expect(termAnchor('Ṛgveda')).toBe('g-rgveda'); // other marks (dots, accents) still drop
  });
});

describe('loadGlossary', () => {
  it('lower-cases terms and rejects an empty meaning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gloss-'));
    writeFileSync(join(dir, 'ok.yaml'), 'Ātman: the self\n');
    expect(loadGlossary(join(dir, 'ok.yaml')).get('ātman')).toBe('the self');
    writeFileSync(join(dir, 'bad.yaml'), 'ātman: ""\n');
    expect(() => loadGlossary(join(dir, 'bad.yaml'))).toThrow('glossary.yaml: "ātman" has no meaning');
  });

  const load = (yaml: string) => {
    const file = join(mkdtempSync(join(tmpdir(), 'gloss-')), 'g.yaml');
    writeFileSync(file, yaml);
    return loadGlossary(file);
  };

  it('rejects a term listed twice, even in a different case or Unicode form', () => {
    expect(() => load('ātman: the self\nĀtman: also the self\n')).toThrow('"Ātman" is listed twice');
    expect(() => load('ātman: the self\n"a\u0304tman": decomposed\n')).toThrow('is listed twice');
  });

  it('rejects two terms that share an anchor', () => {
    expect(() => load('navya-nyāya: a\nnavya nyāya: b\n')).toThrow('"navya-nyāya" and "navya nyāya" share the anchor g-navya-nyaaya');
  });

  it('rejects a file that is not a mapping', () => {
    expect(() => load('- ātman\n- brahman\n')).toThrow('glossary.yaml must map terms to meanings');
  });
});

describe('rehypeGloss', () => {
  it('wraps the first occurrence of each term in a paragraph', async () => {
    expect(await gloss('For Advaita, ātman is brahman; ātman again.')).toBe(
      '<p>For Advaita, <a class="term" href="/glossary#g-aatman" data-gloss="the self" aria-describedby="gd-1">ātman</a><span id="gd-1" hidden>the self</span> is <a class="term" href="/glossary#g-brahman" data-gloss="ultimate reality" aria-describedby="gd-2">brahman</a><span id="gd-2" hidden>ultimate reality</span>; ātman again.</p>',
    );
  });

  it('prefers the longest term, keeps the original case, and respects word edges', async () => {
    expect(await gloss('The Brahmasūtra, not brahmanical.')).toBe(
      '<p>The <a class="term" href="/glossary#g-brahmasuutra" data-gloss="aphorisms on brahman" aria-describedby="gd-1">Brahmasūtra</a><span id="gd-1" hidden>aphorisms on brahman</span>, not brahmanical.</p>',
    );
  });

  it('leaves headings and links alone', async () => {
    expect(await gloss('# ātman\n\n[ātman](/atman)')).toBe('<h1>ātman</h1>\n<p><a href="/atman">ātman</a></p>');
  });

  it('glosses a term again in every paragraph, list item and table cell', async () => {
    expect(count(await gloss('- ātman\n  - ātman nested\n- brahman'), /class="term"/g)).toBe(3);
    expect(count(await gloss('> ātman\n>\n> ātman again'), /class="term"/g)).toBe(2);
  });

  it('glosses a term in a note body and again in the prose around it', async () => {
    const html = await glossWithNotes('Text :note[ātman here] and ātman outside.');
    expect(count(html, /class="term"/g)).toBe(2);
    expect(html).toMatch(/<span class="note-body"><span class="sr-only">Note: <\/span><a class="term"[^>]*>ātman<\/a>/);
    expect(html).toMatch(/and <a class="term"[^>]*>ātman<\/a><span id="gd-2" hidden>/);
  });

  it('leaves h5 and h6 alone', async () => {
    expect(await gloss('##### ātman\n\n###### brahman')).toBe('<h5>ātman</h5>\n<h6>brahman</h6>');
  });

  it('matches a decomposed (NFD) spelling', async () => {
    expect(await gloss('the a\u0304tman')).toContain('data-gloss="the self"');
  });

  it('gives description ids a per-file prefix so two pages never clash in one document', async () => {
    expect(await gloss('ātman', '/x/advaita.md')).toContain('aria-describedby="gd-advaita-1"');
    expect(await gloss('ātman', '/x/advaita.md')).toContain('<span id="gd-advaita-1" hidden>');
  });

  it('numbers description ids from 1 in every document', async () => {
    const a = await gloss('ātman');
    const b = await gloss('ātman');
    expect(a).toBe(b);
    expect(a).toContain('id="gd-1"');
  });

  it('skips a match whose case-folded form is not a glossary key', async () => {
    // "ſ" (long s) case-folds to "s" under the regex's i flag, but lower-cases to itself
    expect(await gloss('ſūtra', undefined, { sūtra: 'thread' })).toBe('<p>ſūtra</p>');
  });
});
