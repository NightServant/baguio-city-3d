# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""Ready-made CC0 model kits for the landmarks (owner request 2026-10-05: use ready-made tree and other
assets where they exist). Downloads each kit, checks its sha256, unzips it under model/data/assets/kenney/<kit>/
and records provenance in model/sources.json. Run: uv run model/scripts/fetch_assets.py"""
import datetime
import hashlib
import subprocess
import zipfile

from common import DATA, ROOT, file_hash, load_sources, save_sources

KITS = {
    "nature-kit": ("https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip",
                   "fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d"),
    "city-kit-roads": ("https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1787042796/kenney_city-kit-roads.zip",
                       "22058af3d68173a7cf9bda9f0e243a8cef6bd68168c302ebc76327063849674e"),
    "watercraft-kit": ("https://kenney.nl/media/pages/assets/watercraft-kit/a335cfed49-1713519620/kenney_watercraft-pack.zip",
                       "cd1470c1cf441c7f46d0944ae6d0d897242365dc97677c5079b3238965d659f3"),
}
DIR = DATA / "assets" / "kenney"


def main():
    DIR.mkdir(parents=True, exist_ok=True)
    sources = load_sources()
    for kit, (url, sha) in KITS.items():
        z = DIR / f"{kit}.zip"
        if not z.exists() or file_hash(z, "sha256") != sha:
            subprocess.run(["curl", "-fSL", "--retry", "3", "-A", "baguio-city-3d/1.0", "-o", str(z), url], check=True)
        got = file_hash(z, "sha256")
        if got != sha:
            raise SystemExit(f"{kit}: sha256 {got} != {sha}")
        with zipfile.ZipFile(z) as f:
            f.extractall(DIR / kit)
        key = f"kenney-{kit}"
        if key not in sources:
            sources[key] = {"url": url, "file": str(z.relative_to(ROOT)), "sha256": sha, "bytes": z.stat().st_size,
                            "retrieved": datetime.date.today().isoformat(),
                            "licence": "Creative Commons CC0 1.0 (public domain dedication), https://creativecommons.org/publicdomain/zero/1.0/",
                            "attribution": "Kenney (www.kenney.nl), CC0; credit appreciated, not required"}
        print(f"{kit}: ok")
    save_sources(sources)


if __name__ == "__main__":
    main()
