/**
 * dsh-model-order — behavioural contract for the pure ordering logic.
 *
 * These assertions target `src/order.ts` only: it touches no React, no DOM and no
 * official internal structure. Its single responsibility is to reorder array
 * entries, so data safety is asserted as a first-class property here:
 * the input array is never mutated, no entry is ever dropped or added, and no
 * field of any entry is ever rewritten (object identity must be preserved).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { moveModel, sortModelsByName, displayLabelOf, isNoopMove, restoreOrder } from '../src/order.ts'

/** Build a model row carrying extra fields, to prove ordering never touches them. */
function model(id, extra = {}) {
  return { id, name: id.toUpperCase(), contextWindow: 1000, maxTokens: 100, ...extra }
}

function ids(models) {
  return models.map((m) => m.id)
}

/** Every element must be the very same object (proves rows are not rebuilt or rewritten). */
function assertSameIdentity(before, after) {
  assert.equal(after.length, before.length, 'entry count must not change')
  for (const item of after) {
    assert.ok(before.includes(item), `result contains an object absent from the input: ${String(item?.id)}`)
  }
  const beforeIds = [...before.map((m) => m.id)].sort()
  const afterIds = [...after.map((m) => m.id)].sort()
  assert.deepEqual(afterIds, beforeIds, 'the id set must be identical (nothing dropped, nothing added)')
}

/** Untouched entries must keep their relative order. */
function assertRelativeOrderPreserved(before, after, movedId) {
  const stripped = (list) => list.filter((m) => m.id !== movedId).map((m) => m.id)
  assert.deepEqual(stripped(after), stripped(before), 'every entry except the moved one must keep its relative order')
}

const BASE = [model('alpha'), model('bravo'), model('charlie'), model('delta')]

test('moveModel: moving one step up swaps an entry with its predecessor', () => {
  const out = moveModel(BASE, 1, 'up')
  assert.deepEqual(ids(out), ['bravo', 'alpha', 'charlie', 'delta'])
})

test('moveModel: moving one step down swaps an entry with its successor', () => {
  const out = moveModel(BASE, 1, 'down')
  assert.deepEqual(ids(out), ['alpha', 'charlie', 'bravo', 'delta'])
})

test('moveModel: move-to-top puts the entry first and preserves every other relative order', () => {
  const out = moveModel(BASE, 2, 'top')
  assert.deepEqual(ids(out), ['charlie', 'alpha', 'bravo', 'delta'])
})

test('moveModel: move-to-bottom puts the entry last and preserves every other relative order', () => {
  const out = moveModel(BASE, 1, 'bottom')
  assert.deepEqual(ids(out), ['alpha', 'charlie', 'delta', 'bravo'])
})

test('moveModel: first entry up / to-top is a safe no-op', () => {
  assert.deepEqual(ids(moveModel(BASE, 0, 'up')), ids(BASE))
  assert.deepEqual(ids(moveModel(BASE, 0, 'top')), ids(BASE))
})

test('moveModel: last entry down / to-bottom is a safe no-op', () => {
  assert.deepEqual(ids(moveModel(BASE, 3, 'down')), ids(BASE))
  assert.deepEqual(ids(moveModel(BASE, 3, 'bottom')), ids(BASE))
})

test('moveModel: an out-of-range or invalid index degrades to a no-op copy and never throws', () => {
  for (const from of [-1, 4, 99, Number.NaN]) {
    const out = moveModel(BASE, from, 'down')
    assert.deepEqual(ids(out), ids(BASE), `index ${String(from)} must degrade to a no-op`)
  }
})

test('moveModel: never mutates the input array in place', () => {
  const input = [model('alpha'), model('bravo'), model('charlie')]
  const snapshot = ids(input)
  moveModel(input, 0, 'bottom')
  moveModel(input, 2, 'top')
  assert.deepEqual(ids(input), snapshot, 'the input array must be left untouched')
})

test('moveModel: no move ever drops, adds or rewrites an entry (identity preserved per element)', () => {
  for (const move of ['up', 'down', 'top', 'bottom']) {
    for (let from = 0; from < BASE.length; from++) {
      const out = moveModel(BASE, from, move)
      assertSameIdentity(BASE, out)
      assertRelativeOrderPreserved(BASE, out, BASE[from].id)
      assert.equal(out[0].contextWindow, 1000, 'contextWindow must not be rewritten')
      assert.equal(out[0].maxTokens, 100, 'maxTokens must not be rewritten')
      assert.equal(out[0].name, out[0].id.toUpperCase(), 'name must not be rewritten')
    }
  }
})

test('sortModelsByName: natural ordering, with digits compared numerically', () => {
  const list = [model('m10'), model('m2'), model('m1'), model('m20'), model('m3')]
  assert.deepEqual(ids(sortModelsByName(list)), ['m1', 'm2', 'm3', 'm10', 'm20'])
})

test('sortModelsByName: case-insensitive', () => {
  const list = [
    { id: 'b', name: 'banana' },
    { id: 'a', name: 'Apple' },
    { id: 'c', name: 'cherry' },
  ]
  assert.deepEqual(ids(sortModelsByName(list)), ['a', 'b', 'c'])
})

test('sortModelsByName: entries sharing a display name keep their existing relative order (stable)', () => {
  const list = [
    { id: 'first', name: 'same' },
    { id: 'second', name: 'same' },
    { id: 'third', name: 'same' },
  ]
  assert.deepEqual(ids(sortModelsByName(list)), ['first', 'second', 'third'])
})

