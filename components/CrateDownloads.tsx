'use client'

import * as React from 'react'

const CRATES = ['merkle-core', 'merkleforge-hash', 'merkle-variants'] as const

type Crate = (typeof CRATES)[number]

type Counts = { downloads: number; week: number }

type State =
  | { status: 'loading' }
  | { status: 'ready'; counts: Record<Crate, Counts> }
  | { status: 'error' }

const format = new Intl.NumberFormat('en-US')

/** Sum of the last 7 days in crates.io's daily download series. */
async function lastWeek(name: string): Promise<number> {
  const response = await fetch(`https://crates.io/api/v1/crates/${name}/downloads`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const { version_downloads, meta } = await response.json()
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const days = [...version_downloads, ...(meta?.extra_downloads ?? [])]
  return days
    .filter((day: { date: string }) => day.date > since)
    .reduce((sum: number, day: { downloads: number }) => sum + day.downloads, 0)
}

/**
 * Live crates.io download counts for every published MerkleForge crate: the
 * last 7 days (ongoing use) and all time. Fetched in the browser (crates.io
 * sends `Access-Control-Allow-Origin: *`), so the numbers stay current without
 * rebuilding the static site.
 */
export function CrateDownloads() {
  const [state, setState] = React.useState<State>({ status: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    Promise.all(
      CRATES.map(async (name) => {
        const [response, week] = await Promise.all([
          fetch(`https://crates.io/api/v1/crates/${name}`),
          lastWeek(name),
        ])
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const { crate } = await response.json()
        return [name, { downloads: crate.downloads, week }] as const
      }),
    )
      .then((entries) => {
        if (!cancelled)
          setState({ status: 'ready', counts: Object.fromEntries(entries) as Record<Crate, Counts> })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const show = (pick: (counts: Counts) => number, crates: readonly Crate[] = CRATES) => {
    if (state.status === 'loading') return '…'
    if (state.status === 'error') return '—'
    return format.format(crates.reduce((sum, name) => sum + pick(state.counts[name]), 0))
  }

  return (
    <div className="mf-grid">
      <div className="mf-card mf-stat" data-variant="total">
        <div className="mf-eyebrow">Last 7 days</div>
        <div className="mf-stat-value">{show((c) => c.week)}</div>
        <div className="mf-stat-note">{show((c) => c.downloads)} all time</div>
      </div>
      {CRATES.map((name) => (
        <a
          key={name}
          className="mf-card mf-stat"
          href={`https://crates.io/crates/${name}`}
          target="_blank"
          rel="noreferrer"
        >
          <div className="mf-eyebrow mf-stat-name">{name}</div>
          <div className="mf-stat-value">{show((c) => c.week, [name])}</div>
          <div className="mf-stat-note">{show((c) => c.downloads, [name])} all time</div>
        </a>
      ))}
    </div>
  )
}
