/**
 * dsh-model-order — behavioural contract for the llm-pi-ai section helpers.
 *
 * These helpers are the only place that knows the shape of the settings
 * section this plugin edits (`providers.<route>.models`). Keeping that
 * knowledge here, and testing it away from React, is what lets the card treat
 * section reading as a pure function — and what makes the write path provably
 * a single whole-array replacement rather than a per-index traversal.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  modelsPathOf,
  userModelsOf,
  userProfileOf,
  setModelsOp,
  unsetModelsOp,
  canRestoreInheritance,
} from '../src/client/section.ts'

const ROUTE = 'router'

/** A user layer shaped exactly like cordis.patch.yml's llm-pi-ai entry. */
function userSection() {
  return {
    providers: {
      router: {
        apiKeyEnv: 'ROUTER_API_KEY',
        api: 'openai-completions',
        baseURL: 'http://127.0.0.1:20128/v1',
        models: [{ id: 'a' }, { id: 'b' }],
      },
      bare: { baseURL: 'https://example.test/v1' },
    },
  }
}

test('modelsPathOf: addresses the models array inside the providers map', () => {
  assert.deepEqual(modelsPathOf(ROUTE), ['providers', ROUTE, 'models'])
})

test('userModelsOf: returns the stored array itself, not a copy', () => {
  const section = userSection()
  const models = userModelsOf(section, ROUTE)
  assert.equal(models, section.providers.router.models, 'the same reference must come back')
})

test('userModelsOf: an empty declared array is an override, not an absence', () => {
  const section = { providers: { router: { models: [] } } }
  assert.deepEqual(userModelsOf(section, ROUTE), [], 'an empty array must stay an array')
})

test('userModelsOf: reports no override when the route inherits its catalog', () => {
  const section = userSection()
  assert.equal(userModelsOf(section, 'bare'), undefined, 'a profile without models inherits')
})

test('userModelsOf: reports no override for every malformed or missing layer', () => {
  const cases = [
    undefined,
    null,
    42,
    'nope',
    {},
    { providers: null },
    { providers: 'nope' },
    { providers: {} },
    { providers: { router: null } },
    { providers: { router: 'nope' } },
    { providers: { router: {} } },
    { providers: { router: { models: null } } },
    { providers: { router: { models: 'nope' } } },
    { providers: { router: { models: {} } } },
  ]
  for (const section of cases) {
    assert.equal(userModelsOf(section, ROUTE), undefined, `must ignore ${JSON.stringify(section)}`)
  }
})

test('userModelsOf / userProfileOf: never read through the prototype chain', () => {
  const section = {}
  for (const route of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(userModelsOf(section, route), undefined, `${route} must not resolve`)
    assert.equal(userProfileOf(section, route), undefined, `${route} must not resolve`)
  }
})

test('userProfileOf: returns the stored route profile object itself', () => {
  const section = userSection()
  assert.equal(userProfileOf(section, ROUTE), section.providers.router)
})

test('setModelsOp: one whole-array replacement at the models path', () => {
  const models = [{ id: 'b' }, { id: 'a' }]
  const op = setModelsOp(ROUTE, models)
  assert.deepEqual(op, { op: 'set', path: ['providers', ROUTE, 'models'], value: models })
  assert.equal(op.value, models, 'the value is passed through without copying')
})

test('unsetModelsOp: one unset at the models path, carrying no value', () => {
  const op = unsetModelsOp(ROUTE)
  assert.deepEqual(op, { op: 'unset', path: ['providers', ROUTE, 'models'] })
  assert.equal('value' in op, false, 'an unset must not carry a value')
})

test('canRestoreInheritance: only routes pi-ai ships a catalog for may be unset', () => {
  assert.equal(canRestoreInheritance(false), true, 'a catalog route falls back to the catalog')
  assert.equal(canRestoreInheritance(undefined), true, 'an unflagged route counts as catalog-backed')
  assert.equal(
    canRestoreInheritance(true),
    false,
    'a hand-declared route has no catalog to fall back to, so unsetting would resolve zero models',
  )
})
