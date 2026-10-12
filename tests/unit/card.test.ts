import { describe, expect, it } from 'vitest';
import { cardVersion, drawable } from '../../src/lib/card';

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

  it('accepts NFD IAST after normalising it', () => {
    const nfd = 'Vedānta'.normalize('NFD');
    expect(nfd).not.toBe('Vedānta'); // precondition: really decomposed
    expect(drawable('x', nfd)).toBe('Vedānta');
  });
});
