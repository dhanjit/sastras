import { describe, expect, it } from 'vitest';
import { cardVersion, drawable, HOME_CARD } from '../../src/lib/card';

describe('cardVersion', () => {
  const base = { title: 'Advaita Vedānta', gloss: 'non-dualism', layer: 'schools' } as const;

  it('is 8 hex characters', () => {
    expect(cardVersion(base)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is stable for the same input', () => {
    expect(cardVersion({ ...base })).toBe(cardVersion(base));
  });

  it('changes when the title, the gloss or the layer changes', () => {
    const v = cardVersion(base);
    expect(cardVersion({ ...base, title: 'Advaita' })).not.toBe(v);
    expect(cardVersion({ ...base, gloss: 'not two' })).not.toBe(v);
    expect(cardVersion({ ...base, layer: 'corpus' })).not.toBe(v);
  });

  it('does not let a field blur into its neighbour', () => {
    expect(cardVersion({ title: 'a|b', gloss: 'c' })).not.toBe(cardVersion({ title: 'a', gloss: 'b|c' }));
    expect(cardVersion({ title: 'a', gloss: 'b', layer: 'schools' })).not.toBe(cardVersion({ title: 'a', gloss: 'b|schools' }));
  });

  it('versions the home card, which has no layer', () => {
    expect(cardVersion(HOME_CARD)).toMatch(/^[0-9a-f]{8}$/);
    expect(cardVersion(HOME_CARD)).not.toBe(cardVersion({ ...HOME_CARD, gloss: 'something else' }));
  });

  it('treats a missing layer as an empty one', () => {
    const { layer: _layer, ...noLayer } = base;
    expect(cardVersion(noLayer)).toBe(cardVersion({ ...noLayer, layer: undefined }));
    expect(cardVersion(noLayer)).not.toBe(cardVersion(base));
  });
});

describe('drawable', () => {
  it('returns Latin text unchanged', () => {
    expect(drawable('x', 'Advaita Vedānta · “not two”')).toBe('Advaita Vedānta · “not two”');
  });

  it('rejects Devanagari', () => {
    expect(() => drawable('advaita', 'अ')).toThrow(/advaita/);
    expect(() => drawable('advaita', 'Advaita अद्वैत')).toThrow(/can't be drawn/);
  });

  it('rejects a combining mark that has no precomposed form (r + U+0325)', () => {
    expect(() => drawable('x', 'r̥')).toThrow(/can't be drawn/);
  });

  it('accepts the whole IAST alphabet, lower and upper case', () => {
    const iast = 'ā ī ū ṛ ṝ ḷ ḹ ṃ ṁ ḥ ñ ṅ ṇ ṭ ḍ ś ṣ';
    for (const text of [iast, iast.toUpperCase()]) {
      expect(text.normalize('NFC')).toBe(text); // precondition: precomposed
      expect(drawable('x', text)).toBe(text);
    }
  });

  it('composes NFD ṝ (r + U+0323 + U+0304) and accepts it', () => {
    const nfd = 'r\u0323\u0304';
    expect(drawable('x', nfd)).toBe('\u1E5D'); // ṝ
    expect(nfd).not.toBe('\u1E5D'); // precondition: really decomposed
  });

  it('rejects ISO 15919 r̥̄ (r + U+0325 + U+0304), which has no precomposed form', () => {
    expect(() => drawable('x', 'r\u0325\u0304')).toThrow(/can't be drawn/);
  });

  it('accepts NFD IAST after normalising it', () => {
    const nfd = 'Vedānta'.normalize('NFD');
    expect(nfd).not.toBe('Vedānta'); // precondition: really decomposed
    expect(drawable('x', nfd)).toBe('Vedānta');
  });
});
