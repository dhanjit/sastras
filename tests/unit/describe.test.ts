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
