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
- a figure without an id or caption;
- an id that breaks the pattern;
- the same figure twice on one page;
- a reference to a file that doesn't exist.

It warns, without failing, about a figure no page uses.

In dev, figures are read at startup: restart `npm run dev` after adding or editing an SVG. The dev server logs `figure changed: restart the dev server` as a reminder.

## What the build checks

`src/lib/figure-check.ts` checks every file in `src/figures/`. Each failure is one message, prefixed `figure <id>:`.

| Rule | Why |
|---|---|
| The file name is lower-case ASCII words joined by hyphens. | It is the figure's id. |
| The file starts with `<svg` (an XML declaration may come first). | It is inlined into the page. |
| The root has a `viewBox` of four numbers. | The page scales the figure from it. |
| The root has no `width` or `height`. | The page sizes the figure. |
| The `viewBox` is at most 480 wide. | Phone first; see Layout. |
| Exactly one non-empty `<title>` and one non-empty `<desc>`. | They are the figure's accessible name and description. |
| No `<script>`, no `on…=` event attributes, no `<foreignObject>`. | A figure is a drawing, not code. |
| No `href` or `xlink:href` with a scheme (`http:`, `data:`, …) or starting `//`. | Nothing outside the figure: no requests, no tracking. Reference your own elements (`#arrow`). |
| No SMIL animation (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`). | Only CSS animation can respect reduced motion. |
| No literal colour: no `#rgb`/`#rrggbb` (or 4/8-digit) hex, `rgb()`, `hsl()` and the like, in attributes, `style` attributes or the `<style>` element. `fill`, `stroke` and the other colour properties take only `none`, `currentColor`, `inherit`, a paint server `url(#…)` or, in CSS, a variable such as `var(--rubric)`. | Colour comes from the classes below, so the figure follows light and dark mode. |
| Every `font-size` (attribute or CSS) is in px and at least 12. | Legibility. |
| The file is at most 30 KB. | It is inlined into the page's HTML. |

The build can't check that a drawing is clear, that it matches the text, or that its labels fit. Look at it at 375 px and 1280 px, in light and dark mode.

## How it renders

`remark-figure` inlines the SVG in `<figure class="fig" id="fig-<id>">` with the caption in a `<figcaption>`. On the way it:
- **Renames ids.** It prefixes every `id`, `url(#…)` and `href="#…"` with `fig-<id>-`, so two figures never clash. Your `id="arrow"` becomes `fig-<id>-arrow`.
- **Names the drawing.** It adds `role="img"` and `aria-labelledby` pointing at the `<title>` and `<desc>`.
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
- **Scope your CSS.** An inline SVG's `<style>` applies to the whole page. Start every selector with the figure's element id, `#fig-<id>`; prefix every keyframe name with `<id>-`; and select by class, not by id (ids are renamed). For example:

```css
#fig-example-system .level { transform-box: fill-box; transform-origin: 50% 100%; animation: example-system-rise 1.4s ease-out 1 both; }
@keyframes example-system-rise { from { transform: scaleY(0.15); } }
```

How it plays:
- The page script arms each animated figure and holds it on its first frame.
- It plays the first time the figure is half on screen.
- Replay drops the animation for one style pass, so it starts over (pausing alone would not rewind a finished animation).
- The page CSS controls the play state with `!important`, so your `animation` shorthand can't make it play early.
- With no IntersectionObserver there is no animation, only the still frame.

## Writing rules

Figures follow [writing-rules.md](writing-rules.md) like any other content:
- **No new claims.** A figure shows what the page already says and cites. It may not introduce a claim of its own.
- **Cite facts in the caption.** If the caption states a fact, it carries a `:cite[id]`, like any other sentence.
- **Neutrality.** A diagram of a school's view is that school's view. Say so in the caption ("For Sāṅkhya, …").
- **Title and desc.** `<title>` names the figure in a few words. `<desc>` says what the drawing shows, in plain sentences, for readers who can't see it. Neither is visible on the page.
- **Sanskrit labels.** Labels inside the SVG are not glossed. Every Sanskrit term in a label should also appear in the caption or the prose around it, where the site glosses it.
