import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { loadGlossary, termAnchor } from '../../src/lib/glossary';
import { rehypeGloss } from '../../src/lib/rehype-gloss';

const glossary = new Map([
  ['ātman', 'the self'],
  ['brahman', 'ultimate reality'],
  ['brahmasūtra', 'aphorisms on brahman'],
]);

async function gloss(src: string) {
  const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeGloss, { glossary }).use(rehypeStringify).process(src);
  return String(file);
}

describe('termAnchor', () => {
  it('strips diacritics into a stable ASCII anchor', () => {
    expect(termAnchor('Brahmasūtra')).toBe('g-brahmasutra');
    expect(termAnchor('Navya-Nyāya')).toBe('g-navya-nyaya');
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
});

describe('rehypeGloss', () => {
  it('wraps the first occurrence of each term in a paragraph', async () => {
    expect(await gloss('For Advaita, ātman is brahman; ātman again.')).toBe(
      '<p>For Advaita, <a class="term" href="/glossary#g-atman" data-gloss="the self" aria-describedby="gd-1">ātman</a><span id="gd-1" hidden>the self</span> is <a class="term" href="/glossary#g-brahman" data-gloss="ultimate reality" aria-describedby="gd-2">brahman</a><span id="gd-2" hidden>ultimate reality</span>; ātman again.</p>',
    );
  });

  it('prefers the longest term, keeps the original case, and respects word edges', async () => {
    expect(await gloss('The Brahmasūtra, not brahmanical.')).toBe(
      '<p>The <a class="term" href="/glossary#g-brahmasutra" data-gloss="aphorisms on brahman" aria-describedby="gd-1">Brahmasūtra</a><span id="gd-1" hidden>aphorisms on brahman</span>, not brahmanical.</p>',
    );
  });

  it('leaves headings and links alone', async () => {
    expect(await gloss('# ātman\n\n[ātman](/atman)')).toBe('<h1>ātman</h1>\n<p><a href="/atman">ātman</a></p>');
  });
});
