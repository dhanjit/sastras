export const SITE = 'https://sastras.dhanjit.me';
export const REPO = 'https://github.com/dhanjit/sastras';

export function correctionUrl(id: string, title: string): string {
  const q = new URLSearchParams({
    title: `Correction: ${title}`,
    body: `Page: ${SITE}/${id}\n\nWhat is wrong:\n\nWhat it should say, with a source:\n`,
    labels: 'correction',
  });
  return `${REPO}/issues/new?${q}`;
}
