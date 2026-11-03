import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Search, ShieldAlert, ShieldCheck } from 'lucide-react'

import { atlas, REVIEW_TONE, reviewCoverage, reviewOf } from '../lib/atlas'
import { hrefOf } from '../lib/router'
import { cn } from '../lib/cn'
import { CountUp, EASE_OUT, Reveal } from '../components/motion'

type Kind = 'hardware' | 'server' | 'model' | 'breakthrough'

const KIND_LABEL: Record<Kind, string> = {
  hardware: '硬件',
  server: '整机',
  model: '模型',
  breakthrough: '突破',
}

interface Row {
  id: string
  name: string
  kind: Kind
  date: string
  count: number
  last: string | null
  by: string | null
  note: string | null
}

function allRows(): Row[] {
  const pick = (items: { id: string; name: string; date: string; review?: { count: number; lastReviewedAt: string | null; by?: string | null; note?: string | null } }[], kind: Kind) =>
    items.map((r) => {
      const rv = reviewOf(r)
      return {
        id: r.id,
        name: r.name,
        kind,
        date: r.date,
        count: rv.count,
        last: rv.lastReviewedAt,
        by: rv.by ?? null,
        note: rv.note ?? null,
      }
    })
  return [
    ...pick(atlas.products, 'hardware'),
    ...pick(atlas.extras, 'hardware'),
    ...pick(atlas.servers, 'server'),
    ...pick(atlas.models, 'model'),
    ...pick(atlas.breakthroughs, 'breakthrough'),
  ]
}

const STATUS = [
  { id: 'pending', label: '未复核' },
  { id: 'reviewed', label: '已复核' },
  { id: 'all', label: '全部' },
] as const

