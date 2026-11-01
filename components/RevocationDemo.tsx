'use client'

import { toHex, utf8 } from '@merkleforge/core'
import { keccak256 } from '@merkleforge/ethereum'
import { Keccak256 } from '@merkleforge/hash'
import { type SparseMerkleProof, SparseMerkleTree } from '@merkleforge/variants'
import * as React from 'react'
import { short } from './demo-utils'

const STATUS = utf8('revoked')
const defaultRevoked = ['cert-2041', 'cert-2077', 'did:example:mallory', 'api-key-9f3c']

const keyOf = (id: string) => keccak256(utf8(id))

type Answer = {
  id: string
  revoked: boolean
  verified: boolean
  proof: SparseMerkleProof
  nonEmpty: number
  root: string
}

/**
 * A revocation list as a sparse Merkle tree: each revoked ID sits at
 * `keccak256(id)`. Anyone holding only the root can check a proof that an ID
 * is revoked (membership) or not revoked (non-membership).
 */
export function RevocationDemo() {
  const treeRef = React.useRef<SparseMerkleTree | null>(null)
  const [revoked, setRevoked] = React.useState<string[]>([])
  const [newId, setNewId] = React.useState('')
  const [query, setQuery] = React.useState('cert-2041')
  const [answer, setAnswer] = React.useState<Answer | null>(null)
  const [root, setRoot] = React.useState('')

  const sync = React.useCallback(() => {
    const tree = treeRef.current as SparseMerkleTree
    setRoot(toHex(tree.root() ?? tree.emptyRoot()))
  }, [])

  React.useEffect(() => {
    const tree = new SparseMerkleTree(Keccak256)
    tree.batchInsert(defaultRevoked.map((id) => [keyOf(id), STATUS] as const))
    treeRef.current = tree
    setRevoked(defaultRevoked)
    sync()
  }, [sync])

  function revoke(id: string) {
    const tree = treeRef.current
    if (!tree || id.length === 0 || revoked.includes(id)) return
    tree.insert(keyOf(id), STATUS)
    setRevoked([...revoked, id])
    setNewId('')
    setAnswer(null)
    sync()
  }

  function reinstate(id: string) {
    const tree = treeRef.current
    if (!tree) return
    tree.remove(keyOf(id))
    setRevoked(revoked.filter((r) => r !== id))
    setAnswer(null)
    sync()
  }

  function ask() {
    const tree = treeRef.current
    if (!tree || query.trim().length === 0) return
    const id = query.trim()
    const key = keyOf(id)
    const proof = tree.generateMembershipProof(key)
    const trustedRoot = tree.root() ?? tree.emptyRoot()
    const isRevoked = proof.leaf !== null
    // A verifier with only the root, the ID, and the proof:
    const verified = isRevoked
      ? SparseMerkleTree.verifyMembership(Keccak256, trustedRoot, key, STATUS, proof)
      : SparseMerkleTree.verifyNonMembership(Keccak256, trustedRoot, key, proof)
    setAnswer({
      id,
      revoked: isRevoked,
      verified,
      proof,
      nonEmpty: proof.siblings.filter((s) => s !== null).length,
      root: toHex(trustedRoot),
    })
  }

  return (
    <div className="mf-demo">
      <div className="mf-stack">
        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">1 · Issuer maintains the revocation list</div>
          <div>
            <label className="mf-label" htmlFor="mf-revoke-id">
              Revoke an ID (certificate serial, DID, API key, …)
            </label>
            <div className="mf-input-row">
              <input
                className="mf-input"
                id="mf-revoke-id"
                onChange={(e) => setNewId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && revoke(newId.trim())}
                placeholder="cert-3001"
                spellCheck={false}
                value={newId}
              />
              <button className="mf-button" onClick={() => revoke(newId.trim())} type="button">
                Revoke
              </button>
            </div>
          </div>
          <ul className="mf-tag-list">
            {revoked.map((id) => (
              <li key={id}>
                <span className="mf-mono">{id}</span>
                <button
                  aria-label={`Reinstate ${id}`}
                  className="mf-tag-remove"
                  onClick={() => reinstate(id)}
                  type="button"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <dl className="mf-kv">
            <dt>Revoked IDs</dt>
            <dd className="mf-mono">{revoked.length}</dd>
            <dt>Published root</dt>
            <dd className="mf-mono">{root}</dd>
          </dl>
        </div>
      </div>

      <div className="mf-card mf-stack">
        <div className="mf-row" style={{ justifyContent: 'space-between' }}>
          <div className="mf-eyebrow">2 · Verifier checks one ID</div>
          {answer && (
            <span className="mf-pill" data-state={answer.verified ? 'ok' : 'bad'}>
              {answer.verified ? 'Proof verified' : 'Proof rejected'}
            </span>
          )}
        </div>
        <div>
          <label className="mf-label" htmlFor="mf-revoke-query">
            ID to check
          </label>
          <div className="mf-input-row">
            <input
              className="mf-input"
              id="mf-revoke-query"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              spellCheck={false}
              value={query}
            />
            <button className="mf-button" data-variant="accent" onClick={ask} type="button">
              Check
            </button>
          </div>
        </div>
        {answer && (
          <>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
              {answer.id} is {answer.revoked ? 'revoked' : 'not revoked'}
            </p>
            <dl className="mf-kv">
              <dt>Proof type</dt>
              <dd className="mf-mono">{answer.revoked ? 'membership' : 'non-membership'}</dd>
              <dt>Key</dt>
              <dd className="mf-mono">{short(toHex(answer.proof.key), 12)}</dd>
              <dt>Siblings</dt>
              <dd className="mf-mono">
                {answer.proof.siblings.length} levels · {answer.nonEmpty} non-empty
              </dd>
              <dt>Checked against</dt>
              <dd className="mf-mono">{answer.root}</dd>
            </dl>
            <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
              The key space has 2<sup>256</sup> slots, so the proof always covers 256 levels. All
              but {answer.nonEmpty} of them are empty subtrees, which the verifier rebuilds from
              precomputed hashes. That is why a proof that something is <em>absent</em> is as
              cheap as a proof that it is present, which a plain list or Bloom filter cannot give
              you.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
