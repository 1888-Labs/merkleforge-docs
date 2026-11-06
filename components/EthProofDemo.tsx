'use client'

import { toHex } from '@merkleforge/core'
import {
  type EthGetProofResponse,
  toBytes32,
  type VerifiedEthProof,
  verifyEthGetProof,
} from '@merkleforge/ethereum'
import * as React from 'react'
import fixture from './fixtures/mainnet-proofs.json'
import { formatMs, short } from './demo-utils'

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
const DEFAULT_RPC = 'https://ethereum-rpc.publicnode.com'

type Source = {
  label: string
  blockNumber: number
  stateRoot: string
  response: EthGetProofResponse
}

const bundled: Source = {
  label: `Bundled: mainnet block ${fixture.blockNumber.toLocaleString('en-US')}`,
  blockNumber: fixture.blockNumber,
  stateRoot: fixture.stateRoot,
  response: fixture.contract as EthGetProofResponse,
}

type Tamper = 'none' | 'balance' | 'storage' | 'proof'

const TAMPERS: { id: Tamper; label: string }[] = [
  { id: 'none', label: 'Honest response' },
  { id: 'balance', label: 'RPC lies about the balance' },
  { id: 'storage', label: 'RPC lies about a storage value' },
  { id: 'proof', label: 'RPC corrupts a proof node' },
]

function tamper(response: EthGetProofResponse, how: Tamper): EthGetProofResponse {
  const r: EthGetProofResponse = JSON.parse(JSON.stringify(response))
  if (how === 'balance') r.balance = `0x${(BigInt(r.balance) * 2n + 1n).toString(16)}`
  if (how === 'storage' && r.storageProof[0]) {
    r.storageProof[0].value = `0x${(BigInt(r.storageProof[0].value) + 1n).toString(16)}`
  }
  if (how === 'proof' && r.accountProof.length > 0) {
    const last = r.accountProof.length - 1
    const node = r.accountProof[last] as string
    r.accountProof[last] = `${node.slice(0, -2)}${node.endsWith('00') ? '01' : '00'}`
  }
  return r
}

/** Solidity short string (< 32 bytes) stored in one slot, or `null`. */
function shortString(value: bigint): string | null {
  const word = toBytes32(value)
  const last = word[31] as number
  const length = last / 2
  if (last % 2 === 1 || length === 0 || length > 31) return null
  // The text sits left-aligned with zero padding up to the length byte.
  if (word.subarray(length, 31).some((b) => b !== 0)) return null
  const text = word.subarray(0, length)
  if (text.some((b) => b < 0x20 || b > 0x7e)) return null
  return new TextDecoder().decode(text)
}

