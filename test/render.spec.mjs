/**
 * dsh-model-order — render contract of the built browser half.
 *
 * `bundle.spec.mjs` proves the plugin registers correctly; this spec proves the
 * thing users actually see. It mounts the *shipped* `lib/client.js`
 * contribution with real React and real `react-dom` in a real DOM, then drives
 * it the way a person would: click a control, and check what reached the
 * settings seam.
 *
 * That matters because the plugin's whole promise is a data-safety promise —
 * reordering must move the user's own entry objects and change nothing else.
 * Reading the ops a click produced is the only way to check that directly.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** Install a DOM on the globals the bundled half reads at load time. */
function installDom(lang) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  dom.window.document.documentElement.lang = lang
  // Node 24 exposes `navigator` as a getter-only global, so define rather than assign.
  const define = (name, value) =>
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true })
  define('window', dom.window)
  define('document', dom.window.document)
  define('navigator', dom.window.navigator)
  define('IS_REACT_ACT_ENVIRONMENT', true)
  return dom
}

/** Evaluate the shipped bundle and hand back the component it registered. */
function loadContribution() {
  const code = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')
  let definition
  new Function('window', code)({ __ModuleLoader__: { load: (value) => (definition = value) } })

  const registrations = []
  const mutations = []
  const listeners = new Set()
  let snapshot
  const form = {
    getSnapshot: () => snapshot,
    // A real form notifies on every change; without that the component under
    // test would never re-read, and a test that only ever sees its first
    // snapshot cannot check anything that happens after a write.
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    mutate: async (ops, expectedRevision) => {
      mutations.push({ ops, expectedRevision })
      return true
    },
  }
  const ctx = {
    effect: (fn) => fn(),
    configForms: { get: () => form },
    slots: {
      inject: (_key, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }
  const api = definition.factory(require)
  api.apply(ctx)
  assert.equal(registrations.length, 1, 'exactly one contribution must register')

  const { options, component } = registrations[0]
  return {
    component,
    face: options.inject(),
    mutations,
    setSnapshot: (next) => {
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

/** A ready, writable host snapshot whose route declares three models. */
function readySnapshot(models) {
  return {
    status: 'ready',
    value: undefined,
    base: undefined,
    user: { providers: { router: { models } } },
    revision: 7,
    writable: true,
    mode: 'host',
  }
}

const ROUTE_ROW = { provider: 'router', displayName: 'router', settingsNs: 'llm-pi-ai', declared: true }

/** Mount the contribution and render it synchronously. */
async function mount(half, row = ROUTE_ROW, configured = true) {
  const { act, createElement } = require('react')
  const { createRoot } = require('react-dom/client')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const props = { ...half.face, provider: row, configured, keyConfigured: true }
  await act(async () => {
    root.render(createElement(half.component, props))
  })
  return { container, root, act }
}

/** Text of every button in the container. */
function buttonText(container) {
  return [...container.querySelectorAll('button')].map((b) => b.textContent ?? '')
}

/** Click the first button whose accessible name starts with `prefix`. */
async function clickByLabel(container, act, prefix) {
  const button = [...container.querySelectorAll('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').startsWith(prefix),
  )
  assert.ok(button, `no control matching ${prefix}`)
  assert.equal(button.disabled, false, `${prefix} must be enabled here`)
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

const MODELS = [
  { id: 'gh/gemini', name: 'gh/gemini', contextWindow: 1048576 },
  { id: 'qd/dfmodel', name: 'qd/DeepSeek-V4-Flash', contextWindow: 1000000 },
  { id: 'cbcn/glm', name: 'cbcn/glm-5.3-flash' },
]

test('the ordering area renders the route’s declared models in order', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container } = await mount(half)

  assert.match(container.textContent ?? '', /Model order/)
  const labels = [...container.querySelectorAll('li')].map(
    (li) => li.querySelector('span[title]')?.textContent ?? '',
  )
  // Rows show the display name when the entry declares one, not the raw id.
  assert.equal(labels.join('|'), 'gh/gemini|qd/DeepSeek-V4-Flash|cbcn/glm-5.3-flash')
  assert.equal(buttonText(container).slice(0, 2).join('|'), 'Sort by name|Undo this change')
})

test('a pi-ai catalog route is offered the destructive reset instead of undo', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container } = await mount(half, { ...ROUTE_ROW, declared: false })

  assert.ok(
    buttonText(container).includes('Restore default order'),
    'a catalog-backed route may fall back to the catalog',
  )
  assert.ok(!buttonText(container).includes('Undo this change'))
})

test('Chinese copy follows the page language', async () => {
  installDom('zh-CN')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container } = await mount(half)

  assert.match(container.textContent ?? '', /模型排序/)
  assert.ok(buttonText(container).includes('按名称排序'))
})

test('an edge row disables the moves it cannot make', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container } = await mount(half)

  const rows = [...container.querySelectorAll('li')]
  const disabledOf = (li) =>
    [...li.querySelectorAll('button')].map((b) => b.disabled)

  assert.deepEqual(disabledOf(rows[0]), [true, false, true, false], 'first row: up/top blocked')
  assert.deepEqual(disabledOf(rows[2]), [false, true, false, true], 'last row: down/bottom blocked')
})

