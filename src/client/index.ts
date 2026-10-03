/**
 * dsh-model-order — browser half.
 *
 * The plugin adds exactly one thing: an ordering area inside the Models
 * settings page's provider cards, contributed through the extension slot the
 * official page declares for plugins outside its repository.
 *
 * Registration is deliberately narrow. The slot is keyed by the row's owning
 * settings namespace, so contributing under the pi-ai family's namespace means
 * the page dispatches this area for exactly those cards — shipped catalog
 * routes, added routes and hand-declared routes alike — and never needs to
 * learn what the namespace means. If that family is not composed, no row
 * carries the key, the area is dispatched nowhere, and this plugin leaves no
 * trace on the page.
 *
 * Everything this module needs at runtime arrives through the cordis context:
 * `slots` to register the contribution, `configForms` to read and write the
 * settings namespace the card belongs to. No official package is imported as a
 * value, so the bundle shares the host page's React and nothing else.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only imports: they pull in the services' Context augmentations (slots,
// configForms) and the slot-map declaration for the seat we register into.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'

import { ModelOrderCard, type FormSnapshotLike, type ModelOrderFace } from './ModelOrderCard.tsx'
import type { PathOp } from './section.ts'

/** Stable plugin name; matches the host half and the bundle patch entry id. */
export const name = 'dsh-model-order'

/** Cordis services this fiber needs before `apply` runs. */
export const inject: string[] = ['slots', 'configForms']

/**
 * Settings namespaces whose provider cards receive the ordering area.
 *
 * The pi-ai adapter publishes its settings namespace as its own loader entry
 * id, which the shipped profile spells `llm-pi-ai` and the profile patch layer
 * pins. A deployment that renames the entry would need the matching name here;
 * the area simply would not be dispatched otherwise, and nothing else breaks.
 */
const PROVIDER_NAMESPACES: readonly string[] = ['llm-pi-ai']

/**
 * Bind one namespace's settings form to the small face the card consumes.
 *
 * The seam's op type and this plugin's `PathOp` describe the same two shapes;
 * they differ only in how precisely the `set` value is typed (`JsonValue`
 * versus `unknown`, since entries are user-authored and validated by the Host,
 * not here). The conversion is therefore structural and happens once, at this
 * boundary, instead of loosening the tested types upstream.
 *
 * @param ctx - the plugin's client context.
 * @param namespace - the settings namespace to edit.
 * @returns the face injected into the card's props.
 */
function createFace(ctx: ClientContext, namespace: string): ModelOrderFace {
  const form: ConfigForm<unknown> = ctx.configForms.get<unknown>(namespace)
  return {
    getSnapshot: (): FormSnapshotLike => form.getSnapshot(),
    subscribe: (listener: () => void) => form.subscribe(listener),
    apply: (ops: readonly PathOp[], expectedRevision: number | undefined) =>
      form.mutate(ops as readonly SettingsPathOpView[], expectedRevision),
  }
}

/**
 * Register the ordering area for every managed namespace.
 *
 * @param ctx - the plugin's client context.
 */
export function apply(ctx: ClientContext): void {
  for (const namespace of PROVIDER_NAMESPACES) {
    // Built once per namespace, not once per inject call: the render machinery
    // may assemble props on every pass, and a fresh face each time would hand
    // `useSyncExternalStore` a new `subscribe` on every render, tearing the
    // subscription down and rebuilding it over and over.
    const face = createFace(ctx, namespace)
    ctx.effect(() =>
      ctx.slots.inject('settings.models.provider-card', () =>
        ctx.slots.register(
          {
            name: 'settings.models.provider-card',
            key: namespace,
            registrant: name,
            inject: () => face,
          },
          ModelOrderCard,
        ),
      ),
    )
  }
}
