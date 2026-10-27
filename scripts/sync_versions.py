#!/usr/bin/env python3
"""Point the docs at the current Rust crate release.

Reads the workspace version from the Rust checkout (``merkleforge/`` or ``MERKLEFORGE_RUST_DIR``),
or takes it as an argument, then updates ``versions.json``, the pinned ``merkle-*`` dependencies in
the MDX pages, and the version badge.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUST_DIR = Path(os.environ.get("MERKLEFORGE_RUST_DIR", ROOT / "merkleforge"))
VERSIONS_FILE = ROOT / "versions.json"
PAGES_DIR = ROOT / "pages"

VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
WORKSPACE_VERSION_RE = re.compile(r'(?ms)^\[workspace\.package\][^[]*?^version\s*=\s*"([^"]+)"')
# `merkle-core = "0.4.1"`, `merkle-core = { version = "0.4.1", ... }`,
# and `merkle-core = { path = "merkle-core", version = "0.4.1" }`.
DEPENDENCY_VERSION_RE = re.compile(
    r'(?m)^(?P<prefix>(?:merkle-core|merkleforge-hash|merkle-variants)\s*=\s*'
    r'(?:\{[^}\n]*?\bversion\s*=\s*)?")\d+\.\d+\.\d+(?=")'
)
BADGE_RE = re.compile(r"(<span>version</span><span>v?)\d+\.\d+\.\d+(</span>)")


def rust_version() -> str:
    """Read `[workspace.package] version` from the Rust checkout."""
    manifest = RUST_DIR / "Cargo.toml"
    match = WORKSPACE_VERSION_RE.search(manifest.read_text())
    if not match:
        raise SystemExit(f"could not read [workspace.package] version from {manifest}")
    return match.group(1)


def update_pages(version: str) -> list[Path]:
    """Rewrite pinned crate versions and the badge in every MDX page; return changed files."""
    changed = []
    for path in sorted(PAGES_DIR.rglob("*.mdx")):
        text = path.read_text()
        updated = DEPENDENCY_VERSION_RE.sub(rf"\g<prefix>{version}", text)
        updated = BADGE_RE.sub(rf"\g<1>{version}\g<2>", updated)
        if updated != text:
            path.write_text(updated)
            changed.append(path)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("version", nargs="?", help="Rust crate version (default: read from the checkout)")
    args = parser.parse_args()

    version = args.version or rust_version()
    if not VERSION_RE.fullmatch(version):
        raise SystemExit(f"invalid semantic version: {version}")

    versions = json.loads(VERSIONS_FILE.read_text())
    versions["rust"] = version
    VERSIONS_FILE.write_text(json.dumps(versions, indent=2) + "\n")

    changed = update_pages(version)
    print(f"Rust crates at v{version}; updated {len(changed)} page(s)", file=sys.stderr)


if __name__ == "__main__":
    main()
