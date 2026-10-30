#!/usr/bin/env python3
"""Bump the patch version, test, package, then publish to both registries.

Marketplace publish uses VSCE_PAT. Open VSX uses OVSX_PAT.
Tokens are read from the environment, then from a gitignored .env file.
They are never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = ROOT / "package.json"
PACKAGE_LOCK = ROOT / "package-lock.json"


def read_version() -> str:
    package = json.loads(PACKAGE_JSON.read_text())
    version = package["version"]
    if not isinstance(version, str):
        sys.exit("package.json version is not a string.")
    return version


def next_patch(version: str) -> str:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        sys.exit(f"Cannot bump {version}. Pass --version x.y.z.")
    major, minor, patch = parts
    return f"{major}.{minor}.{int(patch) + 1}"


def require_version(version: str) -> None:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        sys.exit(f"Version must look like x.y.z, got {version}.")


def replace_version(path: Path, current: str, target: str, count: int) -> None:
    needle = f'"version": "{current}"'
    text = path.read_text()
    found = text.count(needle)
    if found < count:
        sys.exit(f"Expected {count} occurrence(s) of {current} in {path.name}, found {found}.")
    path.write_text(text.replace(needle, f'"version": "{target}"', count))


def write_version(current: str, target: str) -> None:
    replace_version(PACKAGE_JSON, current, target, 1)
    replace_version(PACKAGE_LOCK, current, target, 2)


def load_dotenv() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def require_tokens() -> None:
    missing = [name for name in ("VSCE_PAT", "OVSX_PAT") if not os.environ.get(name)]
    if not missing:
        return
    sys.exit(
        "Missing " + ", ".join(missing) + ".\n"
        "Add them to .env in the repo root (gitignored):\n"
        "  VSCE_PAT=...\n"
        "  OVSX_PAT=..."
    )


def confirm(version: str, assume_yes: bool) -> None:
    if assume_yes:
        return
    if not sys.stdin.isatty():
        sys.exit("Pass --yes to publish without a prompt.")
    answer = input(f"Publish {version} to the Marketplace and Open VSX? [y/N] ")
    if answer.strip().lower() not in {"y", "yes"}:
        sys.exit("Cancelled.")


def run(command: list[str]) -> None:
    print("+", " ".join(command), flush=True)
    completed = subprocess.run(command, cwd=ROOT)
    if completed.returncode != 0:
        sys.exit(completed.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", help="Publish this version instead of bumping the patch number.")
    parser.add_argument(
        "--no-bump",
        action="store_true",
        help="Keep the version already in package.json.",
    )
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt.")
    args = parser.parse_args()

    if args.version and args.no_bump:
        sys.exit("Use either --version or --no-bump.")

    load_dotenv()
    require_tokens()
    current = read_version()
    target = current if args.no_bump else (args.version or next_patch(current))
    require_version(target)
    if target == current and not args.no_bump:
        sys.exit(f"{current} is already the package version. Both registries reject an existing version.")

    confirm(target, args.yes)
    run(["npm", "test"])

    if target != current:
        write_version(current, target)
        print(f"Version {current} -> {target}")

    run(["npm", "run", "package"])
    vsix = ROOT / f"task-model-advisor-{target}.vsix"
    if not vsix.is_file():
        sys.exit(f"Package was not written: {vsix.name}")

    run(["npm", "run", "publish"])
    print("+", "npx", "ovsx", "publish", vsix.name, flush=True)
    published = subprocess.run(["npx", "ovsx", "publish", vsix.name], cwd=ROOT)
    if published.returncode != 0:
        sys.exit(
            f"Marketplace already has {target}. Open VSX did not.\n"
            f"After fixing the error, publish the same file with:\n"
            f"  npx ovsx publish {vsix.name}"
        )

    print(f"Published {target} to the Marketplace and Open VSX.")


if __name__ == "__main__":
    main()
