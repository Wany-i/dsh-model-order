/**
 * dsh-model-order — shape knowledge for the `llm-pi-ai` settings section.
 *
 * This module is the only place that knows where a route's model list lives and
 * what a write to it looks like. Everything here is a pure function over the
 * raw settings section, held apart from React so the write path can be tested
 * without a DOM and reasoned about without the settings page.
 *
 * Two deliberate properties, both load-bearing:
 *
 * 1. **Own properties only.** The section is user-authored JSON-shaped data
 *    keyed by user-chosen route ids, so a route named `constructor` or
 *    `__proto__` must read as "no profile" rather than resolving through
 *    `Object.prototype`. Every lookup goes through {@link ownProperty}.
 *
 * 2. **One whole-array replacement.** {@link setModelsOp} addresses
 *    `providers.<route>.models` and replaces the array by value. The settings
 *    seam diffs one level deep and does not traverse array nodes, so a
 *    per-index edit is not merely unnecessary — it is impossible, and trying it
 *    would corrupt the list. Reordering is therefore expressed as exactly the
 *    operation the seam supports.
 */

/**
 * One entry of a route's `models` array, as the user layer stores it.
 *
 * Only `id` and `name` are read here, and both are treated as `unknown`: a
 * malformed entry must survive a reorder untouched rather than be dropped, so
 * nothing in this module may assume a shape it has not checked.
 */
export interface ProfileEntry {
  id?: unknown
  name?: unknown
  [key: string]: unknown
}

/**
 * One path-addressed edit, structurally mirroring the settings seam's view type
 * (`{ op: 'set', path, value } | { op: 'unset', path }`).
 *
 * Re-declared here rather than imported so this module stays testable with no
 * dependency at all; the shapes are structurally identical, so a value of this
 * type is accepted wherever the seam's type is expected.
 */
export type PathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/**
 * Read an own property off a JSON-shaped value.
 *
 * @param value - the container; anything that is not an object reads as absent.
 * @param key - the property name, taken verbatim from the route id.
 * @returns the own value, or `undefined` when the container is not an object or
 *          simply does not carry the key as its own.
 */
function ownProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  if (!Object.hasOwn(value, key)) return undefined
  return (value as Record<string, unknown>)[key]
}

/**
 * The path of one route's models array inside the namespace section.
 *
 * The pi-ai adapter publishes `settingsPath: ['providers', route]` for every
 * configurable route, so the models list sits one key beneath it.
 *
 * @param route - the provider route id (for example `router`).
 * @returns the absolute path from the section root.
 */
export function modelsPathOf(route: string): string[] {
  return ['providers', route, 'models']
}

/**
 * The user layer's stored profile object for one route.
 *
 * @param userSection - the namespace's raw user layer, as the form exposes it.
 * @param route - the provider route id.
 * @returns the stored profile object itself, or `undefined` when the user layer
 *          declares none. Arrays and primitives are not profiles.
 */
export function userProfileOf(
  userSection: unknown,
  route: string,
): Record<string, unknown> | undefined {
  const profile = ownProperty(ownProperty(userSection, 'providers'), route)
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) return undefined
  return profile as Record<string, unknown>
}

/**
 * The user layer's stored models array for one route, if it declares one.
 *
 * `undefined` means the route carries no array of its own and therefore serves
 * whatever it inherits — the state in which this plugin has nothing to reorder
 * and shows no ordering controls. An empty array is a declared override and
 * comes back as an empty array.
 *
 * The stored array is returned by reference: callers display exactly what is
 * stored, and the reorder functions in `order.ts` never mutate it.
 *
 * @param userSection - the namespace's raw user layer.
 * @param route - the provider route id.
 * @returns the stored array, or `undefined` when the route declares none.
 */
export function userModelsOf(userSection: unknown, route: string): ProfileEntry[] | undefined {
  const models = ownProperty(userProfileOf(userSection, route), 'models')
  return Array.isArray(models) ? (models as ProfileEntry[]) : undefined
}

/**
 * The edit that replaces one route's models array with `models`.
 *
 * @param route - the provider route id.
 * @param models - the new ordering; passed through without copying so the
 *                 caller keeps ownership of what it sends.
 * @returns a single whole-array `set` op.
 */
export function setModelsOp(route: string, models: readonly ProfileEntry[]): PathOp {
  return { op: 'set', path: modelsPathOf(route), value: models }
}

/**
 * The edit that removes one route's models override, returning it to whatever
 * it inherits.
 *
 * **Only safe for a route pi-ai ships a catalog for** — see
 * {@link canRestoreInheritance}. For a hand-declared route the pi-ai adapter
 * refuses to resolve an empty model list at all ("the installed catalog does
 * not describe this route, so its models must be listed in configuration"), so
 * unsetting would leave the provider serving nothing.
 *
 * @param route - the provider route id.
 * @returns a single `unset` op at the models path.
 */
export function unsetModelsOp(route: string): PathOp {
  return { op: 'unset', path: modelsPathOf(route) }
}

/**
 * Whether dropping a route's models override is safe.
 *
 * The provider directory's `declared` flag marks exactly the routes the
 * installed pi-ai catalog does not describe (the adapter computes it as
 * `!catalog.has(provider)`). Such a route has nothing to fall back to, so its
 * override must stay.
 *
 * @param declared - the directory entry's `declared` flag, when present.
 * @returns `true` for a catalog-backed route, `false` for a hand-declared one.
 */
export function canRestoreInheritance(declared: boolean | undefined): boolean {
  return declared !== true
}
