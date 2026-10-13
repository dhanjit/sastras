import { expect, it } from 'vitest';
import { describe as describePage } from '../../src/lib/describe';

it('opens with the gloss, capitalised, then the start of the body', () => {
  expect(describePage('non-dualism · “not two”', 'For Advaita, the self and brahman are one.')).toBe(
    'Non-dualism · “not two”. For Advaita, the self and brahman are one.',
  );
});

it('drops notes with their content, and cites', () => {
  const out = describePage('the self', 'The self is one:cite[wiki].:note[“Self” here means the witness, not the personality.] It is not the body.');
  expect(out).toBe('The self. The self is one. It is not the body.');
  expect(out).not.toMatch(/:note|:cite|witness|wiki/);
});

it('drops a note that contains a link or brackets', () => {
  expect(describePage('x', 'Before.:note[see [the gloss](/glossary) [sic]] After.')).toBe('X. Before. After.');
});

it('turns link syntax into its text', () => {
  expect(describePage('logic', 'See [Nyāya](/nyaya) and [the Vedas](https://example.org/v?a=1) here.')).toBe('Logic. See Nyāya and the Vedas here.');
});

it('strips other Markdown and collapses whitespace', () => {
  const body = '## Heading\n\nSome **bold** and _italic_ and `code`\ntext\n\n- a list item';
  expect(describePage('perception', body)).toBe('Perception. Heading Some bold and italic and code text a list item');
});

it('returns a short body whole, with no ellipsis', () => {
  const out = describePage('grammar', 'Short body.');
  expect(out).toBe('Grammar. Short body.');
  expect(out).not.toContain('…');
});

it('cuts a long body at a word boundary and adds an ellipsis', () => {
  const body = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda '.repeat(8);
  const out = describePage('dualism', body);
  expect(out.length).toBeLessThanOrEqual(155);
  expect(out.endsWith('…')).toBe(true);
  expect(out.startsWith('Dualism. alpha beta')).toBe(true);
  const kept = out.slice('Dualism. '.length, -1);
  expect(body.replace(/\s+/g, ' ')).toContain(kept); // a prefix of the body
  expect(kept).toMatch(/(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda)$/); // ends on a whole word
});

it('honours a custom max', () => {
  const out = describePage('a', 'one two three four five six seven eight', 20);
  expect(out.length).toBeLessThanOrEqual(20);
  expect(out.endsWith('…')).toBe(true);
});

it('returns just the gloss when the body has no plain text', () => {
  expect(describePage('grammar', ':note[only a note]:cite[x]')).toBe('Grammar.');
});

// Parsed with the same parser as the page, so these are the cases a regex chain gets wrong.
it('keeps link text when the URL has parentheses', () => {
  expect(describePage('illusion', 'See [Māyā](https://en.wikipedia.org/wiki/Maya_(religion)) for more.')).toBe('Illusion. See Māyā for more.');
});

it('decodes HTML entities', () => {
  expect(describePage('x', 'Śaṅkara &amp; Rāmānuja &lt;met&gt;')).toBe('X. Śaṅkara & Rāmānuja <met>');
});

it('drops the URL of a reference link', () => {
  const out = describePage('logic', 'See [Nyāya][n] now.\n\n[n]: https://example.org/nyaya "Nyāya"');
  expect(out).toBe('Logic. See Nyāya now.');
});

it('drops footnote references and definitions', () => {
  const out = describePage('x', 'A claim.[^1] More text.\n\n[^1]: The footnote text.');
  expect(out).toBe('X. A claim. More text.');
});

it('drops raw HTML tags, code blocks and images, but keeps the text inside inline tags', () => {
  expect(describePage('x', 'Pic ![diagram](d.png) <b>bold</b> end.\n\n```\nlet code = 1;\n```\n\nTail.')).toBe('X. Pic bold end. Tail.');
});

it('keeps stray colons: "2:47" is text, not a directive', () => {
  expect(describePage('x', 'Gītā 2:47 and Advaita:Dvaita are plain.')).toBe('X. Gītā 2:47 and Advaita:Dvaita are plain.');
});

// A cut that lands on the end of a sentence keeps its full stop and adds no ellipsis (never ".…").
// A cut that lands mid-sentence loses any trailing comma, semicolon, colon, dot or dash and gets the ellipsis.
it('adds no ellipsis after a sentence end, and never produces ".…"', () => {
  expect(describePage('x', 'one two end. three four five', 17)).toBe('X. one two end.');
  expect(describePage('x', 'one two end? three four five', 17)).toBe('X. one two end?');
});

