# Figure guide

A block page can show hand-drawn SVG diagrams. The build checks each one for accessibility, theming and phone-first sizing; this guide covers what it checks and what it can't.

`src/figures/example-system.svg` is a worked example: a stock with an inflow, an outflow, two valves and a reinforcing loop, with a short animation. Start from it.

## Syntax

Put the figure in the block body, on its own line:

```
::figure[Caption text, may contain :cite[id] and glossary terms]{#figure-id}
```

- **The drawing** is `src/figures/<figure-id>.svg`.
- **The id** follows the block-id pattern: lower-case ASCII words joined by hyphens.
- **The caption** is required. It is ordinary Markdown: citations and glossary terms work as they do in prose.
- A page can show many figures, but each only once.

The build fails on:
- a figure written inline;
- a figure inside a list, quote or table (it must be a top-level paragraph);
- a figure without an id or caption;
- an id that breaks the pattern;
- the same figure twice on one page;
- a reference to a file that doesn't exist.

It warns, without failing, about a figure no page uses.

In dev, figures are read at startup: restart `npm run dev` after adding or editing an SVG. The dev server logs `figure changed: restart the dev server` as a reminder.

## What the build checks

`src/lib/figure-svg.ts` checks every file in `src/figures/`. Each failure is one message, prefixed `figure <id>:`.

It parses the file once, the way the page will (an HTML parser, so `<!-->`, `<rect/onclick=…>` and `&#106;avascript:` mean what they mean in a browser), then checks that tree. Comments are dropped.

**The file and the root**
- The file name is lower-case ASCII words joined by hyphens. It is the figure's id.
- The file starts with `<svg` (an XML declaration may come first) and is a single `<svg>` element with nothing after it.
- The root has a `viewBox` of four numbers, at most 480 wide (phone first; see Layout), and no `width` or `height`, since the page sizes the figure.
- There is exactly one non-empty `<title>` and one non-empty `<desc>`. They are the figure's accessible name.
- The file is at most 30 KB, because it is inlined into the page's HTML.

**Elements and attributes** (allowlists: anything not listed is refused)
- **Elements:** `svg`, `g`, `defs`, `title`, `desc`, `style`, `marker`, `symbol`, `use`, `path`, `line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`, `text`, `tspan`, `clipPath`. So no `script`, `foreignObject`, `image`, `a`, gradients or SMIL (`animate`, `set`, …): CSS is the only animation that can respect reduced motion.
- **Attributes:**
  - geometry (`x`, `y`, `d`, `points`, `r`, `width`, …);
  - presentation (`fill`, `stroke`, `stroke-width`, `stroke-dasharray`, `opacity`, `marker-start`/`-mid`/`-end`, `clip-path`, `text-anchor`, `font-size`, `font-weight`, …);
  - marker settings (`refX`, `markerWidth`, `orient`, …);
  - `id`, `class`, `transform`, `aria-hidden`, `href`/`xlink:href`, and the root's `viewBox`, `xmlns` and `preserveAspectRatio`.
  - No event handlers.
- **No `style` attribute.** Style with the classes below. Figure-specific CSS goes in the `<style>` element.
- **No stray text.** Text goes inside `<text>`.

**References and ids**
- Every `href`/`xlink:href` starts with `#`, and every `url(…)`, in an attribute or in `<style>`, is `url(#…)`. Nothing leaves the figure: no requests, no tracking.
- Every reference names an element the figure has.
- Ids are unique within the figure. `title` and `desc` are reserved (the build gives those ids to the `<title>` and `<desc>`).

