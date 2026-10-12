import { createHash } from 'node:crypto';
import type { Layer } from './vocab';

/** Bump when the link-preview card's design changes, so crawlers that cached the old image fetch the new one. */
export const CARD_REV = 1;

/** What the home card shows. */
export const HOME_CARD = { title: 'Śāstras', gloss: 'a map of Indian philosophy and the classical sciences' } as const;

/** What a card shows, as a short version for the `?v=` on its og:image URL. */
export function cardVersion({ title, gloss, layer }: { title: string; gloss: string; layer?: Layer }): string {
  return createHash('sha1').update(JSON.stringify([CARD_REV, title, gloss, layer ?? ''])).digest('hex').slice(0, 8);
}

const UNDRAWABLE = /\p{M}|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/**
 * `text` as NFC, or a thrown error naming the slug. Rejects what the card fonts can never draw: a combining mark
 * left after NFC (so ISO 15919 "r̥̄" fails and precomposed IAST passes) and any non-Latin script (Devanagari).
 * Any other glyph the Latin subsets lack is caught by satori's `loadAdditionalAsset`, which throws. Either way
 * the build fails rather than putting a box or a stray mark on a shared card.
 */
export function drawable(slug: string, text: string): string {
  const t = text.normalize('NFC');
  const bad = t.match(UNDRAWABLE);
  if (bad) throw new Error(`og card for "${slug}": "${bad[0]}" can't be drawn by the card fonts; use precomposed IAST`);
  return t;
}
