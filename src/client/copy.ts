/**
 * dsh-model-order — copy for the ordering area.
 *
 * The plugin ships both languages inline rather than registering a locale
 * namespace: the area is a handful of short labels, and a self-contained
 * dictionary keeps the registration to a single slot entry with no second
 * lifetime to depend on. The active language follows the page, so the area
 * matches whatever the rest of the settings panel is showing.
 */

/** One key's copy in both supported languages. */
interface Pair {
  readonly en: string
  readonly zh: string
}

const DICT = {
  title: { en: 'Model order', zh: '模型排序' },
  intro: {
    en: 'This order is what the composer model menu shows. Only the order changes; no model is added, removed or edited.',
    zh: '此顺序即消息框模型菜单显示的顺序。只调整先后次序，不新增、不删除、不修改任何模型。',
  },
  position: { en: 'Position', zh: '序号' },
  moveUp: { en: 'Move up', zh: '上移' },
  moveDown: { en: 'Move down', zh: '下移' },
  moveTop: { en: 'Move to top', zh: '置顶' },
  moveBottom: { en: 'Move to bottom', zh: '置底' },
  sortByName: { en: 'Sort by name', zh: '按名称排序' },
  restore: { en: 'Restore default order', zh: '恢复默认顺序' },
  restoreArmed: { en: 'Click again to confirm', zh: '再点一次确认' },
  restoreHint: {
    en: 'Removes this route’s model list, so it falls back to the models pi-ai ships.',
    zh: '移除该路由的模型列表，回到 pi-ai 内置目录。',
  },
  restoreBlocked: {
    en: 'Unavailable here: this route is declared by configuration and pi-ai ships no catalog for it, so removing its model list would leave it with no models at all.',
    zh: '此处不可用：该路由由配置声明、pi-ai 内置目录不覆盖它，移除模型列表会让它一个模型都不剩。',
  },
  undo: { en: 'Undo this change', zh: '撤销本次更改' },
  undoHint: {
    en: 'Puts the list back into the order it had when this card was opened. Nothing is removed.',
    zh: '把列表恢复到打开这张卡片时的顺序，不删除任何内容。',
  },
  undoNothing: {
    en: 'The order already matches the one this card was opened with.',
    zh: '当前顺序已经和打开卡片时一致。',
  },
  hidden: {
    en: 'This route has no model list of its own — it serves the models pi-ai ships, so there is nothing to reorder here.',
    zh: '该路由没有自己的模型列表（沿用 pi-ai 内置目录），因此没有可排序的内容。',
  },
  empty: {
    en: 'This route declares an empty model list.',
    zh: '该路由声明了一个空的模型列表。',
  },
  loading: { en: 'Reading settings…', zh: '正在读取设置…' },
  readOnly: {
    en: 'Settings are read-only here, so the order cannot be changed.',
    zh: '当前设置为只读，无法调整顺序。',
  },
  busy: { en: 'Saving…', zh: '保存中…' },
  refused: {
    en: 'The Host refused the change. The list below shows the stored order again.',
    zh: 'Host 拒绝了这次改动，下方已回到存储中的顺序。',
  },
  conflict: {
    en: 'The settings changed elsewhere, so this edit was refused rather than overwriting it. Try again on the refreshed list.',
    zh: '设置在别处被改动，本次编辑被拒绝以免覆盖，请基于刷新后的列表重试。',
  },
  applied: { en: 'Order saved.', zh: '顺序已保存。' },
} as const satisfies Record<string, Pair>

/** Every copy key the area uses. */
export type CopyKey = keyof typeof DICT

/**
 * Whether the page is presenting Chinese.
 *
 * Read from the document first (the page sets its own language) and fall back
 * to the browser's preference; anything unresolved stays English.
 *
 * @returns whether Chinese copy should be used.
 */
export function prefersChinese(): boolean {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement?.lang
    if (typeof lang === 'string' && lang.length > 0) return /^zh/i.test(lang)
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language
    if (typeof lang === 'string' && lang.length > 0) return /^zh/i.test(lang)
  }
  return false
}

/**
 * Resolve one copy key for the current page language.
 *
 * @param key - the copy key.
 * @param chinese - whether Chinese is preferred; read from the page when omitted.
 * @returns the localized string.
 */
export function t(key: CopyKey, chinese: boolean = prefersChinese()): string {
  const pair: Pair = DICT[key]
  return chinese ? pair.zh : pair.en
}
