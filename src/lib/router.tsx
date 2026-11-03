import { useCallback, useEffect, useState } from 'react'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'

/**
 * 极简 SPA 路由。
 *
 * 站点部署在 GitHub Pages 的自定义域根目录，静态 SEO 页（/data/、/china/、
 * /generations/*、/review/）是真实文件，客户端路由必须避开这些目录，
 * 所以这里用 pushState + 一份 404.html 兜底（见 scripts/spa-fallback.mjs），
 * 不引入 router 依赖，转场完全交给 AnimatePresence。
 */

const NAV_EVENT = 'atlas:route'
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export type RoutePath = '/' | '/atlas' | '/charts' | '/export' | '/ledger' | '/about'

export interface RouteMeta {
  path: RoutePath
  label: string
  title: string
  blurb: string
}

export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    label: '封面',
    title: '算力全景 · AI Compute Atlas',
    blurb: '十年算力、十代架构、整机与开源模型，落在同一条时间轴上。',
  },
  {
    path: '/atlas',
    label: '时间轴',
    title: '全景时间轴 · 算力全景',
    blurb: '五层内容压在同一根时间轴上：架构世代、芯片、整机、模型、突破。',
  },
  {
    path: '/charts',
    label: '读数',
    title: '读数：算力怎么变便宜 · 算力全景',
    blurb: '代际跃迁、单位算力价格、模型与显存的年度共振。',
  },
  {
    path: '/export',
    label: '特供版',
    title: '中国特供 GPU · 算力全景',
    blurb: '出口管制下被削掉的那几刀，以及每一款的削减点。',
  },
  {
    path: '/ledger',
    label: '复核',
    title: '复核台账 · 算力全景',
    blurb: '数据由人工抓取整理，逐条记录核对次数与最近复核时间。',
  },
  {
    path: '/about',
    label: '口径',
    title: '口径与来源 · 算力全景',
    blurb: '三份原始资料、字段口径、已知边界，以及怎么引用这份快照。',
  },
]

/** 把浏览器路径收敛成站点路由；未知路径回落到封面。 */
export function normalizePath(raw: string): RoutePath {
  let p = raw.startsWith(BASE) ? raw.slice(BASE.length) : raw
  if (!p.startsWith('/')) p = '/' + p
  p = p.toLowerCase()
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return (ROUTES.find((r) => r.path === p)?.path ?? '/') as RoutePath
}

export function hrefOf(path: string): string {
  if (path.startsWith('http') || path.startsWith('#') || path.startsWith('mailto:')) return path
  return `${BASE}${path}` || '/'
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = hrefOf(path)
  if (opts.replace) window.history.replaceState({ path }, '', url)
  else window.history.pushState({ path }, '', url)
  window.dispatchEvent(new Event(NAV_EVENT))
}

/** 当前路由 + 是否正在首次挂载（用于首屏跳过转场）。 */
export function useRoute(): { path: RoutePath; meta: RouteMeta } {
  const [path, setPath] = useState<RoutePath>(() => normalizePath(window.location.pathname))
  useEffect(() => {
    const sync = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', sync)
    window.addEventListener(NAV_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(NAV_EVENT, sync)
    }
  }, [])
  const meta = ROUTES.find((r) => r.path === path) ?? ROUTES[0]
  return { path, meta }
}

/** 站内链接：保留真实 href（新窗口、爬虫都能用），左键单击走无刷新路由。 */
export function Link({
  to,
  children,
  onClick,
  ...rest
}: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      navigate(to)
    },
    [onClick, to],
  )
  return (
    <a href={hrefOf(to)} onClick={handle} {...rest}>
      {children}
    </a>
  )
}

/** 页面级标题 / 描述 / canonical，多页之后每个路由自己声明。 */
function upsertMeta(field: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${field}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(field, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', url)
}

export function usePageMeta(meta: RouteMeta) {
  useEffect(() => {
    const url = `${window.location.origin}${hrefOf(meta.path)}`
    document.title = meta.title
    upsertMeta('name', 'description', meta.blurb)
    upsertMeta('property', 'og:title', meta.title)
    upsertMeta('property', 'og:description', meta.blurb)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', 'website')
    upsertCanonical(url)
  }, [meta])
}
