/**
 * アプリ全体の状態。UI は useAppData() で読み、actions で更新する。
 * 更新のたびに localStorage へ保存する。
 */
import { useSyncExternalStore } from 'react'
import { nowIso } from '../domain/id'
import * as ops from '../domain/operations'
import type { Draft } from '../domain/operations'
import { applyImport, type ImportMode } from '../domain/merge'
import { emptyData, type AppData, type Collection } from '../domain/types'
import { loadData, loadMeta, saveData, saveMeta, type LocalMeta } from './storage'

interface State {
  data: AppData
  meta: LocalMeta
  /** 起動時の読み込みエラー(データ破損・新しすぎる形式など) */
  loadError: string
}

function init(): State {
  try {
    return { data: loadData(), meta: loadMeta(), loadError: '' }
  } catch (e) {
    return { data: emptyData(), meta: loadMeta(), loadError: e instanceof Error ? e.message : String(e) }
  }
}

let state: State = init()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function commitData(data: AppData) {
  // 読み込みに失敗したデータを空データで上書きしないよう、エラー時は保存しない
  if (state.loadError) throw new Error('データの読み込みに失敗しているため保存できません。')
  saveData(data)
  const meta = { ...state.meta, lastChangedAt: nowIso() }
  saveMeta(meta)
  state = { ...state, data, meta }
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, () => state.data)
}

export function useLocalMeta(): LocalMeta {
  return useSyncExternalStore(subscribe, () => state.meta)
}

export function useLoadError(): string {
  return useSyncExternalStore(subscribe, () => state.loadError)
}

export function getData(): AppData {
  return state.data
}

// 別タブで更新された場合に追従する
window.addEventListener('storage', (e) => {
  if (e.key?.startsWith('action-plan:')) {
    state = init()
    emit()
  }
})

export const actions = {
  upsert<C extends Collection>(collection: C, draft: Draft<C>) {
    const { data, record } = ops.upsert(state.data, collection, draft)
    commitData(data)
    return record
  },
  remove(collection: Collection, id: string) {
    commitData(ops.remove(state.data, collection, id))
  },
  setFinalGoal(caseId: string, content: string, deadline: string) {
    commitData(ops.setFinalGoal(state.data, caseId, content, deadline))
  },
  setActionStatus(actionId: string, status: Parameters<typeof ops.setActionStatus>[2]) {
    commitData(ops.setActionStatus(state.data, actionId, status))
  },
  importData(incoming: AppData, mode: ImportMode) {
    if (state.loadError) state = { ...state, loadError: '' } // 読み込みで復旧する場合を許可
    commitData(applyImport(state.data, incoming, mode))
  },
  markBackedUp() {
    const meta = { ...state.meta, lastBackupAt: nowIso() }
    saveMeta(meta)
    state = { ...state, meta }
    emit()
  },
}
