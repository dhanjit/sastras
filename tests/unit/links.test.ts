import { expect, it } from 'vitest';
import { correctionUrl } from '../../src/lib/links';

it('builds a prefilled GitHub issue link for a page', () => {
  const u = new URL(correctionUrl('advaita-vedanta', 'Advaita Vedānta'));
  expect(u.origin + u.pathname).toBe('https://github.com/dhanjit/sastras/issues/new');
  expect(u.searchParams.get('title')).toBe('Correction: Advaita Vedānta');
  expect(u.searchParams.get('body')).toContain('https://sastras.dhanjit.me/advaita-vedanta');
  expect(u.searchParams.get('template')).toBe('correction.md');
  expect(u.searchParams.get('labels')).toBeNull();
});
