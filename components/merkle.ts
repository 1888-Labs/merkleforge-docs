// Merkle proofs for the demo page, computed with the published TypeScript packages.
import { toHex, utf8 } from '@merkleforge/core'
import { Sha256 } from '@merkleforge/hash'
import { BinaryMerkleTree } from '@merkleforge/variants'

/**
 * The demo runs the real `@merkleforge/variants` `BinaryMerkleTree` with the
 * `@merkleforge/hash` `Sha256` adapter in the browser. Roots and proofs are
 * byte-identical to the Rust `BinaryMerkleTree<Sha256>` for the same rows.
 */

export type ProofSide = 'Left' | 'Right'

export type DemoResult = {
  root: string
  leafHash: string
  proof: Array<{ side: ProofSide; hash: string }>
  verified: boolean
  recomputedRoot: string
  targetLeaf: string
  leafIndex: number
  leafCount: number
}

const hex = (bytes: Uint8Array) => toHex(bytes).replace(/^0x/, '')

/** Rebuilds the root from a leaf and its proof, the way `BinaryMerkleTree.verify` does. */
function recomputeRoot(leaf: Uint8Array, proof: ReturnType<BinaryMerkleTree['generateProof']>) {
  let current = Sha256.hash(leaf)
  for (const node of proof.path) {
    current =
      node.side === 'left' ? Sha256.hashNodes(node.hash, current) : Sha256.hashNodes(current, node.hash)
  }
  return current
}

/**
 * Builds a tree from `leaves`, proves `requestedIndex`, and verifies `claimedLeaf`
 * (defaults to the real leaf) against the root using only the proof.
 */
export async function runProof(
  leaves: string[],
  requestedIndex: number,
  claimedLeaf?: string,
): Promise<DemoResult> {
  if (leaves.length === 0) throw new Error('Add at least one row before building a proof.')
  if (leaves.some((leaf) => leaf.length === 0)) throw new Error('Rows cannot be empty.')

  const leafIndex = Math.min(Math.max(requestedIndex, 0), leaves.length - 1)
  const tree = BinaryMerkleTree.fromLeaves(Sha256, leaves.map(utf8))
  const root = tree.root()
  if (!root) throw new Error('Add at least one row before building a proof.')
  const proof = tree.generateProof(leafIndex)

  const targetLeaf = claimedLeaf ?? leaves[leafIndex]
  const claimed = utf8(targetLeaf)
  // An empty claim is rejected by `verify`; show its recomputed root anyway.
  const recomputed = claimed.length > 0 ? recomputeRoot(claimed, proof) : new Uint8Array(32)

  return {
    root: hex(root),
    leafHash: hex(Sha256.hash(claimed)),
    proof: proof.path.map((node) => ({
      side: node.side === 'left' ? 'Left' : 'Right',
      hash: hex(node.hash),
    })),
    verified: BinaryMerkleTree.verify(Sha256, root, claimed, proof),
    recomputedRoot: hex(recomputed),
    targetLeaf,
    leafIndex,
    leafCount: leaves.length,
  }
}

export { hex as bytesToHex }
