<div align="center">

# dsh-model-order

> **Reorder your models in DeepSeek Harness — in Settings, where you can see them.**
> The composer's model menu follows the same order, because it is the same order.

[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)

**English** | [中文](README.zh.md)

</div>

`dsh-model-order` adds an ordering area to every provider card on **Settings → Models** for `llm-pi-ai` routes. Move a model up, down, to the top or to the bottom; sort the list by name; or put it back the way it was. The order you set is the order the composer's model menu shows.

[Features](#features) · [Compatibility](#compatibility) · [Install](#install--uninstall) · [Quick start](#quick-start) · [Configuration](#configuration) · [Permissions & data](#permissions--data) · [How it works](#how-it-works) · [Troubleshooting](#troubleshooting) · [Development](#development)

---

## Features

| Feature | Description |
| --- | --- |
| ↕ Move one step | Up / down buttons swap a model with its neighbour |
| ⇈ Move to an end | Send a model straight to the top or the bottom |
| 🔤 Sort by name | Natural ordering, so `m2` lands before `m10`; case-insensitive and stable |
| ↩ Undo / restore | Put the order back — see [the two restore paths](#the-two-restore-paths) |
| 🔒 Order lives in your config | The order *is* the `models` array you already have; no second place to keep in sync |
| 🧩 No official file touched | Contributed through the extension slot the Models page declares for outside plugins |

### Where the order comes from

In DSH there is exactly **one** source of truth for model order: the `models` array of a provider's configuration. Everything downstream preserves it:

```
cordis.patch.yml  providers.<route>.models: [ … ]
        │
        ▼  dsh-llm-pi-ai · resolveRouteModels()   keeps the configured order
        ▼  ctx.llm.listModels(provider)           keeps it
        ▼  buildModelCatalog()                    keeps it, per provider group
        ▼  the Models settings page               renders it, numbered 1, 2, 3 …
        ▼  the composer model menu                renders it, "model order within each group is unchanged"
```

So the settings list and the composer menu are not two orderings that have to agree — they are the same ordering, read twice. That is why changing the order under Settings changes the composer, and why this plugin never needs to patch the composer at all.

### The two restore paths

"Restore" means different things depending on the route, and DSH's own adapter is what decides which:

| Route kind | Button | What happens |
| --- | --- | --- |
| pi-ai ships a catalog for it (`anthropic`, `openai`, …) | **Restore default order** | Removes the route's `models` list, so it falls back to the models pi-ai ships |
| Hand-declared route (`router`, a relay, a self-hosted endpoint) | **Undo this change** | Puts the list back into the order it had when you opened the card — nothing is removed |

The second row is a safety gate, not a limitation. The pi-ai adapter refuses to resolve an empty model list for a route its catalog does not describe ("*the installed catalog does not describe this route, so its models must be listed in configuration*"). Unsetting `models` on such a route would leave it with **zero models** and a catalog error. So this plugin only offers the destructive reset where it is actually safe, and offers a non-destructive undo everywhere else. To use the real reset on a hand-declared route, delete its `models` entry yourself — you will be told immediately if it cannot work.

## Compatibility

| Item | Value |
| --- | --- |
| DSH | web and desktop profiles, `>=0.2.0-rc.1 <0.3.0-0` (verified against `0.2.0-rc.2`) |
| Node | `>=20` (build only; the plugin ships prebuilt) |
| Depends on | `dsh-client-ui-settings-models` (declares the slot), `dsh-client-ui-settings` (settings transport), `dsh-client-ui-renderer` (slot registry) |
| Applies to | `llm-pi-ai` routes. DeepSeek official, DeepSeek account and third-party adapter families are untouched |

## Install / Uninstall

```sh
# From GitHub (lib/ is committed, so no local build is needed)
dsh plugin --profile desktop add github:Wany-i/dsh-model-order

# Or from a local checkout
npm install && npm run build
dsh plugin --profile desktop add file:/absolute/path/to/dsh-model-order
```

Restart DeepSeek Harness afterwards, then hard-reload the page (`Ctrl+F5`) so the client half is re-fetched.

| Action | Command |
| --- | --- |
| Upgrade | re-run `add`, then restart |
| Remove | `dsh plugin --profile desktop remove dsh-model-order` |

## Quick start

1. Open **Settings → Models**.
2. Find a route you have configured models for (for example `router`) and expand its card.
3. Use the arrows to move a model, or **Sort by name**.
4. Open the composer's model menu — the same order is there.

> If a card shows *"This route has no model list of its own…"* instead of the ordering area, that route has no `models` list in your configuration and therefore serves the models pi-ai ships. There is nothing to reorder until you declare models for it — see below.

## Configuration

None. The plugin has no settings namespace and no persisted preferences of its own: the order it edits *is* your configuration, so there is nothing else to configure or keep in sync.

Add or edit models in the same card using the official editor; this plugin's area only changes their order.

## Permissions & data

- **No network access.** The plugin never opens a connection.
- **No new storage.** Nothing is written except the `models` array of the route you reorder.
- **No model fields are modified.** Every action is a permutation of the entry objects already in your configuration: `id`, `name`, `contextWindow`, `maxTokens`, `input` and any field this plugin does not know about are carried through byte-for-byte. Nothing is added and nothing is removed.
- **Writes are revision-fenced.** Each write carries the settings revision read before the edit, so a concurrent change from another tab or an external `cordis.patch.yml` edit is refused rather than overwritten.
- **Read-only deployments stay read-only.** Controls are disabled with an explanation.

## How it works

1. The official Models page declares `settings.models.provider-card` for plugins distributed outside its repository, dispatched with `entryKey = settingsNs` for every card that shows a provider row.
2. This plugin registers one keyed entry under the pi-ai family's namespace (`llm-pi-ai`). No official file is patched, and a deployment without that family dispatches the area nowhere.
3. The area reads the route's **user-layer** `models` array through `ctx.configForms`, and writes it back with a single `{ op: 'set', path: ['providers', route, 'models'], value: [...] }`.
4. One whole-array replacement is not a shortcut — it is the only thing the settings seam supports. Its path operations diff one level deep and do not traverse array nodes, which is also what the official editor does when it writes a model list.

The pure parts (`src/order.ts`, `src/client/section.ts`) hold no React and no DOM, so they are tested directly; `tsconfig` treats sources as erasable-syntax-only TypeScript so `node` can run them without a build step.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| The area does not appear at all | The client half is not loaded. Re-run `dsh plugin --profile desktop add <spec>`, restart DSH, then hard-reload the page. |
| The area never appears on *any* card | The pi-ai family is composed under a settings entry id other than `llm-pi-ai`. The dispatch key is that id, so `PROVIDER_NAMESPACES` in `src/client/index.ts` has to name it. The plugin renders nowhere rather than misbehaving. |
| The area appears on my routes but not on an unconfigured catalog route | Working as intended: a route you never configured gets no note, so the page is not buried in them. |
| `This route has no model list of its own` | Working as intended: the route inherits the pi-ai catalog. Declare `models` on it to reorder. |
| Controls are disabled | The settings document is read-only, or the client is in memory mode (a non-loopback browser without Host persistence). |
| `The settings changed elsewhere…` | Another writer bumped the revision; the list refreshed. Retry on the refreshed list. |
| Sorted list looks wrong | Ordering is natural and case-insensitive, by `name` when present, otherwise by `id`. |
| Restore is not offered for my route | It is hand-declared; use **Undo this change** instead, or remove `models` yourself. |

## Development

```sh
npm install
npm run verify     # typecheck + build + all specs
npm run watch      # rebuild on change
```

| Path | Contents |
| --- | --- |
| `src/order.ts` | Pure ordering: move, sort-by-name, restore-to-capture |
| `src/client/section.ts` | Pure shape knowledge: where `models` lives, and the write ops |
| `src/client/ModelOrderCard.tsx` | The slot contribution |
| `src/client/index.ts` | Registration and the settings face |
| `src/index.ts` | Host half — deliberately empty |
| `test/order.spec.mjs`, `test/section.spec.mjs` | Behaviour of the pure modules |
| `test/patch.spec.mjs` | Packaging contract: patch ↔ manifest ↔ bundle |
| `test/bundle.spec.mjs` | Integration: loads the built half and drives the registration chain |

Type declarations for the integration surface come from the published official packages, pinned to the same version as the runtime. If you target a different DSH release, align the `@deepseek-ai/*` devDependency versions with it.

The repository URLs in `package.json` point at `Wany-i/dsh-model-order`; change them if you publish under another account.

## License

[MIT](LICENSE)