it('strips trailing punctuation before the ellipsis when the cut is mid-sentence', () => {
  expect(describePage('x', 'one two end, three four five', 17)).toBe('X. one two end…');
  expect(describePage('x', 'one two end — three four five', 18)).toBe('X. one two end…');
  expect(describePage('x', 'one two end · three four five', 18)).toBe('X. one two end…');
  for (const max of [10, 15, 17, 20, 25]) expect(describePage('x', 'one two end, three. four five; six', max)).not.toMatch(/[.,;:·—]…/);
});

it('never leaves half of a surrogate pair before the ellipsis', () => {
  expect(describePage('𝒜𝒜𝒜𝒜𝒜𝒜', '', 6)).toBe('𝒜𝒜…');
});

// An abbreviation's full stop belongs to the word, not to the sentence. A cut right after one is mid-sentence:
// the stop stays and the ellipsis follows it directly ("c.…"), so the result never ends in a bare "c.".
it('treats a cut after "c." as mid-sentence: keeps the stop, adds the ellipsis', () => {
  const out = describePage('x', 'Śaṅkara lived c. 788 CE and wrote much', 20); // "X. Śaṅkara lived c." is 19 chars
  expect(out).toBe('X. Śaṅkara lived c.…');
  expect(out.length).toBeLessThanOrEqual(20);
  expect(out).not.toMatch(/c\.$/);
});

it.each(['c.', 'C.', 'ca.', 'cf.', 'fl.', 'd.', 'b.', 'r.', 'vol.', 'ed.', 'e.g.'])('treats a cut after "%s" as mid-sentence', (abbr) => {
  const out = describePage('x', `He wrote it ${abbr} 788 and more`, `X. He wrote it ${abbr}`.length + 1);
  expect(out).toBe(`X. He wrote it ${abbr}…`);
});

it('treats a cut after an abbreviation inside brackets as mid-sentence', () => {
  expect(describePage('x', 'Lived (fl. 5th c.) in the north', 'X. Lived (fl. 5th c.)'.length + 1)).toBe('X. Lived (fl. 5th c.)…');
  expect(describePage('x', 'Lived (c. 788) in the north', 'X. Lived (c.'.length + 1)).toBe('X. Lived (c.…');
});

it('still ends a cut on a real word-final stop as a sentence', () => {
  expect(describePage('x', 'He wrote the book. Then more', 'X. He wrote the book.'.length + 1)).toBe('X. He wrote the book.'); // "book." is not an abbreviation
  expect(describePage('x', 'He wrote it in 788. Then more', 'X. He wrote it in 788.'.length + 1)).toBe('X. He wrote it in 788.');
  expect(describePage('x', 'See verse 2 of it. Then more', 'X. See verse 2 of it.'.length + 1)).toBe('X. See verse 2 of it.'); // two letters, not on the list
  expect(describePage('x', 'It was built in the 8th c. CE. Then more', 'X. It was built in the 8th c. CE.'.length + 1)).toBe('X. It was built in the 8th c. CE.'); // "CE." is not an abbreviation; the era marker ends the sentence
});

it.each(['lit.', 'Skt.', 'pp.', 'vv.', 'ch.', 'viz.', 'vs.', 'eds.', 'tr.', 'trans.', 'esp.', 'i.e.'])('treats a cut after "%s" as mid-sentence', (abbr) => {
  expect(describePage('x', `He wrote it ${abbr} 788 and more`, `X. He wrote it ${abbr}`.length + 1)).toBe(`X. He wrote it ${abbr}…`);
});

// A comma, semicolon, colon or dash after the abbreviation is dropped, but the abbreviation's own stop stays.
it.each([',', ';', ':', ' —', ' ·'])('keeps the stop of an abbreviation followed by "%s"', (after) => {
  expect(describePage('x', `He wrote it, e.g.${after} the book and more`, `X. He wrote it, e.g.${after}`.length + 1)).toBe('X. He wrote it, e.g.…');
  expect(describePage('x', `Lived c.${after} 788 and more`, `X. Lived c.${after}`.length + 1)).toBe('X. Lived c.…');
});

it('still strips the comma and the stop of an ordinary word before the ellipsis', () => {
  expect(describePage('x', 'He wrote the book., then more', 'X. He wrote the book.,'.length + 1)).toBe('X. He wrote the book…');
});

it('recognises a one-letter abbreviation written with a combining mark (NFD ṛ.)', () => {
  const nfd = 'r\u0323.';
  expect(nfd.normalize('NFC')).not.toBe(nfd); // precondition: really decomposed
  expect(describePage('x', `Root ${nfd} and more`, `X. Root ${nfd}`.length + 1)).toBe(`X. Root ${nfd}…`);
  expect(describePage('x', 'The syllable Veda\u0304nta. Then more', 'X. The syllable Veda\u0304nta.'.length + 1)).toBe('X. The syllable Veda\u0304nta.'); // a word ending in a decomposed ā is not a one-letter word
});
