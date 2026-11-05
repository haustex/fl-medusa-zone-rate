/**
 * Class names of the tracking components. Defaults use Tailwind and the
 * `@medusajs/ui-preset` tokens both Medusa starters ship; pass `theme={{ … }}`
 * to match another design. Only the keys you pass change.
 */
export type TrackingTheme = {
  page: string
  inner: string
  card: string
  title: string
  heading: string
  text: string
  subtle: string
  small: string
  muted: string
  error: string
  form: string
  input: string
  button: string
  mono: string
  number: string
  status: string
  statusFinal: string
  facts: string
  fact: string
  factLabel: string
  factValue: string
  link: string
  timeline: string
  event: string
  dot: string
  dotCurrent: string
  line: string
  eventTitle: string
  eventMeta: string
  live: string
  liveDot: string
  photos: string
  photo: string
}

export const defaultTheme: TrackingTheme = {
  page: "py-6",
  inner: "content-container flex w-full max-w-2xl flex-col gap-y-6",
  card: "flex flex-col gap-y-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-6",
  title: "text-3xl font-normal text-ui-fg-base",
  heading: "text-xl font-semibold text-ui-fg-base",
  text: "txt-medium text-ui-fg-base",
  subtle: "txt-medium text-ui-fg-subtle",
  small: "txt-small text-ui-fg-subtle",
  muted: "txt-small text-ui-fg-muted",
  error: "txt-small text-ui-fg-error",
  form: "flex flex-col gap-2 sm:flex-row",
  input: "h-11 w-full sm:w-auto sm:flex-1 rounded-md border border-ui-border-base bg-ui-bg-field px-3 font-mono uppercase tracking-wide",
  button: "inline-flex h-11 items-center justify-center rounded-md bg-ui-button-inverted px-5 txt-compact-medium-plus text-ui-fg-on-inverted hover:bg-ui-button-inverted-hover",
  mono: "font-mono tracking-wide",
  number: "font-mono text-lg tracking-wide text-ui-fg-base",
  status: "text-2xl font-semibold text-ui-fg-base",
  statusFinal: "text-2xl font-semibold text-ui-fg-interactive",
  facts: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  fact: "flex flex-col gap-0.5",
  factLabel: "txt-small text-ui-fg-subtle",
  factValue: "txt-medium-plus text-ui-fg-base",
  link: "txt-medium-plus text-ui-fg-interactive hover:text-ui-fg-interactive-hover underline-offset-4 hover:underline",
  timeline: "flex flex-col",
  event: "relative flex gap-x-3 pb-5 last:pb-0",
  dot: "mt-1.5 size-2.5 shrink-0 rounded-full bg-ui-border-strong",
  dotCurrent: "mt-1.5 size-2.5 shrink-0 rounded-full bg-ui-fg-base ring-4 ring-ui-bg-subtle",
  line: "absolute left-[4.5px] top-5 bottom-0 w-px bg-ui-border-base",
  eventTitle: "txt-medium-plus text-ui-fg-base",
  eventMeta: "txt-small text-ui-fg-subtle",
  live: "inline-flex items-center gap-x-2 txt-small text-ui-fg-subtle",
  liveDot: "size-2 rounded-full bg-ui-tag-green-icon",
  photos: "mt-2 flex flex-wrap gap-2",
  photo: "size-20 rounded-md border border-ui-border-base object-cover",
}

export const mergeTheme = (theme?: Partial<TrackingTheme>): TrackingTheme => ({ ...defaultTheme, ...theme })
