# AGENTS.md

This file gives coding agents repository-specific guidance for the MerkleForge
docs. It applies to the entire repository unless a deeper `AGENTS.md`
overrides it.

## Project overview

This is the [Vocs](https://vocs.dev) website and documentation for MerkleForge,
published at <https://1888-labs.github.io/MerkleForge/>. It documents two
libraries with the same trees, hashes, and proof formats:

- the Rust crates in [1888-Labs/MerkleForge](https://github.com/1888-Labs/MerkleForge)
  (`merkle-core`, `merkleforge-hash`, `merkle-variants`), the reference
  implementation;
- the TypeScript packages in
  [1888-Labs/MerkleForge-ts](https://github.com/1888-Labs/MerkleForge-ts)
  (`@merkleforge/*` on npm).

## Repository map

- `pages/`: MDX pages. `pages/index.mdx` is the landing page; guides are in
  `pages/docs/`.
- `components/`: React components. `Lang.tsx` is the site-wide Rust /
  TypeScript switch; `CrateDownloads.tsx` and `NpmDownloads.tsx` fetch live
  download counts in the browser.
- `pages/_root.css`: site styles, including the language-switch rules.
- `vocs.config.ts`: site config, navigation, and base path (`/MerkleForge`).
- `versions.json` and `scripts/sync_versions.py`: the current Rust crate
  version and the script that applies it to install snippets and the badge.
- `scripts/build_site.py`: builds the site and adds the Rust crates' Criterion
  reports for deployment.
- `.github/workflows/`: `ci.yml` builds pull requests; `deploy.yml` publishes
  to the `gh-pages` branch of 1888-Labs/MerkleForge.

## Writing rules

- Keep both languages accurate. Language-specific content goes in `<Rust>` /
  `<TypeScript>` blocks; neutral prose stays outside them.
- Ground every API in the library source. Read the Rust crate or the
  TypeScript package before documenting a function, and do not invent APIs.
- Run every snippet you add or change: compile Rust snippets against the
  current crates, and run TypeScript snippets against the current packages.
- Say when a feature exists in only one language instead of implying parity.
- Keep the security notice accurate: MerkleForge has not completed an
  independent security audit.
- Do not hand-edit crate versions; run `scripts/sync_versions.py`.

## Checks

```sh
npm run build
```

For layout changes, look at the built site at desktop and phone widths, in
both languages.

## Git and pull requests

- Integration branch is `main`; merging deploys the live site.
- Conventional Commits: `docs: ...`, `fix(landing): ...`, `ci: ...`.
- Never commit secrets, tokens, or credentials, and do not describe deployment
  credentials in the docs.
- Do not push, force-push, or merge unless the user explicitly asks.
