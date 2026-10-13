/** The directive names the Markdown pipeline understands; any other `:word` is ordinary text. */
export const DIRECTIVES = new Set(['note', 'cite']);
/** The mdast node types remark-directive produces: `:inline`, `::leaf` and `:::container`. */
export const DIRECTIVE_NODES = new Set(['textDirective', 'leafDirective', 'containerDirective']);
