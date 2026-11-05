import { LABELS, type TrackingLocale } from "../labels"
import { mergeTheme, type TrackingTheme } from "../theme"

/**
 * The lookup form: a plain GET form to `action` with `?number=`, so it works
 * without JavaScript; the page redirects to `{action}/{number}`.
 */
export function TrackingLookup({
  action,
  locale,
  defaultValue,
  error,
  theme,
}: {
  action: string
  locale: TrackingLocale
  defaultValue?: string
  error?: string | null
  theme?: Partial<TrackingTheme>
}) {
  const t = LABELS[locale]
  const c = mergeTheme(theme)
  return (
    <form action={action} method="get" className={c.form} role="search" data-testid="tracking-lookup">
      <label htmlFor="tracking-number" className="sr-only">
        {t.inputLabel}
      </label>
      <input
        id="tracking-number"
        name="number"
        required
        defaultValue={defaultValue}
        placeholder={t.placeholder}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        inputMode="text"
        aria-invalid={!!error || undefined}
        aria-describedby={error ? "tracking-error" : undefined}
        className={c.input}
        data-testid="tracking-input"
      />
      <button type="submit" className={c.button} data-testid="tracking-submit">
        {t.submit}
      </button>
      {error && (
        <p id="tracking-error" role="alert" className={c.error}>
          {error}
        </p>
      )}
    </form>
  )
}
