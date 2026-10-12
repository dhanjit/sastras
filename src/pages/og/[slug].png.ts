import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadBlocks, isWritten } from '../../lib/blocks';
import { LAYERS, type Layer } from '../../lib/vocab';

// latin and latin-ext must be registered under different names, or IAST letters render as boxes.
const font = (f: string) => readFileSync(`node_modules/@fontsource/gentium-book-plus/files/gentium-book-plus-${f}.woff`);
const fonts = [
  { name: 'Gentium', data: font('latin-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'Gentium', data: font('latin-400-italic'), weight: 400 as const, style: 'italic' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-italic'), weight: 400 as const, style: 'italic' as const },
];
const C = { leaf: '#e4dcc4', ink: '#2a2620', muted: '#5f5747', rubric: '#8e3b2c', line: '#c9bd9c', rule: '#9c8f6e' };

type Props = { title: string; gloss: string; layer?: Layer };

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

export const GET: APIRoute = async ({ props }) => {
  const { title, gloss, layer } = props as Props;
  const strip = el({ display: 'flex', gap: 8, width: 360 }, LAYERS.map((l) => el({ flex: 1, height: 10, borderRadius: 4, background: l === layer ? C.rubric : C.line })));
  const card = el(
    { boxSizing: 'border-box', width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.leaf, color: C.ink, padding: '64px 80px', fontFamily: 'Gentium, GentiumExt' },
    [
      el({ display: 'flex', height: 6, borderTop: `1.5px solid ${C.rule}`, borderBottom: `1.5px solid ${C.rule}` }),
      el({ display: 'flex', flexDirection: 'column', gap: 18 }, [
        el({ fontSize: title.length > 20 ? 84 : 108, lineHeight: 1.05 }, title),
        el({ fontSize: 44, color: C.rubric, fontStyle: 'italic' }, gloss),
      ]),
      el({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [el({ fontSize: 32, color: C.muted }, 'Śāstras · sastras.dhanjit.me'), strip]),
    ],
  );
  const svg = await satori(card as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts });
  const png = new Resvg(svg).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
