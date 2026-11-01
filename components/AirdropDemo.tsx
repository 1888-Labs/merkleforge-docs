'use client'

import { StandardMerkleTree } from '@merkleforge/openzeppelin'
import * as React from 'react'
import { downloadText, short } from './demo-utils'

const ENCODING = ['address', 'uint256']

const defaultRows = [
  '0x1111111111111111111111111111111111111111,5000000000000000000',
  '0x2222222222222222222222222222222222222222,2500000000000000000',
  '0x3333333333333333333333333333333333333333,1000000000000000000',
  '0x4444444444444444444444444444444444444444,750000000000000000',
  '0x5555555555555555555555555555555555555555,420000000000000000',
  '0x6666666666666666666666666666666666666666,100000000000000000',
  '0x7777777777777777777777777777777777777777,64000000000000000',
  '0x8888888888888888888888888888888888888888,1000000000000000',
].join('\n')

type Row = [string, string]

function parseRows(text: string): { rows: Row[]; error: string | null } {
  const rows: Row[] = []
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (const [i, line] of lines.entries()) {
    const [address, amount, ...rest] = line.split(',').map((part) => part.trim())
    if (!address || !amount || rest.length > 0)
      return { rows, error: `Line ${i + 1}: expected "address,amount".` }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
      return { rows, error: `Line ${i + 1}: "${address}" is not a 20-byte hex address.` }
    if (!/^\d+$/.test(amount))
      return { rows, error: `Line ${i + 1}: amount must be a whole number (wei).` }
    rows.push([address.toLowerCase(), amount])
  }
  if (rows.length === 0) return { rows, error: 'Add at least one recipient.' }
  return { rows, error: null }
}

/**
 * An OpenZeppelin-compatible airdrop: `StandardMerkleTree` from
 * `@merkleforge/openzeppelin` over `[address, uint256]` rows. The root and
 * proofs are the ones OpenZeppelin's `MerkleProof.verify` accepts on-chain.
 */
export function AirdropDemo() {
  const [text, setText] = React.useState(defaultRows)
  const { rows, error } = React.useMemo(() => parseRows(text), [text])
  const tree = React.useMemo(() => {
    if (error) return null
    try {
      return StandardMerkleTree.of(rows, ENCODING)
    } catch {
      return null
    }
  }, [rows, error])

  const [index, setIndex] = React.useState(0)
  const safeIndex = Math.min(index, Math.max(rows.length - 1, 0))
  const row = rows[safeIndex]
  const [claimedAmount, setClaimedAmount] = React.useState(row?.[1] ?? '')
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the selection changes
  React.useEffect(() => setClaimedAmount(row?.[1] ?? ''), [safeIndex, row?.[0], row?.[1]])

  const proof = React.useMemo(
    () => (tree && row ? tree.getProof(safeIndex) : []),
    [tree, row, safeIndex],
  )
  const amountValid = /^\d+$/.test(claimedAmount)
  const verified =
    tree && row && amountValid
      ? StandardMerkleTree.verify(tree.root, ENCODING, [row[0], claimedAmount], proof)
      : false
  const tampered = row !== undefined && claimedAmount !== row[1]

  return (
    <div className="mf-demo">
      <div className="mf-stack">
        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">1 · Project publishes the allocation</div>
          <div>
            <label className="mf-label" htmlFor="mf-airdrop-rows">
              Recipients (address,amount in wei, one per line)
            </label>
            <textarea
              className="mf-textarea"
              id="mf-airdrop-rows"
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              value={text}
            />
          </div>
          {error && <p className="mf-muted">{error}</p>}
          {tree && (
            <>
              <dl className="mf-kv">
                <dt>Recipients</dt>
                <dd className="mf-mono">{tree.length}</dd>
                <dt>Merkle root</dt>
                <dd className="mf-mono">{tree.root}</dd>
              </dl>
              <div className="mf-row">
                <button
                  className="mf-button"
                  onClick={() =>
                    downloadText('tree.json', JSON.stringify(tree.dump(), null, 2))
                  }
                  type="button"
                >
                  Download tree.json
                </button>
                <span className="mf-muted" style={{ fontSize: 13 }}>
                  Same format as <code>@openzeppelin/merkle-tree</code>'s <code>dump()</code>.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mf-card mf-stack">
        <div className="mf-row" style={{ justifyContent: 'space-between' }}>
          <div className="mf-eyebrow">2 · A recipient claims</div>
          {tree && row && (
            <span className="mf-pill" data-state={verified ? 'ok' : 'bad'}>
              {verified ? 'Claim valid' : 'Claim rejected'}
            </span>
          )}
        </div>
        {tree && row ? (
          <>
            <div>
              <label className="mf-label" htmlFor="mf-airdrop-who">
                Claiming address
              </label>
              <select
                className="mf-select"
                id="mf-airdrop-who"
                onChange={(e) => setIndex(Number(e.target.value))}
                value={safeIndex}
              >
                {rows.map(([address], i) => (
                  <option key={`${i}-${address}`} value={i}>
                    {short(address, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mf-label" htmlFor="mf-airdrop-amount">
                Claimed amount (edit it to claim more)
              </label>
              <input
                className="mf-input"
                id="mf-airdrop-amount"
                onChange={(e) => setClaimedAmount(e.target.value.trim())}
                spellCheck={false}
                value={claimedAmount}
              />
            </div>
            <div className="mf-row">
              <button
                className="mf-button"
                disabled={!tampered}
                onClick={() => setClaimedAmount(row[1])}
                type="button"
              >
                Reset
              </button>
              <button
                className="mf-button"
                onClick={() => setClaimedAmount((BigInt(row[1]) * 10n).toString())}
                type="button"
              >
                Claim 10x
              </button>
            </div>
            <div>
              <div className="mf-label">
                Proof · {proof.length} hash{proof.length === 1 ? '' : 'es'} (what the claim
                transaction sends)
              </div>
              <ol className="mf-hash-list">
                {proof.map((hash, i) => (
                  <li className="mf-mono" key={`${i}-${hash}`} title={hash}>
                    {hash}
                  </li>
                ))}
              </ol>
            </div>
            <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
              {verified
                ? 'The leaf keccak256(keccak256(abi.encode(address, amount))) hashes up to the published root, so the contract pays out.'
                : 'The leaf for this address and amount does not hash up to the published root, so the contract reverts.'}
            </p>
          </>
        ) : (
          <p className="mf-muted">Fix the recipient list to build the tree.</p>
        )}
      </div>
    </div>
  )
}