export function LedgerPage() {
  const reduce = useReducedMotion()
  const rows = useMemo(allRows, [])
  const stats = reviewCoverage()
  const [status, setStatus] = useState<(typeof STATUS)[number]['id']>('pending')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(60)

  useEffect(() => setLimit(60), [status, kind, query])

  const coverage = stats.total ? Math.round((stats.reviewed / stats.total) * 1000) / 10 : 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (status === 'pending' && r.count > 0) return false
        if (status === 'reviewed' && r.count === 0) return false
        if (kind !== 'all' && r.kind !== kind) return false
        if (q && !r.name.toLowerCase().includes(q) && !r.id.includes(q)) return false
        return true
      })
      .sort((a, b) => a.count - b.count || b.date.localeCompare(a.date))
  }, [rows, status, kind, query])

  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-10 lg:px-8">
      <header className="pt-8">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-snow lg:text-[30px]">
          复核台账
        </h1>
        <p className="mt-2 max-w-[64ch] text-[12.5px] leading-relaxed text-fog">
          这里的数据是人工抓取、人工整理的，准确率无法完全保证。所以每条记录都单独记账：
          被核对过几次、最近一次是哪天。0 次就是「未复核」，不含糊成「已验证」。
        </p>

        <div className="mt-6 grid gap-4 border-y border-edge/40 py-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[9px] tracking-[0.16em] text-fog/55">复核覆盖</span>
              <span className="num text-[13px] text-snow">
                <CountUp value={stats.reviewed} />/{stats.total}
              </span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden bg-edge/50">
              <motion.div
                className="h-full bg-gradient-to-r from-mint to-cyan"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${Math.max(coverage, 0.6)}%` }}
                transition={{ duration: 1, ease: EASE_OUT }}
              />
            </div>
            <div className="mt-1.5 font-mono text-[9px] text-fog/45">{coverage}%</div>
          </div>
          {[
            { k: '待复核', v: stats.unreviewed },
            { k: '最近复核', v: stats.lastReviewedAt ?? '无' },
            { k: '复核人', v: atlas.reviews?.reviewer ?? '未记录' },
          ].map((s) => (
            <div key={s.k}>
              <div className="font-mono text-[9px] tracking-[0.16em] text-fog/55">{s.k}</div>
              <div className="num mt-1 text-[14px] text-snow">{s.v}</div>
            </div>
          ))}
        </div>
      </header>

      {stats.reviewed === 0 && (
        <Reveal className="mt-6">
          <div className="flex items-start gap-3 border border-amber/30 bg-amber/[0.04] p-4">
            <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber" />
            <div>
              <div className="text-[12.5px] text-amber/90">尚无复核记录</div>
              <p className="mt-1 max-w-[70ch] text-[11.5px] leading-relaxed text-fog/75">
                台账目前是空的，也就是说这 {stats.total} 条数据都只经过一次抓取，没有做过二次核对。
                下面按「未复核」列出全部条目，逐条核对后才会出现复核次数与日期。
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* filters */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1">
          {STATUS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatus(s.id)}
              className={cn(
                'relative px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] transition-colors',
                status === s.id ? 'text-snow' : 'text-fog hover:text-snow',
              )}
            >
              {status === s.id && (
                <motion.span
                  layoutId="ledger-status"
                  className="absolute inset-0 border border-cyan/40 bg-cyan/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <span className="relative">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {(['all', 'hardware', 'server', 'model', 'breakthrough'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'border px-2 py-0.5 font-mono text-[10px] transition-colors',
                kind === k
                  ? 'border-cyan/40 bg-cyan/10 text-cyan'
                  : 'border-edge/60 text-fog hover:text-snow',
              )}
            >
              {k === 'all' ? '全部类型' : KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 border border-edge/60 bg-hull/40 px-2 py-1">
          <Search size={11} className="text-fog/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜型号或 id"
            aria-label="搜索复核条目"
            className="w-36 bg-transparent font-mono text-[11px] text-snow placeholder:text-fog/40 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between border-b border-edge/40 pb-2 font-mono text-[9px] text-fog/45">
        <span>{filtered.length} 条</span>
        <span>排序：复核次数少的在前</span>
      </div>

      <ul className="divide-y divide-edge/20">
        {filtered.slice(0, limit).map((r) => {
          const reviewed = r.count > 0
          const tone = reviewed ? REVIEW_TONE.reviewed : REVIEW_TONE.pending
          const Icon = reviewed ? ShieldCheck : ShieldAlert
          return (
            <li
              key={r.id}
              className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-2.5 sm:grid-cols-[1fr_120px_150px_1fr]"
            >
              <div className="min-w-0">
                <span className="text-[12.5px] text-snow/90">{r.name}</span>
                <span className="ml-2 font-mono text-[9px] text-fog/45">{r.id}</span>
              </div>
              <div className="hidden font-mono text-[9px] text-fog/50 sm:block">
                {KIND_LABEL[r.kind]} · {r.date.slice(0, 7)}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: tone }}>
                <Icon size={10} />
                {reviewed ? `${r.count} 次` : '未复核'}
              </div>
              <div className="truncate text-right font-mono text-[9px] text-fog/50 sm:text-left">
                {r.last ?? r.note ?? ''}
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length > limit && (
        <div className="flex items-center justify-center gap-3 border-t border-edge/30 py-6">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 120)}
            className="border border-edge px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan active:scale-[0.98]"
          >
            再显示 120 条
          </button>
          <span className="font-mono text-[9px] text-fog/45">
            已显示 {Math.min(limit, filtered.length)}/{filtered.length}
          </span>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="border border-edge/40 bg-hull/30 px-4 py-10 text-center">
          <p className="text-[12px] text-fog">这个筛选条件下没有条目。</p>
          <button
            type="button"
            onClick={() => {
              setStatus('all')
              setKind('all')
              setQuery('')
            }}
            className="mt-3 border border-edge px-3 py-1.5 font-mono text-[10px] text-fog transition-colors hover:border-cyan/40 hover:text-cyan"
          >
            清空筛选
          </button>
        </div>
      )}

      <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-edge/40 pt-5">
        <p className="max-w-[60ch] font-mono text-[10px] leading-relaxed text-fog/50">
          台账在仓库的 data/reviews.json 里手工维护，构建时合入快照的 review 字段；
          纯文本版见 /review/。
        </p>
        <a
          href={hrefOf('/review/')}
          className="border border-edge px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-fog transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          文本版清单 →
        </a>
      </Reveal>
    </div>
  )
}
