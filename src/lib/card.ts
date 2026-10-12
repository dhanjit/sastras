import { createHash } from 'node:crypto';
import type { Layer } from './vocab';

/** Bump when the link-preview card's design changes, so crawlers that cached the old image fetch the new one. */
export const CARD_REV = 1;

/** What a block's card shows, as a short version for the `?v=` on its og:image URL. */
export function cardVersion({ title, gloss, layer }: { title: string; gloss: string; layer?: Layer }): string {
  return createHash('sha1').update(`${CARD_REV}|${title}|${gloss}|${layer ?? ''}`).digest('hex').slice(0, 8);
}

// The card fonts cover Latin only. Fail the build rather than draw a box (or a stray mark) on a shared card.
const UNDRAWABLE = /\p{M}|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

/** `text` as NFC if the card fonts can draw all of it; throws, naming the slug, if not. */
export function drawable(slug: string, text: string): string {
  const t = text.normalize('NFC');
  const bad = t.match(UNDRAWABLE);
  if (bad) throw new Error(`og card for "${slug}": "${bad[0]}" can't be drawn by the card fonts; use precomposed IAST`);
  return t;
}
