'use client'

import type { HashFunction, MerkleProof } from '@merkleforge/core'
import { Blake3, Keccak256, Sha256 } from '@merkleforge/hash'
import { createKeccak256Wasm, createSha256Wasm } from '@merkleforge/hash-wasm'
import { BinaryMerkleTree } from '@merkleforge/variants'
import * as React from 'react'
import { describeBrowser, formatMs, nextFrame } from './demo-utils'

type HasherId = 'keccak-js' | 'keccak-wasm' | 'sha-js' | 'sha-wasm' | 'blake3'

const HASHERS: { id: HasherId; label: string; load: () => Promise<HashFunction> }[] = [
  { id: 'keccak-js', label: 'Keccak-256 · pure JS', load: async () => Keccak256 },
  { id: 'keccak-wasm', label: 'Keccak-256 · WebAssembly', load: createKeccak256Wasm },
  { id: 'sha-js', label: 'SHA-256 · pure JS', load: async () => Sha256 },
  { id: 'sha-wasm', label: 'SHA-256 · WebAssembly', load: createSha256Wasm },
  { id: 'blake3', label: 'BLAKE3 · pure JS', load: async () => Blake3 },
]

const SIZES = [1_024, 16_384, 131_072]
const OPS = 500

type Result = {
  id: HasherId
  label: string
  buildMs: number
  proofMs: number
  verifyMs: number
}

/** Deterministic 32-byte leaves, so every run hashes the same data. */
function makeLeaves(n: number): Uint8Array[] {
  let s = n >>> 0
  return Array.from({ length: n }, () => {
    const leaf = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0
      leaf[i] = s >>> 24
    }
    return leaf
  })
}

async function measure(
  H: HashFunction,
  leaves: Uint8Array[],
): Promise<Omit<Result, 'id' | 'label'>> {
  // Warm up the JIT on a small tree so the first case is not penalised.
  BinaryMerkleTree.fromLeaves(H, leaves.slice(0, 256))
  const runs = leaves.length > 50_000 ? 1 : 3
  const builds: number[] = []
  let tree = BinaryMerkleTree.fromLeaves(H, leaves.slice(0, 1))
  for (let r = 0; r < runs; r++) {
    await nextFrame()
    const start = performance.now()
    tree = BinaryMerkleTree.fromLeaves(H, leaves)
    builds.push(performance.now() - start)
  }
  builds.sort((a, b) => a - b)
  const root = tree.root() as Uint8Array
  const indices = Array.from({ length: OPS }, (_, i) => (i * 7919) % leaves.length)

  await nextFrame()
  let start = performance.now()
  const proofs = indices.map((i) => tree.generateProof(i))
  const proofMs = (performance.now() - start) / OPS

  start = performance.now()
  let ok = true
  indices.forEach((leafIndex, k) => {
    ok =
      BinaryMerkleTree.verify(H, root, leaves[leafIndex] as Uint8Array, proofs[k] as MerkleProof) && ok
  })
  const verifyMs = (performance.now() - start) / OPS
  if (!ok) throw new Error('a proof did not verify')

  return { buildMs: builds[Math.floor(builds.length / 2)] as number, proofMs, verifyMs }
}

/**
 * Builds `BinaryMerkleTree`s with each selected hash adapter on the reader's
 * device and reports build, proof, and verify times.
 */
export function BrowserBenchmark() {
  const [size, setSize] = React.useState(16_384)
  const [selected, setSelected] = React.useState<Set<HasherId>>(
    () => new Set(HASHERS.map((h) => h.id)),
  )
  const [results, setResults] = React.useState<Result[]>([])
  const [status, setStatus] = React.useState<string | null>(null)
  const [running, setRunning] = React.useState(false)
  const [device, setDevice] = React.useState({ browser: '', cores: 0 })

  React.useEffect(() => {
    setDevice({ browser: describeBrowser(), cores: navigator.hardwareConcurrency ?? 0 })
  }, [])

  const toggle = (id: HasherId) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  async function run() {
    setRunning(true)
    setResults([])
    try {
      setStatus(`Generating ${size.toLocaleString('en-US')} leaves…`)
      await nextFrame()
      const leaves = makeLeaves(size)
      const done: Result[] = []
      for (const h of HASHERS.filter((x) => selected.has(x.id))) {
        setStatus(`Running ${h.label}…`)
        await nextFrame()
        const H = await h.load()
        const r = await measure(H, leaves)
        done.push({ id: h.id, label: h.label, ...r })
        setResults([...done])
      }
      setStatus(null)
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunning(false)
    }
  }

  const maxBuild = Math.max(...results.map((r) => r.buildMs), 0)
  const fastest = Math.min(...results.map((r) => r.buildMs))

  return (
    <div className="mf-stack" style={{ marginTop: 24 }}>
      <div className="mf-card mf-stack">
        <div className="mf-eyebrow">Settings</div>
        <div className="mf-grid" data-cols="2">
          <div>
            <label className="mf-label" htmlFor="mf-bench-size">
              Leaves
            </label>
            <select
              className="mf-select"
              disabled={running}
              id="mf-bench-size"
              onChange={(e) => setSize(Number(e.target.value))}
              value={size}
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString('en-US')} leaves (32 bytes each)
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mf-label">Your device</div>
            <div className="mf-mono" style={{ paddingTop: 10 }}>
              {device.browser || '…'}
              {device.cores ? ` · ${device.cores} logical cores` : ''}
            </div>
          </div>
        </div>
        <fieldset className="mf-checks" disabled={running}>
          <legend className="mf-label">Hash adapters</legend>
          {HASHERS.map((h) => (
            <label key={h.id} className="mf-check">
              <input checked={selected.has(h.id)} onChange={() => toggle(h.id)} type="checkbox" />
              {h.label}
            </label>
          ))}
        </fieldset>
        <div className="mf-row">
          <button
            className="mf-button"
            data-variant="accent"
            disabled={running || selected.size === 0}
            onClick={run}
            type="button"
          >
            {running ? 'Running…' : 'Run benchmark'}
          </button>
          {status && <span className="mf-muted">{status}</span>}
        </div>
      </div>

      {results.length > 0 && (
        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">
            Build time · {size.toLocaleString('en-US')} leaves · shorter is faster
          </div>
          <div className="mf-bars">
            {results.map((r) => (
              <div className="mf-bar-row" key={r.id}>
                <span className="mf-bar-label">{r.label}</span>
                <span className="mf-bar-track">
                  <span
                    className="mf-bar-fill"
                    style={{ width: `${Math.max(2, (r.buildMs / maxBuild) * 100)}%` }}
                  />
                </span>
                <span className="mf-bar-value mf-mono">{formatMs(r.buildMs)}</span>
              </div>
            ))}
          </div>
          <div className="mf-table-wrap">
            <table className="mf-table">
              <thead>
                <tr>
                  <th>Hash adapter</th>
                  <th>Build</th>
                  <th>vs fastest</th>
                  <th>Proof</th>
                  <th>Verify</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td className="mf-mono">{formatMs(r.buildMs)}</td>
                    <td className="mf-mono">{(r.buildMs / fastest).toFixed(1)}x</td>
                    <td className="mf-mono">{formatMs(r.proofMs)}</td>
                    <td className="mf-mono">{formatMs(r.verifyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
            Build is the median of {size > 50_000 ? 1 : 3} run{size > 50_000 ? '' : 's'}; proof
            and verify are the mean over {OPS} leaves. Every proof was checked against the root.
            Results depend on the <code>@merkleforge/*</code> version this site was built with, your
            browser, and what else your device is doing.
          </p>
        </div>
      )}
    </div>
  )
}
