import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadBlocks, isWritten } from '../../lib/blocks';
import { LAYERS, type Layer } from '../../lib/vocab';

// latin and latin-ext must be registered under different names, or IAST letters render as boxes.
const req = createRequire(import.meta.url); // resolves from the package, not from the working directory
const font = (f: string) => readFileSync(req.resolve(`@fontsource/gentium-book-plus/files/gentium-book-plus-${f}.woff`));
const fonts = [
  { name: 'Gentium', data: font('latin-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'Gentium', data: font('latin-400-italic'), weight: 400 as const, style: 'italic' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-italic'), weight: 400 as const, style: 'italic' as const },
];
const C = { leaf: '#e4dcc4', ink: '#2a2620', muted: '#5f5747', rubric: '#8e3b2c', line: '#c9bd9c', rule: '#9c8f6e' };

type Props = { title: string; gloss: string; layer?: Layer };

// The card fonts cover Latin only. Fail the build rather than draw a box (or a stray mark) on a shared card.
const UNDRAWABLE = /\p{M}|[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
function drawable(slug: string, text: string): string {
  const t = text.normalize('NFC');
  const bad = t.match(UNDRAWABLE);
  if (bad) throw new Error(`og card for "${slug}": "${bad[0]}" can't be drawn by the card fonts; use precomposed IAST`);
  return t;
}

export const getStaticPaths = (async () => {
  const { all, tree } = await loadBlocks();
  return [
    { params: { slug: 'home' }, props: { title: 'Śāstras', gloss: 'a map of Indian philosophy and the classical sciences' } },
    ...all.filter(isWritten).map((b) => ({
      params: { slug: b.id },
      props: { title: b.data.title, gloss: b.data.gloss, layer: tree.layerOf(b.id) },
    })),
  ];
}) satisfies GetStaticPaths;

const el = (style: Record<string, unknown>, children?: unknown) => ({ type: 'div', props: { style, children } });

export const GET: APIRoute = async ({ params, props }) => {
  const slug = String(params.slug);
  const { layer } = props as Props;
  const title = drawable(slug, (props as Props).title);
  const gloss = drawable(slug, (props as Props).gloss);
  const longest = Math.max(...title.split(' ').map((w) => w.length));
  const titleSize = Math.min(title.length > 20 ? 84 : 108, Math.floor(1040 / (longest * 0.56))); // the longest word must fit one line
  const strip = el({ display: 'flex', gap: 8, width: 360 }, LAYERS.map((l) => el({ flex: 1, height: 10, borderRadius: 4, background: l === layer ? C.rubric : C.line })));
  const card = el(
    { boxSizing: 'border-box', width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.leaf, color: C.ink, padding: '64px 80px', fontFamily: 'Gentium, GentiumExt' },
    [
      el({ display: 'flex', flexShrink: 0, height: 6, borderTop: `1.5px solid ${C.rule}`, borderBottom: `1.5px solid ${C.rule}` }),
      el({ display: 'flex', flexDirection: 'column', gap: 18 }, [
        el({ display: 'block', lineClamp: 2, fontSize: titleSize, lineHeight: 1.05 }, title),
        el({ display: 'block', lineClamp: 2, fontSize: 44, color: C.rubric, fontStyle: 'italic' }, gloss),
      ]),
      el({ display: 'flex', flexShrink: 0, justifyContent: 'space-between', alignItems: 'center' }, [el({ fontSize: 32, color: C.muted }, 'Śāstras · sastras.dhanjit.me'), strip]),
    ],
  );
  const svg = await satori(card as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts,
    loadAdditionalAsset: () => {
      throw new Error(`og card for "${slug}": missing glyphs`); // never draw boxes silently
    },
  });
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
