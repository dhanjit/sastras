# Writing rules

Every content change follows this file: a new page, an edit, a fact fix, a glossary entry. It applies to everything in `src/content/` and `src/data/`.

The build checks structure (see the Content section of `CLAUDE.md`). It cannot check whether a source supports a sentence, whether a sentence is too close to its source, or whether a school is described fairly. Those rules are yours to keep.

## Gather sources first

- Fetch every candidate URL and read the relevant part. Keep a source only if the page exists and supports what you will say.
- Aim for at least two sources per block: one encyclopedia (SEP, IEP, Britannica) and Wikipedia.
- If a candidate URL 404s, search the same site for the right entry. Don't guess URLs.
- Prefer SEP or IEP over a Wikipedia article that carries cleanup tags ("No footnotes", "Tone", machine-translated prose). Sceptical readers click through.
- When you fetch sources, never put the user's name or email in an HTTP request header (User-Agent or similar). Use a neutral one such as `sastras-research/1.0`.

## Set up the block

Work from the stub file and keep its `title`, `devanagari`, `gloss`, `kind`, `parent`, `layer`, `order` and school fields. Then:

- set `status: draft`. Only the owner sets `reviewed`;
- add `dates` where the page needs them;
- add `sources`, with short lower-case ids: `sep`, `iep`, `wiki`, `brit`. A second source from the same site gets a suffix (`wiki-gaudapada`);
- add `read` for text blocks;
- add `related` where it helps the reader.

## Write the body

Write 150–350 words of running text (notes don't count): English sentences that keep the Sanskrit terms. Go longer only when contested history needs the room.

- **Describe each school in its own terms.** "For Advaita, …". Never write a school's claim as plain fact.
- **Every factual sentence or clause carries a `:cite[id]`.** No exceptions for "obvious" claims. Each cite must point to a source you read that says it.
- **Notes.** Add at least one `:note[...]` wherever a term needs more than a gloss gives.
  - Put each note at the end of its sentence, after the full stop and any `:cite`: `…are one:cite[wiki].:note[…]`. On a phone an opened note becomes a block, so a mid-sentence note strands the rest of the sentence below it.
  - Never put a note inside a table or a footnote.
  - Inside notes, type curly quotes (“ ” ‘ ’) directly. Straight quotes after punctuation get turned the wrong way.
- **Links.** Link other blocks with `[text](/slug)`, always starting with `/`, and only to blocks that are written. The build rejects relative links, links to stubs and links to missing pages, in any link form.
- **Contested points.** Say when dates, authorship or interpretation are contested, and cite both views. When a source itself flags a dispute (Cardona on Saussure, Cārvāka and conditional inference), show it and give the minority view its weight. Don't write "some scholars" when it is several leading specialists.
- **Directives.** Only `:note[…]`, `:cite[…]` and `::figure[…]{#id}` are directives. Anything else written like `:word[…]` fails the build as a typo. Figures follow [figure-guide.md](figure-guide.md). Colons in ordinary text, such as the verse reference `2:47`, are fine.
- **Quotation.** Write in your own words. Quote at most a short phrase, in quotation marks, with its source.
- **Framing.** No "ancient India discovered X" claims and no dismissive framing.

## Glossary

Any Sanskrit term a page uses without an in-line English meaning must exist in `src/data/glossary.yaml`. Add it with a lower-case IAST key and a meaning in under ten words. The site glosses listed terms by itself; don't mark them up in the page. Restart `npm run dev` after editing the glossary.

## How to write without copying

This method is mandatory. Fact-checks have found close paraphrase on pages written from the rules alone.

1. Read each source, then write short notes in your own words: facts only, not sentences.
2. Close the sources. Write each paragraph from your notes alone, in an order you choose.
3. Only then reopen a source to check facts and add the `:cite`. If a sentence turns out to match the source's structure, rewrite it from the notes.
4. Name the scholar a source attributes a view to ("Olivelle dates…", "Doniger suggests…"), not "Britannica says". When two of a source's dates come from the same scholar, say so.
5. Don't state a count or date flatly when your own linked edition or a cited source shows another (555 vs 545 sūtras). Give the usual figure and the variation.
6. Don't generalise from a source ("older texts say X, younger say Y") if any text you cite on the same page contradicts it.

## Check yourself before you commit

These are the faults fact-checks have found. Look for each in your own draft.

- **Paraphrasing sentence by sentence.** Swapping synonyms into a source's sentence while keeping its structure and order is copying. Write from your understanding: different structure, different order.
- **Overstating the source.** "One of the three famous grammarians" must not become "rests on its three grammarians". "Shared by the learned" must not become "understood across the subcontinent". "Principal candidates" must not become "almost universally accepted", least of all when your own page then contradicts it.
- **Borrowing a term nobody used.** Use the source's own technical term and gloss: SEP's "delimitor", not "limitor". If no source uses the term you want, don't present it as sourced.
- **Implying invention.** Name an author's model or precursor when a source names it. Don't imply someone invented what they adapted.

## School pramāṇa sets

The `pramanas` and `pramanas_per` fields on school blocks drive the chips on the home map. They were first set from standard textbook values: Vedānta per Advaita, Mīmāṃsā per Bhāṭṭa, Nyāya-Vaiśeṣika per Nyāya.

- Whenever you write a school block or `pramana-sastra`, confirm each school's set against your sources. The Wikipedia *Pramana* article tabulates them.
- Cite the source on the page that explains them.
- If a source contradicts a stub's set or its `pramanas_per`, fix that block's frontmatter in the same commit and say so in the commit message.

## Check

Before committing: `npm run check`, `npm test` and `npm run e2e` (it builds first). Then read the page in preview at phone width.
