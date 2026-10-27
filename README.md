# MerkleForge docs

Source for the MerkleForge website and documentation at
**[1888-labs.github.io/MerkleForge](https://1888-labs.github.io/MerkleForge/)**, covering the
[Rust crates](https://github.com/1888-Labs/MerkleForge) and the
[TypeScript packages](https://github.com/1888-Labs/MerkleForge-ts). Built with [Vocs](https://vocs.dev).

## Develop

```bash
npm ci
npm run dev
```

Pages are MDX in `pages/`; React components are in `components/`. Code that differs per language
goes in `<Rust>` / `<TypeScript>` blocks from `components/Lang.tsx`. Rust snippets must compile
against the current crates, and TypeScript snippets must run against the current packages.

```bash
npm run build
```

## Versions

`versions.json` holds the current Rust crate release. `scripts/sync_versions.py [version]` updates it
along with the pinned `merkle-*` dependencies and the version badge in the pages. The deploy workflow
runs it against the Rust repository's `main` and commits any change.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`, daily, and on demand. It checks out
[1888-Labs/MerkleForge](https://github.com/1888-Labs/MerkleForge) into `merkleforge/`, runs the
binary-tree Criterion benchmarks, builds the site with `scripts/build_site.py`, and pushes the result
to the `gh-pages` branch of 1888-Labs/MerkleForge. GitHub Pages serves that branch, so the public URL
stays `https://1888-labs.github.io/MerkleForge/`.

The push authenticates as the `1888labs-docs-deploy` GitHub App (Contents: write, installed only on
1888-Labs/MerkleForge), using the `PAGES_APP_ID` variable and the `PAGES_APP_PRIVATE_KEY` secret.

To build the full site locally, clone the Rust repository into `merkleforge/` (or set
`MERKLEFORGE_RUST_DIR`), run `cargo bench --bench binary_tree` there, then:

```bash
python3 scripts/build_site.py
```

## License

MIT or Apache-2.0, at your option.
