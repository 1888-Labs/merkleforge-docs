'use client'

import * as React from 'react'

const PACKAGES = ['@merkleforge/core', '@merkleforge/hash', '@merkleforge/variants'] as const

/** Every published package, for the total. */
const ALL_PACKAGES = [
  ...PACKAGES,
  '@merkleforge/hash-wasm',
  '@merkleforge/ethereum',
  '@merkleforge/openzeppelin',
] as const

type Package = (typeof ALL_PACKAGES)[number]

type Counts = { downloads: number; recent: number }

type State =
  | { status: 'loading' }
  | { status: 'ready'; counts: Record<Package, Counts> }
  | { status: 'error' }

/** The `@merkleforge` scope's first publish; npm counts nothing before it. */
const FIRST_PUBLISH = '2026-10-18'

const format = new Intl.NumberFormat('en-US')

async function downloads(period: string, name: string): Promise<number> {
  const response = await fetch(`https://api.npmjs.org/downloads/point/${period}/${name}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()).downloads ?? 0
}

/**
 * Live npm download counts for the `@merkleforge` packages. Fetched in the
 * browser (api.npmjs.org sends `Access-Control-Allow-Origin: *`), like
 * `CrateDownloads`, so the numbers stay current without rebuilding the site.
 */
export function NpmDownloads() {
  const [state, setState] = React.useState<State>({ status: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    const today = new Date().toISOString().slice(0, 10)
    Promise.all(
      ALL_PACKAGES.map(async (name) => {
        const [total, recent] = await Promise.all([
          downloads(`${FIRST_PUBLISH}:${today}`, name),
          downloads('last-month', name),
        ])
        return [name, { downloads: total, recent }] as const
      }),
    )
      .then((entries) => {
        if (!cancelled)
          setState({
            status: 'ready',
            counts: Object.fromEntries(entries) as Record<Package, Counts>,
          })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const show = (pick: (counts: Counts) => number, packages: readonly Package[] = ALL_PACKAGES) => {
    if (state.status === 'loading') return '…'
    if (state.status === 'error') return '—'
    return format.format(packages.reduce((sum, name) => sum + pick(state.counts[name]), 0))
  }

  return (
    <div className="mf-grid">
      <div className="mf-card mf-stat" data-variant="total">
        <div className="mf-eyebrow">Total downloads</div>
        <div className="mf-stat-value">{show((c) => c.downloads)}</div>
        <div className="mf-stat-note">
          {show((c) => c.recent)} in the last 30 days, across {ALL_PACKAGES.length} packages
        </div>
      </div>
      {PACKAGES.map((name) => (
        <a
          key={name}
          className="mf-card mf-stat"
          href={`https://www.npmjs.com/package/${name}`}
          target="_blank"
          rel="noreferrer"
        >
          <div className="mf-eyebrow">{name}</div>
          <div className="mf-stat-value">{show((c) => c.downloads, [name])}</div>
          <div className="mf-stat-note">{show((c) => c.recent, [name])} in the last 30 days</div>
        </a>
      ))}
    </div>
  )
}
