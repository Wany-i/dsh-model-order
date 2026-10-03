/**
 * dsh-model-order — packaging contract.
 *
 * A DSH plugin can build cleanly and still never load: the loader resolves the
 * bundle patch, the patch names an entry, the entry resolves a host module, and
 * the client loader finds the browser half only through the package manifest.
 * Each of those is a separate chance to be wrong in a way no unit test notices.
 * This spec asserts the whole chain instead, against the shipped artifacts.
 *
 * Run after `npm run build`: the bundle assertions read `lib/`.
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')
const manifest = JSON.parse(read('package.json'))

test('the package declares the bundle patch the loader applies', () => {
  assert.equal(
    manifest.dsh?.bundle?.patch,
    './cordis.patch.yml',
    'dsh.bundle.patch is what makes this repository an installable plugin at all',
  )
  assert.ok(existsSync(join(ROOT, 'cordis.patch.yml')), 'the declared patch must exist')
})

test('the patch inserts one entry whose id and name match the package', () => {
  const patch = read('cordis.patch.yml')
  assert.match(patch, /^- insert:/m, 'the patch layer is an array of insert entries')

  const ids = [...patch.matchAll(/^\s*- id:\s*(\S+)\s*$/gm)].map((m) => m[1])
  const names = [...patch.matchAll(/^\s*name:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1])

  assert.equal(ids.length, 1, 'one plugin entry, so the id cannot be ambiguous')
  assert.equal(names.length, 1, 'one plugin name, so the entry cannot resolve elsewhere')
  assert.equal(names[0], manifest.name, 'the entry name must resolve to this package')
  assert.equal(ids[0], 'model-order', 'the entry id is part of every settings path the plugin writes')
})

test('the entry name matches the name the host half exports', () => {
  const host = read('lib/index.js')
  assert.match(
    host,
    new RegExp(`const name = ${JSON.stringify(manifest.name)}|name = "${manifest.name}"`),
    'cordis pairs the exported name with the patch row, so they must agree',
  )
  assert.match(host, /function apply\(/, 'a plugin entry must export apply')
})

test('the browser half is declared as a web client half', () => {
  assert.equal(manifest.dsh?.client?.platform, 'web', 'the half is a browser artifact')
  assert.ok(
    Array.isArray(manifest.dsh?.client?.inject),
    'the client half lists the packages whose services it consumes',
  )
  assert.ok(
    manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings-models'),
    'the seat this plugin fills is declared by that package',
  )
})

test('every advertised entry point resolves to a file that ships', () => {
  const exported = [
    manifest.main,
    ...Object.values(manifest.exports ?? {}).map((value) =>
      typeof value === 'string' ? value : value?.default,
    ),
  ].filter((value) => typeof value === 'string')

  assert.ok(exported.length > 0, 'the manifest advertises at least one entry point')
  for (const advertised of exported) {
    // npm normalizes a leading './' away on publish; compare the same way.
    const relative = advertised.replace(/^\.\//, '')
    // package.json is always published and never needs a files entry.
    if (relative === 'package.json') continue

    assert.ok(existsSync(join(ROOT, relative)), `${relative} is advertised but missing`)
    assert.ok(
      manifest.files.some(
        (entry) => relative === entry || relative.startsWith(entry.replace(/\/$/, '') + '/'),
      ),
      `${relative} must be covered by the published files list`,
    )
  }
})

test('the browser half is a loader factory that shares the page React', () => {
  const client = read('lib/client.js')

  assert.match(
    client,
    /window\.__ModuleLoader__\.load\(\{\s*id:\s*"dsh-model-order"/,
    'the client loader only evaluates a bundle wrapped in this call',
  )
  assert.match(client, /factory:\s*\(require\)\s*=>/, 'the wrapper must expose the factory')
  assert.match(
    client,
    /return module\.exports;\s*\}\s*\}\);/,
    'the factory must return its exports, or the shell loads an empty plugin',
  )

  const required = new Set(
    [...client.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]),
  )
  for (const id of required) {
    assert.ok(
      id === 'react' || id.startsWith('react/') || id.startsWith('@deepseek-ai/'),
      `${id} is not a platform module; it must be bundled instead of required`,
    )
  }
  assert.ok(required.has('react'), 'the half is a React contribution')

  // A second React copy would break hooks across the slot boundary.
  assert.doesNotMatch(
    client,
    /__SECRET_INTERNALS|Minified React error/,
    'React must stay external, never bundled',
  )
})

test('the browser half registers into the official provider-card seat', () => {
  const client = read('lib/client.js')
  assert.match(
    client,
    /settings\.models\.provider-card/,
    'the seat key is the whole integration surface; a typo silently contributes nowhere',
  )
  assert.match(client, /llm-pi-ai/, 'the dispatch key is the pi-ai settings namespace')
})

test('the browser half carries its styles with it', () => {
  const client = read('lib/client.js')
  assert.match(
    client,
    /data-plugin-css/,
    'an installed plugin has no build step on the user machine, so CSS must be inlined',
  )
})