**Colour**
- No literal colour in any attribute or `<style>` declaration: no hex, no named colour (`red`), no system colour (`Canvas`, `CanvasText`, …), no colour function (`rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `color`, `color-mix`, `light-dark`).
- Quoted strings, and the words in `font`, `font-family`, `animation` and `animation-name`, are names, not colours: `font-family: "Gold Serif"` is fine. Hex and colour functions are refused there too.
- `none`, `currentColor`, `transparent`, `inherit`, `context-fill`, `context-stroke`, `url(#…)` and, in `<style>`, `var(--…)` are fine.
- Colour comes from the classes below, so the figure follows light and dark mode.

**Font size**
- Every font size, as a `font-size` attribute or a `font-size` declaration, is in px and at least 12.
- A `font` shorthand must carry a plain size such as `14px`, at least 12. So no `calc()`, no `em`, no `1e1px`, and no system font (`font: caption`).

**The `<style>` element**

It applies to the whole page, so everything in it must stay inside the figure:
- **Characters.** No `<`, even as `&lt;`: the page reads an SVG's `<style>` as markup. No `\`: CSS escapes (`\75 rl(…)`) hide what a value says.
- **Selectors.** Every selector starts with `#fig-<id>`.
  - It may go on with `.`, `[` or `:` (for example `#fig-<id>.on` or `#fig-<id>:hover`).
  - The first combinator after that is a space or `>`. A sibling combinator there (`~`, `+`) would reach the page after the figure; further in (`#fig-<id> .a ~ .b`) it stays inside.
  - So `#fig-rope` can't reach a figure called `rope-head`.
  - There are no other `#` selectors: target the figure's parts by class.
- **No nesting.** No nested rules: `&` can climb out of the figure.
- **Keyframes.** Every `@keyframes` name starts with `<id>--`. The `--` is there for the reason it is in ids: figure `a` can't take `a-b-spin`, which might be figure `a-b`'s.
- **Other at-rules.** None, except `@media (prefers-reduced-motion: …)`. Never `@import`.
- **Properties.** Only paint, stroke, markers, text and animation:
  - `fill*`, `stroke*`, `opacity`, `paint-order`, `vector-effect`, `clip-path`;
  - `marker*`;
  - `font*`, `letter-spacing`, `text-anchor`, `dominant-baseline`;
  - `animation*`, `transform`, `transform-origin`, `transform-box`;
  - `display`, `visibility`.
  - No layout (`position`, `z-index`, sizes), no `content`, no custom properties.
- **Images.** No `image-set()` and the like.
- **Parsing.** The CSS must parse. The page gets it re-written from what was checked, without comments.

The build can't check that a drawing is clear, that it matches the text, or that its labels fit. Look at it at 375 px and 1280 px, in light and dark mode: the figure test page (Animation, below) is the quickest way.

## How it renders

`remark-figure` inlines the drawing in `<figure class="fig" id="fig-<id>">` with the caption in a `<figcaption>`. It hands the checked tree to the page directly, never as an HTML string, and never inlines a figure that fails its checks. On the way it:
- **Renames ids.** Every inner id becomes `fig-<id>--<inner>`, and every `url(#…)` and `href="#…"` follows. Your `id="arrow"` becomes `fig-<id>--arrow`. Ids can't contain `--`, so an inner id never meets another figure's.
- **Names the drawing.** It gives the `<title>` and `<desc>` the ids `fig-<id>--title` and `fig-<id>--desc`, and adds `role="img"` and `aria-labelledby` pointing at both.
- **Marks animation.** A figure with any `anim` element gets `data-animated` and a Replay button in the caption.

## The class vocabulary

Every figure draws with these classes (in `src/styles/manuscript.css`), so all diagrams share one look and change theme together. Don't colour anything any other way.

**Text.** Every `<text>` is serif, 15 px, in the ink colour.

| Class | Use |
|---|---|
| `sans` | Labels that name parts of the diagram (inflow, outflow) rather than the things in it. |
| `small` | 13 px, for secondary labels only (see Layout). |
| `muted` | Secondary text. |
| `rubric` | Red text, for loop markers and emphasis. |

**Shapes.**

| Class | Meaning |
|---|---|
| `box` | A plain outlined box: a thing, a stage, a category. |
| `stock` | What accumulates: a filled box. |
| `hi` | The thing being explained: filled, with a red outline. Use one per figure. |
| `line` | A thin connector or relation. |
| `flow` | Input or output: a thick ink line, usually with an arrowhead. |
| `loop` | A feedback loop: a red line. |
| `valve` | What throttles or cuts a flow: a bow-tie, filled with the page colour and outlined in red. |
| `dash` | Add to any line to dash it: a weaker, possible or disputed link. |
| `ink-fill`, `rubric-fill`, `line-fill` | Solid fills, for arrowheads and areas. |

Arrowheads are `<marker>`s whose path carries `ink-fill` (for `flow`) or `rubric-fill` (for `loop`). Give the line a `marker-end="url(#head)"`.

## Layout: phone first

On a 375 px phone the prose column is 343 px wide, and the figure scales to fit. On desktop it grows to 480 px at most.

The rendered size of a text is its font size × 343 ÷ the viewBox width. Keep it at least 13:

| viewBox width | 15 px text | 13 px (`small`) |
|---|---|---|
| 343 | 15 | 13 |
| 360 | 14.3 | 12.4 |
| 395 | 13 | 11.3 |
| 420 | 12.3 | 10.6 |

- **Width:** make the viewBox 360 wide; 395 is the most that keeps ordinary text at 13. The build allows up to 480, but that is for figures with no text at all.
- **`small`:** on a phone it renders below 13 in any viewBox wider than 343. Use it only for secondary labels such as units.
- **Shape:** prefer vertical layouts. A phone is tall and narrow; a chain of more than three boxes side by side won't fit.
- **No overflow:** keep everything, including stroke widths and arrowheads, inside the viewBox. The page lets the SVG overflow so strokes aren't clipped, which means stray content can push the page sideways, and the e2e check for sideways scroll fails.
- **No dead space:** crop the viewBox to the drawing. `min-x`/`min-y` need not be 0.

## Systems diagrams

Follow the usual stock-and-flow conventions, so a reader who knows them reads the figure at once:
- **Stocks** are boxes (`stock`): what accumulates.
- **Flows** are thick arrows (`flow`) into and out of stocks.
- **Valves** are bow-ties (`valve`) on a flow: what governs its rate.
- **Loops** are curved red arrows (`loop`), labelled R (reinforcing) or B (balancing) in a small circle (`hi` circle, `sans rubric` letter).
- **Sources and sinks** outside the system are open arrow ends or a small cloud.

## Animation

Animate only when movement explains something a still can't: a stock filling, a loop closing. Many figures shouldn't move at all.

- **What moves.** Put the class `anim` on each animated element.
- **How.** Write the animation as CSS `@keyframes` in the SVG's own `<style>`. Never use SMIL.
- **Length.** Use a finite iteration count (`1`) and keep the whole thing under about two seconds.
- **The still frame.** The element's own styles are the final, meaningful still frame. The keyframes only say where it starts (`from { … }`), and `both` fill mode holds the first frame during any delay. Readers without JavaScript, readers who ask for reduced motion, and print all see that still frame.
- **Scope your CSS.** The build enforces the `<style>` rules above. For example:

```css
#fig-example-system .level { transform-box: fill-box; transform-origin: 50% 100%; animation: example-system--rise 1.4s ease-out 1 both; }
@keyframes example-system--rise { from { transform: scaleY(0.15); } }
```

How it plays:
- **Before first paint.** One classic script in `<head>` (in `Base.astro`) arms the page (`html.figs-armed`) when the browser has IntersectionObserver. Animated figures then hold their first frame and show Replay from the first paint, so nothing jumps.
- **On screen.** The same script plays a figure when it first reaches the upper three quarters of the window, however tall it is. If the observer won't start, the script disarms the page.
- **Replay.** Replay drops the animation for one style pass, so it starts over (pausing alone would not rewind a finished animation).
- **No early play.** The page CSS controls the play state with `!important`, so your `animation` shorthand can't make it play early.
- **The still frame.** Without JavaScript or IntersectionObserver, with reduced motion and in print there is no animation and no Replay, only the still frame.

**Test page.** `src/pages/figure-test/[id].astro` draws each figure through the same code as a block page, below a spacer, at `/figure-test/<id>`.
- It is built only when `E2E_FIGURES=1`, which `npm run e2e` sets.
- `tests/e2e/figures.spec.ts` tests play, Replay, reduced motion, print and no-JS on `/figure-test/example-system`.
- `quality.spec.ts` runs axe and the sideways-scroll check on every figure's test page.
- A production build that contains `dist/figure-test/` fails.
- To look at a new figure, run `E2E_FIGURES=1 npm run build && npm run preview` and open `/figure-test/<id>`.

## Writing rules

Figures follow [writing-rules.md](writing-rules.md) like any other content:
- **No new claims.** A figure shows what the page already says and cites. It may not introduce a claim of its own.
- **Cite facts in the caption.** If the caption states a fact, it carries a `:cite[id]`, like any other sentence.
- **Neutrality.** A diagram of a school's view is that school's view. Say so in the caption ("For Sāṅkhya, …").
- **Title and desc.** `<title>` names the figure in a few words. `<desc>` says what the drawing shows, in plain sentences, for readers who can't see it. Neither is visible on the page.
- **Sanskrit labels.** Labels inside the SVG are not glossed. Every Sanskrit term in a label should also appear in the caption or the prose around it, where the site glosses it.
