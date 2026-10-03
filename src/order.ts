/**
 * dsh-model-order — pure ordering logic.
 *
 * The ordering feature has exactly one job: reorder the entries of a provider's
 * `models` array. Every function here is pure, array-in / array-out, and carries
 * one hard guarantee that the rest of the plugin depends on:
 *
 *   **an entry object is never rebuilt, never rewritten and never dropped.**
 *
 * That matters because the `models` array is the user's hand-written provider
 * configuration: each entry may carry fields this plugin knows nothing about
 * (`api`, `baseURL`, `reasoningEfforts`, `compat`, pricing, …). Reordering must
 * therefore be a permutation of the existing entry objects, nothing more. The
 * settings layer helps here: its path operations diff one level deep, so the
 * whole array is replaced by value and no per-index traversal ever happens.
 */

/**
 * One entry of a provider's `models` array.
 *
 * Only `id` (identity) and `name` (display) are ever read, and both are typed
 * `unknown`: the array is user-authored, so a malformed entry must survive a
 * reorder untouched rather than be dropped or coerced. Every other field is
 * carried through by every function in this module.
 */
export interface ModelEntry {
  id?: unknown
  name?: unknown
  [key: string]: unknown
}

/** The four move intents offered by the card UI. */
export type OrderMove = 'up' | 'down' | 'top' | 'bottom'

/**
 * Natural-order, case-insensitive comparator.
 *
 * `numeric: true` is what makes `m2` sort before `m10`, which is the ordering a
 * human reading a model list expects (`gemini-3.8-flash` before
 * `gemini-10-flash`). `sensitivity: 'base'` makes the comparison case-insensitive
 * without ignoring accents.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * The label a row is shown and sorted by.
 *
 * A non-blank `name` wins; otherwise the entry falls back to its `id`. Only a
 * string counts on either side, so a malformed entry yields an empty label
 * rather than throwing or leaking a non-string into the comparator.
 */
export function displayLabelOf(model: ModelEntry): string {
  const name = model.name
  if (typeof name === 'string' && name.trim().length > 0) return name
  const id = model.id
  return typeof id === 'string' ? id : ''
}

/** Whether `from` addresses an existing entry. */
function isValidIndex(length: number, from: number): boolean {
  return Number.isInteger(from) && from >= 0 && from < length
}

/**
 * Whether a move request would leave the order unchanged.
 *
 * The UI uses this to disable a button that could not do anything, and the
 * mutator uses it to return an untouched copy instead of churning a write.
 */
export function isNoopMove(length: number, from: number, move: OrderMove): boolean {
  if (!isValidIndex(length, from)) return true
  if (move === 'up') return from === 0
  if (move === 'top') return from === 0
  if (move === 'down') return from === length - 1
  return from === length - 1
}

/**
 * The destination index of a move, expressed in the *original* coordinate space.
 *
 * This is deliberately the coordinate space of the array as it stands before the
 * move: the caller removes the entry first, then inserts it at this index. For a
 * downward move that works out because removing an earlier entry shifts the
 * successor down by one, so inserting at `from + 1` lands the entry immediately
 * after it.
 */
function targetIndexOf(length: number, from: number, move: OrderMove): number {
  if (move === 'up') return from - 1
  if (move === 'down') return from + 1
  if (move === 'top') return 0
  return length - 1
}

/**
 * Move the entry at `from` according to `move`, returning a new array.
 *
 * The returned array is a permutation of the input: same length, same entry
 * objects, same relative order for every entry that did not move. Out-of-range,
 * fractional and `NaN` indices degrade to an untouched copy rather than throwing,
 * so a stale render can never crash the settings page.
 *
 * @param models - the provider's effective `models` array, read-only.
 * @param from - index of the entry to move in `models`.
 * @param move - which direction the entry should travel.
 * @returns a new array with the entry relocated; the input is never modified.
 */
export function moveModel(models: readonly ModelEntry[], from: number, move: OrderMove): ModelEntry[] {
  const next = [...models]
  if (isNoopMove(next.length, from, move)) return next
  const moved = next[from]
  if (moved === undefined) return next
  const to = targetIndexOf(next.length, from, move)
  next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Sort entries by their display label, returning a new array.
 *
 * Ties are broken by the entry's original position, which makes the sort
 * explicitly stable: entries sharing a name keep the order the user gave them,
 * so pressing the button twice cannot shuffle them.
 *
 * @param models - the provider's effective `models` array, read-only.
 * @returns a new, name-ordered array sharing the input's entry objects.
 */
export function sortModelsByName(models: readonly ModelEntry[]): ModelEntry[] {
  return models
    .map((model, index) => ({ model, index }))
    .sort((left, right) => {
      const byLabel = collator.compare(displayLabelOf(left.model), displayLabelOf(right.model))
      return byLabel !== 0 ? byLabel : left.index - right.index
    })
    .map((entry) => entry.model)
}

/**
 * Put entries back into a previously captured order, matched by entry id.
 *
 * This backs the card's "undo this change" affordance for routes that must not
 * be reset: it restores an ordering the user already had, and never removes an
 * entry, so it cannot lose a hand-written model.
 *
 * Matching is by id rather than by object identity on purpose — a settings
 * write round-trips through the Host, so the entries that come back are equal
 * in content but not the same objects as the ones captured.
 *
 * @param models - the route's current models array, read-only.
 * @param baseline - the id order captured when the card first saw the route.
 *                   An empty or absent capture makes this a plain copy.
 * @returns a new array: entries the capture knows come first in captured order,
 *          entries it does not know follow in their current relative order.
 */
export function restoreOrder(
  models: readonly ModelEntry[],
  baseline: readonly string[] | undefined,
): ModelEntry[] {
  if (baseline === undefined || baseline.length === 0) return [...models]
  const rank = new Map<string, number>()
  for (const [index, id] of baseline.entries()) {
    if (!rank.has(id)) rank.set(id, index)
  }
  return models
    .map((model, index) => {
      const id = model.id
      const position = typeof id === 'string' ? rank.get(id) : undefined
      // Unknown entries rank last; the index tiebreak (and the NaN fallback
      // below) keeps their current relative order stable.
      return { model, index, position: position ?? Number.POSITIVE_INFINITY }
    })
    .sort((left, right) => left.position - right.position || left.index - right.index)
    .map((entry) => entry.model)
}