function formatEther(wei: bigint): string {
  const whole = wei / 10n ** 18n
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4)
  return `${whole.toLocaleString('en-US')}.${frac} ETH`
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`)
  const body = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (body.error) throw new Error(`${method}: ${body.error.message}`)
  return body.result
}

/**
 * Verifies an `eth_getProof` (EIP-1186) response against a block's state root
 * with `@merkleforge/ethereum`: the account in the state trie, then each
 * storage slot in the account's storage trie.
 */
export function EthProofDemo() {
  const [source, setSource] = React.useState<Source>(bundled)
  const [how, setHow] = React.useState<Tamper>('none')
  const [rpcUrl, setRpcUrl] = React.useState(DEFAULT_RPC)
  const [address, setAddress] = React.useState(WETH)
  const [fetching, setFetching] = React.useState(false)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  type Outcome =
    | { ok: true; verified: VerifiedEthProof; ms: number }
    | { ok: false; error: string; ms: number }
  // Verified in an effect so the static HTML never disagrees with the client.
  const [outcome, setOutcome] = React.useState<Outcome | null>(null)
  React.useEffect(() => {
    const response = tamper(source.response, how)
    const start = performance.now()
    try {
      const verified = verifyEthGetProof(source.stateRoot, response)
      setOutcome({ ok: true, verified, ms: performance.now() - start })
    } catch (err) {
      setOutcome({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        ms: performance.now() - start,
      })
    }
  }, [source, how])

  async function fetchLive() {
    setFetching(true)
    setFetchError(null)
    try {
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Enter a 20-byte hex address.')
      const block = (await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false])) as {
        number: string
        stateRoot: string
      }
      const response = (await rpc(rpcUrl, 'eth_getProof', [
        address,
        ['0x0', '0x1', '0x2'],
        block.number,
      ])) as EthGetProofResponse
      const blockNumber = Number(BigInt(block.number))
      setSource({
        label: `Live: block ${blockNumber.toLocaleString('en-US')} from ${new URL(rpcUrl).host}`,
        blockNumber,
        stateRoot: block.stateRoot,
        response,
      })
      setHow('none')
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setFetching(false)
    }
  }

  const verified: VerifiedEthProof | null = outcome?.ok ? outcome.verified : null
  const slots = verified?.storage ?? []

  return (
    <div className="mf-demo">
      <div className="mf-stack">
        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">1 · Trusted input: a block's state root</div>
          <dl className="mf-kv">
            <dt>Source</dt>
            <dd className="mf-mono">{source.label}</dd>
            <dt>State root</dt>
            <dd className="mf-mono">{source.stateRoot}</dd>
            <dt>Account</dt>
            <dd className="mf-mono">{source.response.address}</dd>
            <dt>Proof size</dt>
            <dd className="mf-mono">
              {source.response.accountProof.length} account nodes ·{' '}
              {source.response.storageProof.length} storage proofs
            </dd>
          </dl>
          <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
            A light client gets the state root from a block header it trusts (from a sync
            committee or a full node it runs). Everything else comes from an untrusted RPC.
          </p>
        </div>

        <div className="mf-card mf-stack">
          <div className="mf-eyebrow">Optional · fetch a live proof</div>
          <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
            On click, your browser sends <code>eth_getBlockByNumber</code> and{' '}
            <code>eth_getProof</code> (slots 0–2) to the RPC below, a third-party service. The
            demo trusts that RPC's block header here; a real light client would check the header
            too.
          </p>
          <div>
            <label className="mf-label" htmlFor="mf-eth-rpc">
              RPC URL
            </label>
            <input
              className="mf-input"
              id="mf-eth-rpc"
              onChange={(e) => setRpcUrl(e.target.value.trim())}
              spellCheck={false}
              value={rpcUrl}
            />
          </div>
          <div>
            <label className="mf-label" htmlFor="mf-eth-address">
              Address
            </label>
            <input
              className="mf-input"
              id="mf-eth-address"
              onChange={(e) => setAddress(e.target.value.trim())}
              spellCheck={false}
              value={address}
            />
          </div>
          <div className="mf-row">
            <button
              className="mf-button"
              disabled={fetching}
              onClick={fetchLive}
              type="button"
            >
              {fetching ? 'Fetching…' : 'Fetch live proof'}
            </button>
            {source !== bundled && (
              <button className="mf-button" onClick={() => setSource(bundled)} type="button">
                Back to bundled
              </button>
            )}
          </div>
          {fetchError && <p className="mf-muted">{fetchError}</p>}
        </div>
      </div>

      <div className="mf-card mf-stack">
        <div className="mf-row" style={{ justifyContent: 'space-between' }}>
          <div className="mf-eyebrow">2 · Verify the RPC's answer</div>
          {outcome && (
            <span className="mf-pill" data-state={outcome.ok ? 'ok' : 'bad'}>
              {outcome.ok ? 'Verified' : 'Rejected'}
            </span>
          )}
        </div>
        <div>
          <label className="mf-label" htmlFor="mf-eth-tamper">
            Response
          </label>
          <select
            className="mf-select"
            id="mf-eth-tamper"
            onChange={(e) => setHow(e.target.value as Tamper)}
            value={how}
          >
            {TAMPERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {verified ? (
          <>
            <dl className="mf-kv">
              <dt>Balance</dt>
              <dd className="mf-mono">
                {verified.account ? formatEther(verified.account.balance) : 'account does not exist'}
              </dd>
              <dt>Nonce</dt>
              <dd className="mf-mono">{verified.account?.nonce.toString() ?? '–'}</dd>
              <dt>Storage root</dt>
              <dd className="mf-mono">
                {verified.account ? short(toHex(verified.account.storageRoot), 12) : '–'}
              </dd>
              <dt>Verified in</dt>
              <dd className="mf-mono">{outcome ? formatMs(outcome.ms) : '–'}</dd>
            </dl>
            {slots.length > 0 && (
              <div className="mf-table-wrap">
                <table className="mf-table">
                  <thead>
                    <tr>
                      <th>Slot</th>
                      <th>Value</th>
                      <th>As string</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s) => (
                      <tr key={toHex(s.slot)}>
                        <td className="mf-mono">{BigInt(toHex(s.slot)).toString()}</td>
                        <td className="mf-mono">{short(`0x${s.value.toString(16)}`, 10)}</td>
                        <td className="mf-mono">
                          {shortString(s.value) ?? (s.value < 1000n ? s.value.toString() : '–')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mf-muted" style={{ fontSize: 14, margin: 0 }}>
              Every field above was recomputed from the Merkle Patricia proofs and matched the
              state root. For WETH, slots 0–2 are <code>name</code>, <code>symbol</code>, and{' '}
              <code>decimals</code>.
            </p>
          </>
        ) : outcome && !outcome.ok ? (
          <p className="mf-muted" style={{ margin: 0 }}>
            <code>verifyEthGetProof</code> threw: {outcome.error}. A light client would refuse
            this response and ask another RPC.
          </p>
        ) : (
          <p className="mf-muted" style={{ margin: 0 }}>
            Verifying…
          </p>
        )}
      </div>
    </div>
  )
}
