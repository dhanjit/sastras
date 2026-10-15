import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { figures, findFigureProblems } from '../../src/integrations/figures';

const good = '<svg viewBox="0 0 400 200"><title>T</title><desc>D</desc><rect class="box" x="1" y="1" width="9" height="9"/></svg>';
const block = (body: string) => `---\ntitle: X\nstatus: draft\n---\n\n${body}\n`;

/** A throwaway src/ with figures and blocks. */
function site(files: Record<string, string>) {
  const src = mkdtempSync(join(tmpdir(), 'figsite-'));
  mkdirSync(join(src, 'figures'));
  mkdirSync(join(src, 'content', 'blocks'), { recursive: true });
  for (const [path, text] of Object.entries(files)) writeFileSync(join(src, path), text);
  return src;
}

const broken = () =>
  site({
    'figures/rope-snake.svg': good,
    'figures/too-wide.svg': good.replace('0 0 400 200', '0 0 900 200'),
    'figures/spare.svg': good,
    'content/blocks/maya.md': block('Text.\n\n::figure[The rope]{#rope-snake}\n\n::figure[Lost]{#no-file}'),
    'content/blocks/atman.md': block('::figure[Wide]{#too-wide .wide}\n\n```\n::figure[Only an example]{#in-code}\n```'),
  });

describe('findFigureProblems', () => {
  it('checks every figure file and every reference from a block', () => {
    const src = broken();
    expect(findFigureProblems({ figuresDir: join(src, 'figures'), blocksDir: join(src, 'content', 'blocks') })).toEqual({
      errors: ['figure too-wide: viewBox is 900 wide; keep it at most 480 (phone first)', 'maya: ::figure{#no-file} has no file src/figures/no-file.svg'],
      unused: ['spare'],
    });
  });

  it('finds nothing wrong in a clean site', () => {
    const src = site({ 'figures/rope-snake.svg': good, 'content/blocks/maya.md': block('::figure[The rope]{#rope-snake}') });
    expect(findFigureProblems({ figuresDir: join(src, 'figures'), blocksDir: join(src, 'content', 'blocks') })).toEqual({ errors: [], unused: [] });
  });
});

describe('the figures integration', () => {
  const setup = (src: string) => {
    const warnings: string[] = [];
    const hook = figures().hooks['astro:config:setup'] as (o: unknown) => void;
    const run = () => hook({ config: { srcDir: pathToFileURL(`${src}/`) }, logger: { warn: (m: string) => warnings.push(m) } });
    return { run, warnings };
  };

  it('fails the build with every problem in one error', () => {
    const { run } = setup(broken());
    expect(run).toThrow(
      'Figure errors:\n- figure too-wide: viewBox is 900 wide; keep it at most 480 (phone first)\n- maya: ::figure{#no-file} has no file src/figures/no-file.svg',
    );
  });

  it('only warns about a figure no page uses', () => {
    const { run, warnings } = setup(site({ 'figures/spare.svg': good }));
    expect(run).not.toThrow();
    expect(warnings).toEqual(['figure spare is not used on any page']);
  });
});
