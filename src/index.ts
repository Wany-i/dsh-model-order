/**
 * dsh-model-order — host half.
 *
 * This plugin is browser-only: everything it does happens in the Models
 * settings page and travels over the settings RPC the page already uses. The
 * host row exists because a bundle patch inserts plugin entries, and an entry
 * must resolve to a real module — so this file exists, declares its name, and
 * deliberately does nothing else.
 *
 * The browser half is declared by package.json's `dsh.client` manifest
 * (`platform: web`) and is loaded by the web client.
 */

/** Stable plugin name; must match the `insert` id in cordis.patch.yml. */
export const name = 'dsh-model-order'

/** Host plugin body — a UI-only plugin has no host-side behaviour. */
export function apply(): void {}
