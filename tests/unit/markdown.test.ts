import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkNote } from '../../src/lib/remark-note';
import { remarkCite } from '../../src/lib/remark-cite';

async function md(src: string, frontmatter: Record<string, unknown> = {}) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkNote)
    .use(remarkCite)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process({ value: src, data: { astro: { frontmatter } } });
  return String(file);
}

describe('remarkNote', () => {
  it('turns :note into an asterisk that toggles a margin note', async () => {
    expect(await md('Ātman is brahman:note[the witness behind thought].')).toContain(
      '<span class="note"><label for="note-1" class="note-mark">*</label><input type="checkbox" id="note-1" class="note-toggle" aria-label="Show note"><span class="note-body">the witness behind thought</span></span>',
    );
  });

  it('numbers notes within a document', async () => {
    const html = await md('a:note[x] b:note[y]');
    expect(html).toContain('id="note-1"');
    expect(html).toContain('id="note-2"');
  });
});

describe('remarkCite', () => {
  it('links to the source by its position in the frontmatter list', async () => {
    const html = await md('A claim:cite[iep].', { sources: [{ id: 'sep' }, { id: 'iep' }] });
    expect(html).toContain('<sup class="cite"><a href="#src-iep" aria-label="Source 2">2</a></sup>');
  });
});
