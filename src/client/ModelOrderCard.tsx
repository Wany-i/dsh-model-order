/**
 * dsh-model-order — the ordering area rendered inside one provider card.
 *
 * The official Models page declares `settings.models.provider-card` for plugins
 * distributed outside its repository, and dispatches it once per provider card
 * with that row's directory entry. This component is that contribution.
 *
 * Two facts shape everything here:
 *
 * - **The seat renders its own block.** A slot registrant owns its own DOM; it
 *   cannot reach into the card's model rows. So the area lists the route's
 *   entries itself rather than decorating the official rows.
 * - **Only the order changes.** Every action funnels into one whole-array
 *   replacement built by `section.ts`, over entries read straight from the user
 *   layer, moved by `order.ts` — a permutation of the user's own objects.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  displayLabelOf,
  isNoopMove,
  moveModel,
  restoreOrder,
  sortModelsByName,
  type OrderMove,
} from '../order.ts'
import {
  canRestoreInheritance,
  setModelsOp,
  unsetModelsOp,
  userModelsOf,
  type PathOp,
  type ProfileEntry,
} from './section.ts'
import { t } from './copy.ts'
import styles from './order-card.module.css'

/** The provider directory row this area is handed; only these fields are read. */
export interface ProviderRowLike {
  readonly provider: string
  readonly displayName: string
  readonly settingsNs: string
  /** Hand-declared route: the installed pi-ai catalog does not describe it. */
  readonly declared?: boolean
}

/** Form facts the area renders from (a structural subset of the settings seam's snapshot). */
export interface FormSnapshotLike {
  readonly status: 'loading' | 'ready' | 'unavailable'
  readonly user: unknown
  readonly revision: number | undefined
  readonly writable: boolean
  readonly mode: 'host' | 'memory'
}

/** The business face the client entry injects into this contribution. */
export interface ModelOrderFace {
  /** Read the namespace's current form snapshot (stable reference until it changes). */
  readonly getSnapshot: () => FormSnapshotLike
  /** Observe form changes; returns the disposer. */
  readonly subscribe: (listener: () => void) => () => void
  /** Submit one atomic op list, fenced on the revision read before editing. */
  readonly apply: (
    ops: readonly PathOp[],
    expectedRevision: number | undefined,
  ) => Promise<boolean>
}

/** Stable id text of one entry; an unusable id is simply not matchable. */
function idOf(entry: ProfileEntry): string {
  return typeof entry.id === 'string' ? entry.id : ''
}

/** One move control. */
interface MoveButton {
  readonly move: OrderMove
  readonly key: 'moveUp' | 'moveDown' | 'moveTop' | 'moveBottom'
  readonly glyph: string
}

const MOVE_BUTTONS: readonly MoveButton[] = [
  { move: 'up', key: 'moveUp', glyph: '↑' },
  { move: 'down', key: 'moveDown', glyph: '↓' },
  { move: 'top', key: 'moveTop', glyph: '⇈' },
  { move: 'bottom', key: 'moveBottom', glyph: '⇊' },
]

/**
 * The provider-card extension area.
 *
 * @param props - the slot's owner share plus the injected business face.
 */
