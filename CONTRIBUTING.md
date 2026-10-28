# Contributing to the MerkleForge docs

Thanks for helping improve the MerkleForge website and documentation at
<https://1888-labs.github.io/MerkleForge/>. It covers both the
[Rust crates](https://github.com/1888-Labs/MerkleForge) and the
[TypeScript packages](https://github.com/1888-Labs/MerkleForge-ts).

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Changes to the libraries themselves belong in their own repositories; see their
contributing guides. This repository is for pages, examples, the demo, and the
site build.

## Good first contributions

- Fix typos, broken links, or unclear explanations.
- Add a missing Rust or TypeScript version of an example.
- Improve the guides for a tree variant, hash function, or proof format.
- Add your project to the [projects page](pages/docs/community/projects.mdx).

## Development setup

```bash
git clone https://github.com/1888-Labs/merkleforge-docs.git
cd merkleforge-docs
npm ci
npm run dev     # http://localhost:5173/MerkleForge/
```

Pages are MDX in `pages/`; React components are in `components/`.

## Writing pages

- Show both languages where the APIs differ. Wrap language-specific content in
  `<Rust>` and `<TypeScript>` from `components/Lang.tsx`, and add `<LangBar />`
  after the intro of any page that uses them. Use `<Rust inline>` and
  `<TypeScript inline>` for API names inside a sentence.
- Rust snippets must compile against the current crates. TypeScript snippets
  must run against the current `@merkleforge/*` packages. Run every snippet you
  add or change.
- When a feature exists in only one language, say so in the other language's
  block instead of inventing an equivalent.
- Do not hand-edit crate versions in install snippets. `versions.json` and
  `scripts/sync_versions.py` keep them in step with the Rust releases.

## Required checks

Run this before opening a pull request:

```bash
npm run build
```

CI runs the same build and checks that pinned crate versions match
`versions.json`.

## Pull request guidelines

- Open pull requests against `main`. Merging deploys the site.
- Explain what changed and how you checked it. For visual changes, include a
  screenshot.
- Keep `node_modules/`, `dist/`, `_site/`, and `merkleforge/` (the local Rust
  checkout) out of commits.
- Avoid unrelated rewrites in the same pull request.

## Security

Please do not report vulnerabilities in public issues. Follow the disclosure
process in the
[Rust repository's security policy](https://github.com/1888-Labs/MerkleForge/blob/main/.github/SECURITY.md).
