'use client'

import { type HashFunction, type MerkleProof, toHex } from '@merkleforge/core'
import { Sha256 } from '@merkleforge/hash'
import { createSha256Wasm } from '@merkleforge/hash-wasm'
import { BinaryMerkleTree } from '@merkleforge/variants'
import * as React from 'react'
import { formatBytes, formatMs, nextFrame } from './demo-utils'

const CHUNK = 64 * 1024
const SAMPLE_BYTES = 8 * 1024 * 1024

type Published = {
  name: string
  size: number
  chunks: number
  root: Uint8Array
  proofs: MerkleProof[]
  buildMs: number
  hashName: string
}

type Check = { status: ('ok' | 'bad')[]; ms: number }

function chunksOf(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = []
  for (let at = 0; at < bytes.length; at += CHUNK) out.push(bytes.subarray(at, at + CHUNK))
  return out
}

function sample(): Uint8Array {
  const bytes = new Uint8Array(SAMPLE_BYTES)
  let s = 0x9e3779b9
  for (let i = 0; i < bytes.length; i++) {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    bytes[i] = s & 0xff
  }
  return bytes
}

let wasmSha: Promise<HashFunction> | undefined
async function hasher(): Promise<HashFunction> {
  try {
    wasmSha ??= createSha256Wasm()
    return await wasmSha
  } catch {
    return Sha256
  }
}

/**
 * Chunked download verification, as in BitTorrent v2 or IPFS: the publisher
 * shares one root, and the downloader checks each 64 KiB chunk with its proof
 * as it arrives. The file never leaves the browser.
 */
export function FileIntegrityDemo() {
  const [published, setPublished] = React.useState<Published | null>(null)
  const [received, setReceived] = React.useState<Uint8Array | null>(null)
  const [check, setCheck] = React.useState<Check | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function publish(name: string, bytes: Uint8Array) {
    setError(null)
    setCheck(null)
    if (bytes.length === 0) {
      setError('That file is empty.')
      return
    }
    setBusy('Hashing chunks…')
    await nextFrame()
    const H = await hasher()
    const chunks = chunksOf(bytes)
    const start = performance.now()
    const tree = BinaryMerkleTree.fromLeaves(H, chunks)
    const proofs = chunks.map((_, i) => tree.generateProof(i))
    const buildMs = performance.now() - start
    setPublished({
      name,
      size: bytes.length,
      chunks: chunks.length,
      root: tree.root() as Uint8Array,
      proofs,
      buildMs,
      hashName: H === Sha256 ? 'SHA-256 (pure JS)' : 'SHA-256 (WebAssembly)',
    })
    setReceived(bytes.slice())
    setBusy(null)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.size > 256 * 1024 * 1024) {
      setError('Pick a file under 256 MiB for this demo.')
      return
    }
    setBusy('Reading file…')
    await publish(file.name, new Uint8Array(await file.arrayBuffer()))
  }

  function corrupt() {
    if (!received || !published) return
    const copy = received.slice()
    const chunk = Math.floor(Math.random() * published.chunks)
    const offset = chunk * CHUNK + Math.floor(Math.random() * Math.min(CHUNK, copy.length - chunk * CHUNK))
    copy[offset] = (copy[offset] as number) ^ 0x01
    setReceived(copy)
    setCheck(null)
  }

  async function verifyAll() {
    if (!received || !published) return
    setBusy('Verifying every chunk…')
    await nextFrame()
    const H = await hasher()
    const chunks = chunksOf(received)
    const start = performance.now()
    const status = chunks.map((chunk, i) =>
      BinaryMerkleTree.verify(H, published.root, chunk, published.proofs[i] as MerkleProof)
        ? ('ok' as const)
        : ('bad' as const),
    )
    setCheck({ status, ms: performance.now() - start })
    setBusy(null)
  }

  const bad = check?.status.filter((s) => s === 'bad').length ?? 0

  return (
    <div className="mf-demo">
      <div className="mf-stack">
        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">1 · Publisher commits to the file</div>
          <p className="mf-muted" style={{ margin: 0, fontSize: 14 }}>
            Pick any file. It is read locally and never uploaded.
          </p>
          <div className="mf-row">
            <label className="mf-button" htmlFor="mf-file-input">
              Choose a file
            </label>
            <input
              id="mf-file-input"
              onChange={(e) => onFile(e.target.files?.[0])}
              style={{ display: 'none' }}
              type="file"
            />
            <button
              className="mf-button"
              disabled={busy !== null}
              onClick={() => publish('sample.bin', sample())}
              type="button"
            >
              Use an 8 MiB sample
            </button>
          </div>
          {published && (
            <dl className="mf-kv">
              <dt>File</dt>
              <dd className="mf-mono">
                {published.name} · {formatBytes(published.size)}
              </dd>
              <dt>Chunks</dt>
              <dd className="mf-mono">
                {published.chunks} × 64 KiB
              </dd>
              <dt>Hash</dt>
              <dd className="mf-mono">{published.hashName}</dd>
              <dt>Tree + proofs</dt>
              <dd className="mf-mono">{formatMs(published.buildMs)}</dd>
              <dt>Trusted root</dt>
              <dd className="mf-mono">{toHex(published.root)}</dd>
            </dl>
          )}
          {error && <p className="mf-muted">{error}</p>}
        </div>
      </div>

      <div className="mf-card mf-stack">
        <div className="mf-row" style={{ justifyContent: 'space-between' }}>
          <div className="mf-eyebrow">2 · Downloader checks each chunk</div>
          {check && (
            <span className="mf-pill" data-state={bad === 0 ? 'ok' : 'bad'}>
              {bad === 0 ? 'All chunks verified' : `${bad} bad chunk${bad === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        {published ? (
          <>
            <div className="mf-row">
              <button
                className="mf-button"
                data-variant="accent"
                disabled={busy !== null}
                onClick={verifyAll}
                type="button"
              >
                Verify all chunks
              </button>
              <button
                className="mf-button"
                disabled={busy !== null}
                onClick={corrupt}
                type="button"
              >
                Corrupt a random chunk
              </button>
            </div>
            <div className="mf-chunk-grid" aria-label="Chunk status">
              {Array.from({ length: published.chunks }, (_, i) => (
                <span
                  className="mf-chunk"
                  data-state={check?.status[i] ?? 'pending'}
                  // biome-ignore lint/suspicious/noArrayIndexKey: chunks are positional
                  key={i}
                  title={`chunk ${i}: ${check?.status[i] ?? 'not checked'}`}
                />
              ))}
            </div>
            <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
              {check
                ? bad === 0
                  ? `Checked ${published.chunks} chunks against the root in ${formatMs(check.ms)}. Each chunk is verified on its own, so a client can accept chunks from untrusted peers in any order.`
                  : 'The flipped chunk no longer hashes up to the trusted root. A client would drop it and fetch that chunk again from another peer; every other chunk stays accepted.'
                : 'Each square is one chunk. Verify to check every chunk against the trusted root with its own proof.'}
            </p>
          </>
        ) : (
          <p className="mf-muted">Choose a file or the sample to start.</p>
        )}
        {busy && <p className="mf-muted">{busy}</p>}
      </div>
    </div>
  )
}