export function ModelOrderCard(
  props: ModelOrderFace & { provider: ProviderRowLike; configured: boolean },
) {
  const snapshot = useSyncExternalStore(props.subscribe, props.getSnapshot, props.getSnapshot)
  const route = props.provider.provider
  const models = useMemo(() => userModelsOf(snapshot.user, route), [snapshot.user, route])

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [armed, setArmed] = useState(false)

  // The order this card was opened with, captured once per route occurrence.
  const baseline = useRef<{ route: string; ids: string[] } | null>(null)
  useEffect(() => {
    if (models === undefined) {
      baseline.current = null
      return
    }
    if (baseline.current?.route !== route) {
      baseline.current = { route, ids: models.map(idOf) }
    }
  }, [models, route])

  // A route change re-arms nothing: the confirm state belongs to one route.
  useEffect(() => {
    setArmed(false)
    setFailure(null)
  }, [route])

  const readOnly = snapshot.status !== 'ready' || !snapshot.writable || snapshot.mode !== 'host'

  const runWrite = useCallback(
    async (ops: readonly PathOp[]) => {
      const readAt = props.getSnapshot().revision
      setBusy(true)
      setFailure(null)
      setSaved(false)
      try {
        const accepted = await props.apply(ops, readAt)
        if (accepted) {
          setSaved(true)
          return
        }
        const advanced = props.getSnapshot().revision !== readAt
        setFailure(t(advanced ? 'conflict' : 'refused'))
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error))
      } finally {
        setBusy(false)
        setArmed(false)
      }
    },
    [props.apply, props.getSnapshot],
  )

  // A card the user never configured has nothing to report, so say nothing.
  // The pi-ai family declares a card for every route it ships — dozens of them —
  // and a note on each would bury the Models page. `configured` is the page's
  // own answer to "does any layer configure this provider", so a route that
  // declares models is always configured and never silenced by this.
  if (!props.configured) return null

  if (snapshot.status === 'loading') {
    return (
      <div className={styles.section}>
        <p className={styles.note}>{t('loading')}</p>
      </div>
    )
  }

  if (models === undefined) {
    return (
      <div className={styles.section}>
        <p className={styles.note}>{t('hidden')}</p>
      </div>
    )
  }

  const disabled = readOnly || busy
  const baselineIds = baseline.current?.route === route ? baseline.current.ids : undefined
  const undoable =
    baselineIds !== undefined && models.map(idOf).join('\u0000') !== baselineIds.join('\u0000')
  const restorable = canRestoreInheritance(props.provider.declared)

  const list = models

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <span className={styles.title}>{t('title')}</span>
        <span className={styles.headActions}>
          <button
            type="button"
            className={styles.link}
            disabled={disabled || list.length < 2}
            onClick={() => {
              void runWrite([setModelsOp(route, sortModelsByName(list))])
            }}
          >
            {t('sortByName')}
          </button>
          {restorable ? (
            <button
              type="button"
              className={armed ? `${styles.link} ${styles.buttonArmed}` : styles.link}
              disabled={disabled}
              title={t('restoreHint')}
              onClick={() => {
                if (!armed) {
                  setArmed(true)
                  return
                }
                void runWrite([unsetModelsOp(route)])
              }}
            >
              {armed ? t('restoreArmed') : t('restore')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.link}
              disabled={disabled || !undoable}
              title={undoable ? t('undoHint') : t('undoNothing')}
              onClick={() => {
                void runWrite([setModelsOp(route, restoreOrder(list, baselineIds))])
              }}
            >
              {t('undo')}
            </button>
          )}
        </span>
      </div>

      {readOnly ? (
        <p className={styles.note}>{t('readOnly')}</p>
      ) : (
        <p className={styles.intro}>{t('intro')}</p>
      )}

      {!restorable && !readOnly ? (
        <p className={styles.note}>{t('restoreBlocked')}</p>
      ) : null}

      {failure !== null ? <p className={styles.failure}>{failure}</p> : null}
      {saved && failure === null ? <p className={styles.saved}>{t('applied')}</p> : null}

      {list.length === 0 ? (
        <p className={styles.note}>{t('empty')}</p>
      ) : (
        <ul className={styles.list}>
          {list.map((entry, index) => {
            const label = displayLabelOf(entry) || `#${String(index + 1)}`
            return (
              <li
                className={styles.row}
                key={idOf(entry) !== '' ? `${idOf(entry)}-${String(index)}` : `at-${String(index)}`}
              >
                <span className={styles.position} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.label} title={label}>
                  {label}
                </span>
                <span className={styles.actions}>
                  {MOVE_BUTTONS.map((button) => {
                    const blocked = disabled || isNoopMove(list.length, index, button.move)
                    const text = t(button.key)
                    return (
                      <button
                        key={button.move}
                        type="button"
                        className={styles.button}
                        disabled={blocked}
                        aria-label={`${text}: ${label}`}
                        title={text}
                        onClick={() => {
                          void runWrite([setModelsOp(route, moveModel(list, index, button.move))])
                        }}
                      >
                        <span aria-hidden="true">{button.glyph}</span>
                      </button>
                    )
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {busy ? <p className={styles.note}>{t('busy')}</p> : null}
    </div>
  )
}
