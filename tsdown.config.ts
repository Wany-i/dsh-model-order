/**
 * Build configuration for dsh-model-order.
 *
 * Two halves, two very different bundle shapes:
 *
 * - the host half (`lib/index.js`) is a plain ESM cordis plugin. It carries no
 *   behaviour at all; it exists so the bundle patch inserts a real plugin row.
 * - the browser half (`lib/client.js`) is a CommonJS factory handed to the
 *   shell's module loader as `window.__ModuleLoader__.load({ id, factory })`.
 *   React and friends stay externals resolved by that loader, so the plugin
 *   shares the host page's single React instance instead of bundling its own —
 *   two React copies would break hooks across the slot boundary.
 *
 * Official `@deepseek-ai/*` packages are never bundled either: anything needed
 * at runtime arrives through the cordis context, and everything else is a
 * type-only import that disappears at build time.
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const ID = 'dsh-model-order'

/** Platform modules the loader already owns; never bundle these. */
const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
]

/** Virtual-module id decoration keeping our CSS away from tsdown's own pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-model-order-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Host half: ESM library, no host-side behaviour. */
const libConfig: UserConfig = {
  name: ID,
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: { neverBundle: [/^@deepseek-ai\//] },
}

/** Browser half: CJS factory + platform externals + inlined CSS Modules. */
const clientConfig: UserConfig = {
  name: ID + '/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS, /^@deepseek-ai\//],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: [
    {
      name: 'dsh-model-order-css-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = resolvePath(dirname(importer ?? ''), source)
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exported] of Object.entries(cssExports ?? {})) {
          classMap[local] = exported.name
        }
        const cssBody = [
          'const css = ' + JSON.stringify(code.toString()) + ';',
          'const tagId = ' + JSON.stringify(ID + '/' + basename(fileId)) + ';',
          "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
          "  const tag = document.createElement('style');",
          '  tag.dataset.plugin = ' + JSON.stringify(ID) + ';',
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          'export default ' + JSON.stringify(classMap) + ';',
        ]
        return cssBody.join('\n')
      },
    },
  ],
  outputOptions: {
    entryFileNames: 'client.js',
    banner:
      'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [libConfig, clientConfig]
