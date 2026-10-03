/**
 * dsh-model-order — integration contract of the built browser half.
 *
 * `patch.spec.mjs` proves the bundle is shaped like a plugin; this spec proves
 * it *behaves* like one. It loads the shipped `lib/client.js` through a stand-in
 * for the shell's module loader, then drives the whole chain the real shell
 * drives at runtime:
 *
 *   apply(ctx) → ctx.slots.inject → ctx.slots.register → the injected face →
 *   ctx.configForms → form.mutate
 *
 * That chain is the entire integration surface. Nothing here replaces a real
 * render — a browser still has to draw the area — but every step the plugin
 * itself is responsible for is executed rather than pattern-matched, so a
 * wrong service name, a wrong dispatch key, or an op list that mutates on its
 * way to the seam fails here.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Hooks the component calls; registration must not execute any of them. */
const REACT_STUB = {
  useCallback: (fn) => fn,
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
  useState: (value) => [value, () => {}],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}

const JSX_RUNTIME_STUB = {
  Fragment: Symbol('Fragment'),
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
}

/** Evaluate the shipped bundle exactly the way the shell's loader does. */
function loadClientHalf() {
  const code = readFileSync(join(ROOT, 'lib/client.js'), 'utf8')
  let definition
  const fakeWindow = {
    __ModuleLoader__: {
      load: (value) => {
        definition = value
      },
    },
  }
  new Function('window', code)(fakeWindow)

  assert.ok(definition, 'the bundle must hand itself to window.__ModuleLoader__.load')
  const loaded = []
  const requireStub = (id) => {
    loaded.push(id)
    if (id === 'react') return REACT_STUB
    if (id === 'react/jsx-runtime') return JSX_RUNTIME_STUB
    throw new Error(`the bundle asked for a module it does not declare: ${id}`)
  }
  return { api: definition.factory(requireStub), loaded, id: definition.id }
}

/** Build a stand-in client context recording everything the plugin does to it. */
function makeContext() {
  const record = { effects: 0, injected: [], registrations: [], namespaces: [], mutations: [] }
  const form = {
    getSnapshot: () => ({
      status: 'ready',
      value: undefined,
      base: undefined,
      user: { providers: { router: { models: [{ id: 'a' }] } } },
      revision: 11,
      writable: true,
      mode: 'host',
    }),
    subscribe: () => () => {},
    mutate: async (ops, expectedRevision) => {
      record.mutations.push({ ops, expectedRevision })
      return true
    },
  }
  const ctx = {
    effect: (fn) => {
      record.effects += 1
      return fn()
    },
    configForms: {
      get: (namespace) => {
        record.namespaces.push(namespace)
        return form
      },
    },
    slots: {
      inject: (key, callback) => {
        record.injected.push(key)
        return callback()
      },
      register: (options, component) => {
        record.registrations.push({ options, component })
        return () => {}
      },
    },
  }
  return { ctx, record }
}

test('the bundle loads under the shell loader and declares itself once', () => {
  const { api, id, loaded } = loadClientHalf()
  assert.equal(id, 'dsh-model-order', 'the loader keys the module by the plugin id')
  assert.equal(api.name, 'dsh-model-order', 'the exported name must match the loader key')
  assert.deepEqual(api.inject, ['slots', 'configForms'], 'exactly the services the plugin uses')
  assert.equal(typeof api.apply, 'function')
  assert.deepEqual(
    loaded.sort(),
    ['react', 'react/jsx-runtime'],
    'the half must load nothing but the shared platform modules',
  )
})

test('apply registers one keyed contribution into the official provider-card seat', () => {
  const { api } = loadClientHalf()
  const { ctx, record } = makeContext()
  api.apply(ctx)

  assert.equal(record.effects, 1, 'the registration rides one effect, so unload disposes it')
  assert.deepEqual(
    record.injected,
    ['settings.models.provider-card'],
    'the seat is declared by the official Models page',
  )
  assert.equal(record.registrations.length, 1, 'one contribution, one card family')

  const { options, component } = record.registrations[0]
  assert.equal(options.name, 'settings.models.provider-card', 'the entry targets that seat')
  assert.equal(options.key, 'llm-pi-ai', 'the dispatch key is the settings namespace of the family')
  assert.equal(options.registrant, 'dsh-model-order', 'diagnostics must name this plugin')
  assert.equal(typeof options.inject, 'function', 'the entry injects its business face')
  assert.equal(typeof component, 'function', 'the slot renders a component')
})

test('the injected face reads and writes the same settings namespace it registered for', () => {
  const { api } = loadClientHalf()
  const { ctx, record } = makeContext()
  api.apply(ctx)

  const { options } = record.registrations[0]
  const face = options.inject()

  assert.deepEqual(
    record.namespaces,
    ['llm-pi-ai'],
    'the face must open the form for the very namespace the entry is keyed by',
  )
  assert.equal(face.getSnapshot().revision, 11, 'snapshots come straight from the seam')
  assert.equal(typeof face.subscribe, 'function')
  assert.equal(typeof face.apply, 'function')
})

test('the injected face is a stable reference across calls', () => {
  const { api } = loadClientHalf()
  const { ctx, record } = makeContext()
  api.apply(ctx)

  const { options } = record.registrations[0]
  const first = options.inject()
  const second = options.inject()

  assert.equal(
    first,
    second,
    'the render machinery may build props on every pass; a fresh face each time would give ' +
      'useSyncExternalStore a new subscribe function and resubscribe the store on every render',
  )
  assert.equal(first.getSnapshot, second.getSnapshot, 'and the individual handles must be stable too')
})

test('the face forwards an op list to the seam unchanged, fenced on the revision it read', async () => {
  const { api } = loadClientHalf()
  const { ctx, record } = makeContext()
  api.apply(ctx)

  const face = record.registrations[0].options.inject()
  const ops = [{ op: 'set', path: ['providers', 'router', 'models'], value: [{ id: 'b' }] }]
  const accepted = await face.apply(ops, 11)

  assert.equal(accepted, true, 'the seam answer is returned as-is')
  assert.equal(record.mutations.length, 1, 'one atomic mutation, never a per-index edit')
  assert.equal(record.mutations[0].ops, ops, 'ops must arrive by reference, not rebuilt')
  assert.deepEqual(record.mutations[0].ops[0], {
    op: 'set',
    path: ['providers', 'router', 'models'],
    value: [{ id: 'b' }],
  })
  assert.equal(
    record.mutations[0].expectedRevision,
    11,
    'the write is fenced on the revision read before editing, so a concurrent change is refused',
  )
})
