export const LAYERS = ['foundation', 'pramana', 'schools', 'corpus', 'vada'] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABEL: Record<Layer, { title: string; gloss: string }> = {
  foundation: { title: 'Ādhāra', gloss: 'the foundation: language, grammar and logic' },
  pramana: { title: 'Pramāṇa', gloss: 'the ways of knowing' },
  schools: { title: 'Darśana', gloss: 'the schools of philosophy, and the sciences' },
  corpus: { title: 'Śruti and Śāstra', gloss: 'the Veda and the applied sciences' },
  vada: { title: 'Vāda', gloss: 'the debates between the schools' },
};

export const PRAMANAS = ['pratyaksa', 'anumana', 'sabda', 'upamana', 'arthapatti', 'anupalabdhi'] as const;
export type Pramana = (typeof PRAMANAS)[number];

export const PRAMANA_LABEL: Record<Pramana, { title: string; gloss: string }> = {
  pratyaksa: { title: 'Pratyakṣa', gloss: 'perception' },
  anumana: { title: 'Anumāna', gloss: 'inference' },
  sabda: { title: 'Śabda', gloss: 'testimony' },
  upamana: { title: 'Upamāna', gloss: 'comparison' },
  arthapatti: { title: 'Arthāpatti', gloss: 'postulation' },
  anupalabdhi: { title: 'Anupalabdhi', gloss: 'non-perception' },
};

export const SIDES = ['rejects', 'accepts', 'n/a'] as const;
export type Side = (typeof SIDES)[number];

export const SIDE_LABEL: Record<Side, { title: string; gloss: string }> = {
  rejects: { title: 'nāstika', gloss: 'reject the Veda’s authority' },
  accepts: { title: 'āstika', gloss: 'accept the Veda’s authority' },
  'n/a': { title: 'śāstra', gloss: 'sciences, not schools of philosophy' },
};

export const KINDS = ['topic', 'school', 'subschool', 'person', 'text', 'concept'] as const;
export type Kind = (typeof KINDS)[number];

export const STATUSES = ['stub', 'draft', 'reviewed'] as const;
export type Status = (typeof STATUSES)[number];