test('“move down” sends one whole-array replacement holding the same entries reordered', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container, act } = await mount(half)
  await clickByLabel(container, act, 'Move down: gh/gemini')

  assert.equal(half.mutations.length, 1, 'one atomic write per click')
  const { ops, expectedRevision } = half.mutations[0]
  assert.equal(expectedRevision, 7, 'the write is fenced on the revision that was read')
  assert.equal(ops.length, 1, 'never a per-index edit')
  assert.equal(ops[0].op, 'set')
  assert.deepEqual(ops[0].path, ['providers', 'router', 'models'])

  assert.deepEqual(
    ops[0].value.map((m) => m.id),
    ['qd/dfmodel', 'gh/gemini', 'cbcn/glm'],
    'the moved entry swaps with its neighbour and nothing else changes position',
  )
  assert.equal(ops[0].value[0], MODELS[1], 'entries travel by identity, not rebuilt')
  assert.equal(ops[0].value[1], MODELS[0], 'entries travel by identity, not rebuilt')
  assert.equal(ops[0].value[2], MODELS[2], 'the untouched entry is the very same object')
})

test('“sort by name” reorders the same entry objects, adding and dropping nothing', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container, act } = await mount(half)
  await clickByLabel(container, act, 'Sort by name')

  const { ops } = half.mutations[0]
  assert.deepEqual(
    ops[0].value.map((m) => m.id),
    ['cbcn/glm', 'gh/gemini', 'qd/dfmodel'],
    'case-insensitive name order',
  )
  assert.equal(ops[0].value.length, MODELS.length, 'no entry lost')
  for (const entry of ops[0].value) {
    assert.ok(MODELS.includes(entry), 'every entry is one of the originals, by identity')
  }
  assert.equal(ops[0].value[2].contextWindow, 1000000, 'fields ride along untouched')
})

test('a route with no model list of its own explains itself instead of offering controls', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot({
    status: 'ready',
    value: undefined,
    base: undefined,
    user: { providers: { router: { baseURL: 'https://example.test/v1' } } },
    revision: 3,
    writable: true,
    mode: 'host',
  })
  const { container } = await mount(half)

  assert.match(container.textContent ?? '', /no model list of its own/)
  assert.equal(container.querySelectorAll('button').length, 0, 'nothing to click')
})

test('an unconfigured catalog route stays silent instead of explaining itself', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot({
    status: 'ready',
    value: undefined,
    base: undefined,
    user: { providers: {} },
    revision: 1,
    writable: true,
    mode: 'host',
  })
  // The pi-ai family declares a card for every route it ships, configured or not.
  const { container } = await mount(
    half,
    { provider: 'anthropic', displayName: 'anthropic', settingsNs: 'llm-pi-ai' },
    false,
  )

  assert.equal(
    (container.textContent ?? '').trim(),
    '',
    'a route the user never configured has nothing to say; explaining on every catalog route ' +
      'would bury the Models page in notes',
  )
  assert.equal(container.querySelectorAll('button').length, 0)
})

test('a configured route with no model list of its own still explains itself', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot({
    status: 'ready',
    value: undefined,
    base: undefined,
    user: { providers: { router: { baseURL: 'https://example.test/v1' } } },
    revision: 3,
    writable: true,
    mode: 'host',
  })
  const { container } = await mount(half)

  assert.match(
    container.textContent ?? '',
    /no model list of its own/,
    'a route the user does own is worth explaining',
  )
})

test('a read-only document disables every control and says why', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot({ ...readySnapshot(MODELS), writable: false })
  const { container } = await mount(half)

  assert.match(container.textContent ?? '', /read-only/)
  const buttons = [...container.querySelectorAll('button')]
  assert.ok(buttons.length > 0, 'the controls are shown, not hidden')
  assert.ok(
    buttons.every((b) => b.disabled),
    'every control is disabled rather than removed',
  )
})

test('a memory-mode client cannot write, so it disables the controls too', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot({ ...readySnapshot(MODELS), mode: 'memory' })
  const { container } = await mount(half)

  const buttons = [...container.querySelectorAll('button')]
  assert.ok(buttons.length > 0)
  assert.ok(buttons.every((b) => b.disabled))
})

test('an empty declared list is distinct from an inherited one', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot([]))
  const { container } = await mount(half)

  assert.match(container.textContent ?? '', /empty model list/)
  assert.ok(buttonText(container).includes('Sort by name'), 'the area itself is still offered')
})

test('reset is a two-step action: the first click only arms it', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container, act } = await mount(half, { ...ROUTE_ROW, declared: false })

  await clickByLabel(container, act, 'Restore default order')
  assert.equal(half.mutations.length, 0, 'arming a destructive action must not write')
  assert.ok(buttonText(container).includes('Click again to confirm'))

  await clickByLabel(container, act, 'Click again to confirm')
  assert.equal(half.mutations.length, 1, 'the confirmed click writes')
  assert.deepEqual(half.mutations[0].ops, [{ op: 'unset', path: ['providers', 'router', 'models'] }])
})

test('undo restores the order the card was opened with, without removing anything', async () => {
  installDom('en')
  const half = loadContribution()
  half.setSnapshot(readySnapshot(MODELS))
  const { container, act } = await mount(half)

  // Reordering normally then undoing needs a fresh snapshot, as a real write would produce.
  await clickByLabel(container, act, 'Move down: gh/gemini')
  const reordered = half.mutations[0].ops[0].value
  await act(async () => {
    half.setSnapshot(readySnapshot(reordered))
  })

  await clickByLabel(container, act, 'Undo this change')
  const undo = half.mutations[1]
  assert.equal(undo.ops.length, 1, 'one atomic write')
  assert.deepEqual(
    undo.ops[0].value.map((m) => m.id),
    MODELS.map((m) => m.id),
    'the original order comes back',
  )
  assert.equal(undo.ops[0].value.length, MODELS.length, 'nothing was removed')
})
