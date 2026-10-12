import { describe, expect, it } from 'vitest';
import remarkDirective from 'remark-directive';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkNote } from '../../src/lib/remark-note';
import { remarkCite } from '../../src/lib/remark-cite';
import { remarkRestoreDirectives } from '../../src/lib/remark-restore-directives';

// Astro's own pipeline, so smartypants, GFM and rehype-raw behave exactly as on the site.
const proc = await createMarkdownProcessor({
  remarkPlugins: [remarkDirective, remarkNote, remarkCite, remarkRestoreDirectives],
  syntaxHighlight: false,
});
async function md(src: string, frontmatter: Record<string, unknown> = {}) {
  return (await proc.render(src, { frontmatter })).code;
}

describe('remarkNote', () => {
  it('turns :note into an asterisk that toggles a margin note', async () => {
    expect(await md('Ātman is brahman:note[the witness behind thought].')).toContain(
      '<span class="note"><label class="note-mark" for="note-1" aria-hidden="true">*</label><input class="note-toggle" type="checkbox" id="note-1" aria-label="Show note 1"><span class="note-body"><span class="sr-only">Note: </span>the witness behind thought</span></span>',
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
    const html = await md('A claim:cite[iep].', { sources: [{ id: 'sep', title: 'SEP' }, { id: 'iep', title: 'IEP' }] });
    expect(html).toContain('<sup class="cite"><a href="#src-iep" aria-label="Source 2: IEP">2</a></sup>');
  });

  const ab = { sources: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] };

  it('separates adjacent cites with a comma inside the second one', async () => {
    expect(await md('A:cite[a]:cite[b].', ab)).toContain(
      '<sup class="cite"><a href="#src-a" aria-label="Source 1: A">1</a></sup><sup class="cite">,<a href="#src-b" aria-label="Source 2: B">2</a></sup>',
    );
  });

  it('gives no comma to a cite separated from the last by text', async () => {
    const html = await md('A:cite[a] and B:cite[b].', ab);
    expect(html).toContain('<sup class="cite"><a href="#src-b" aria-label="Source 2: B">2</a></sup>');
    expect(html).not.toContain('<sup class="cite">,');
  });
});

describe('ordinary colons', () => {
  it('keeps a verse reference intact', async () => {
    expect(await md('Bhagavad Gītā 2:47 says act.')).toContain('<p>Bhagavad Gītā 2:47 says act.</p>');
  });

  it('keeps words and numbers joined by a colon', async () => {
    expect(await md('Advaita:Dvaita and 1:2.')).toContain('Advaita:Dvaita and 1:2.');
  });
});
