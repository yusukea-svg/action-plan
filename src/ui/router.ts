/**
 * ハッシュ方式の簡易ルーター(#/cases/xxx)。
 * 静的ホスティングでもリロード時に 404 にならない。
 */
import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'list' }
  | { name: 'case'; id: string; tab: CaseTab }
  | { name: 'week' }
  | { name: 'data' }

export type CaseTab = 'info' | 'goals' | 'actions'
const TABS: CaseTab[] = ['info', 'goals', 'actions']

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'cases' && parts[1]) {
    const tab = TABS.includes(parts[2] as CaseTab) ? (parts[2] as CaseTab) : 'info'
    return { name: 'case', id: decodeURIComponent(parts[1]), tab }
  }
  if (parts[0] === 'week') return { name: 'week' }
  if (parts[0] === 'data') return { name: 'data' }
  return { name: 'list' }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'case':
      return `#/cases/${encodeURIComponent(route.id)}/${route.tab}`
    case 'week':
      return '#/week'
    case 'data':
      return '#/data'
    default:
      return '#/'
  }
}

export function navigate(route: Route, replace = false) {
  if (replace) location.replace(href(route))
  else location.hash = href(route)
}

function subscribe(l: () => void) {
  window.addEventListener('hashchange', l)
  return () => window.removeEventListener('hashchange', l)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash)
  return parseRoute(hash)
}
