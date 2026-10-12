import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { KINDS, LAYERS, PRAMANAS, SIDES, STATUSES } from './lib/vocab';

const source = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  url: z.url({ protocol: /^https?$/ }),
});

const readLink = z.strictObject({
  title: z.string().min(1),
  kind: z.enum(['translation', 'etext', 'scan']),
  url: z.url({ protocol: /^https?$/ }),
});

const blocks = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blocks' }),
  schema: z.strictObject({
    title: z.string().min(1),
    devanagari: z.string().optional(),
    gloss: z.string().min(1),
    kind: z.enum(KINDS),
    parent: z.string().min(1),
    layer: z.enum(LAYERS).optional(),
    order: z.number().int(),
    dates: z.string().optional(),
    status: z.enum(STATUSES),
    sources: z.array(source).default([]),
    read: z.array(readLink).default([]),
    related: z.array(z.string()).default([]),
    pramanas: z.array(z.enum(PRAMANAS)).optional(),
    vedic_authority: z.enum(SIDES).optional(),
  }),
});

export const collections = { blocks };