test('sortModelsByName: never mutates the input, drops an entry or rewrites a field', () => {
  const list = [model('m10'), model('m2'), model('m1')]
  const snapshot = ids(list)
  const out = sortModelsByName(list)
  assert.deepEqual(ids(list), snapshot, 'the input array must be left untouched')
  assertSameIdentity(list, out)
})

test('displayLabelOf: prefers a non-empty name, falls back to the id', () => {
  assert.equal(displayLabelOf({ id: 'x', name: 'Nice Name' }), 'Nice Name')
  assert.equal(displayLabelOf({ id: 'x', name: '' }), 'x')
  assert.equal(displayLabelOf({ id: 'x', name: '   ' }), 'x')
  assert.equal(displayLabelOf({ id: 'x' }), 'x')
  assert.equal(displayLabelOf({ id: 'x', name: 42 }), 'x')
})

test('isNoopMove: recognises a move request that would not change the order', () => {
  assert.equal(isNoopMove(BASE.length, 0, 'up'), true)
  assert.equal(isNoopMove(BASE.length, 0, 'top'), true)
  assert.equal(isNoopMove(BASE.length, 3, 'down'), true)
  assert.equal(isNoopMove(BASE.length, 3, 'bottom'), true)
  assert.equal(isNoopMove(BASE.length, 1, 'up'), false)
  assert.equal(isNoopMove(BASE.length, 1, 'bottom'), false)
  assert.equal(isNoopMove(0, 0, 'down'), true, 'any move on an empty list is a no-op')
  assert.equal(isNoopMove(BASE.length, -1, 'down'), true)
  assert.equal(isNoopMove(BASE.length, 9, 'down'), true)
})

test('empty and single-entry lists are safe', () => {
  assert.deepEqual(moveModel([], 0, 'down'), [])
  assert.deepEqual(sortModelsByName([]), [])
  const one = [model('only')]
  assert.deepEqual(ids(moveModel(one, 0, 'bottom')), ['only'])
  assert.deepEqual(ids(sortModelsByName(one)), ['only'])
})

test('displayLabelOf: an unusable id yields an empty label rather than undefined', () => {
  assert.equal(displayLabelOf({}), '', 'a row with no id at all still needs a string label')
  assert.equal(displayLabelOf({ id: 42 }), '', 'a non-string id is not a label')
  assert.equal(displayLabelOf({ id: null }), '', 'null is not a label')
  assert.equal(displayLabelOf({ id: 42, name: 'Real' }), 'Real', 'a usable name still wins')
})

test('entries with an unusable id still survive a move and a sort untouched', () => {
  const broken = { contextWindow: 7 }
  const list = [model('alpha'), broken, model('charlie')]

  const moved = moveModel(list, 0, 'bottom')
  assert.equal(moved.length, 3, 'no entry may be dropped for having no usable id')
  assert.ok(moved.includes(broken), 'the id-less entry object must survive by identity')

  const sorted = sortModelsByName(list)
  assert.equal(sorted.length, 3, 'sorting must not drop an id-less entry')
  assert.ok(sorted.includes(broken), 'the id-less entry object must survive sorting by identity')
})

test('restoreOrder: puts entries back into the captured order', () => {
  const list = [model('charlie'), model('alpha'), model('bravo')]
  const out = restoreOrder(list, ['alpha', 'bravo', 'charlie'])
  assert.deepEqual(ids(out), ['alpha', 'bravo', 'charlie'])
})

test('restoreOrder: an entry absent from the capture keeps its current order, after the known ones', () => {
  const list = [model('added'), model('charlie'), model('alpha')]
  const out = restoreOrder(list, ['alpha', 'charlie'])
  assert.deepEqual(ids(out), ['alpha', 'charlie', 'added'])
})

test('restoreOrder: entries the capture knows but the list no longer has are simply not invented', () => {
  const list = [model('charlie'), model('alpha')]
  const out = restoreOrder(list, ['alpha', 'bravo', 'charlie'])
  assert.deepEqual(ids(out), ['alpha', 'charlie'])
  assert.equal(out.length, 2, 'restoring must never add an entry')
})

test('restoreOrder: an empty or missing capture is a no-op copy', () => {
  const list = [model('charlie'), model('alpha')]
  assert.deepEqual(ids(restoreOrder(list, [])), ['charlie', 'alpha'])
  assert.deepEqual(ids(restoreOrder(list, undefined)), ['charlie', 'alpha'])
})

test('restoreOrder: never mutates the input, drops an entry or rewrites a field', () => {
  const list = [model('charlie'), model('alpha'), model('bravo')]
  const snapshot = ids(list)
  const out = restoreOrder(list, ['alpha', 'bravo', 'charlie'])
  assert.deepEqual(ids(list), snapshot, 'the input array must be left untouched')
  assertSameIdentity(list, out)
})

test('restoreOrder: tolerates entries with no usable id and duplicate capture entries', () => {
  const broken = { contextWindow: 7 }
  const list = [model('alpha'), broken, model('bravo')]
  const out = restoreOrder(list, ['bravo', 'bravo', 'alpha'])
  assert.equal(out.length, 3, 'no entry may be dropped')
  assert.ok(out.includes(broken), 'the id-less entry must survive by identity')
  assert.deepEqual(
    out.filter((m) => m !== broken).map((m) => m.id),
    ['bravo', 'alpha'],
    'a duplicated capture entry must not disturb the ordering',
  )
})
