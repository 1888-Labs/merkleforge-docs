'use client'

import * as React from 'react'

/** Every published `@merkleforge` package, one card each. */
const PACKAGES = [
  '@merkleforge/core',
  '@merkleforge/hash',
  '@merkleforge/variants',
  '@merkleforge/hash-wasm',
  '@merkleforge/ethereum',
  '@merkleforge/openzeppelin',
] as const

/** The same packages under their first, now deprecated, names. Counted in the total. */
const LEGACY = [
  '@1888-labs/merkle-core',
  '@1888-labs/merkle-hash',
  '@1888-labs/merkle-variants',
  '@1888-labs/merkle-hash-wasm',
  '@1888-labs/merkle-ethereum',
] as const

type Package = (typeof PACKAGES)[number] | (typeof LEGACY)[number]

type Counts = { downloads: number; recent: number }

type State =
  | { status: 'loading' }
  | { status: 'ready'; counts: Record<Package, Counts> }
  | { status: 'error' }

/** The first npm publish (as `@1888-labs/*`); npm counts nothing before it. */
const FIRST_PUBLISH = '2026-10-16'

const format = new Intl.NumberFormat('en-US')

async function downloads(period: string, name: string): Promise<number> {
  const response = await fetch(`https://api.npmjs.org/downloads/point/${period}/${name}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()).downloads ?? 0
}

/**
 * Live npm download counts for the TypeScript packages. Fetched in the browser
 * (api.npmjs.org sends `Access-Control-Allow-Origin: *`), like `CrateDownloads`,
 * so the numbers stay current without rebuilding the site.
 */
export function NpmDownloads() {
  const [state, setState] = React.useState<State>({ status: 'loading' })

  React.useEffect(() => {
    let cancelled = false
    const today = new Date().toISOString().slice(0, 10)
    Promise.all(
      [...PACKAGES, ...LEGACY].map(async (name) => {
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

  const show = (pick: (counts: Counts) => number, packages: readonly Package[]) => {
    if (state.status === 'loading') return '…'
    if (state.status === 'error') return '—'
    return format.format(packages.reduce((sum, name) => sum + pick(state.counts[name]), 0))
  }
  const all = [...PACKAGES, ...LEGACY]

  return (
    <div className="mf-grid">
      <div className="mf-card mf-stat" data-variant="total">
        <div className="mf-eyebrow">Total downloads</div>
        <div className="mf-stat-value">{show((c) => c.downloads, all)}</div>
        <div className="mf-stat-note">{show((c) => c.recent, all)} in the last 30 days</div>
      </div>
      {PACKAGES.map((name) => (
        <a
          key={name}
          className="mf-card mf-stat"
          href={`https://www.npmjs.com/package/${name}`}
          target="_blank"
          rel="noreferrer"
        >
          <div className="mf-eyebrow mf-stat-name">{name}</div>
          <div className="mf-stat-value">{show((c) => c.downloads, [name])}</div>
          <div className="mf-stat-note">{show((c) => c.recent, [name])} in the last 30 days</div>
        </a>
      ))}
      <a
        className="mf-card mf-stat"
        href="https://www.npmjs.com/org/1888-labs"
        target="_blank"
        rel="noreferrer"
      >
        <div className="mf-eyebrow mf-stat-name">@1888-labs/merkle-*</div>
        <div className="mf-stat-value">{show((c) => c.downloads, LEGACY)}</div>
        <div className="mf-stat-note">Earlier names, now deprecated</div>
      </a>
    </div>
  )
}
