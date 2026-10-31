#!/usr/bin/env bash
# Rebuilds index.html from src/ and the raw data in data/raw.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 src/convert.py data/raw data
python3 src/convert_frames.py data/raw data
python3 src/convert_frame_mods.py data/raw data
python3 src/convert_helminth.py data/raw data
python3 src/build.py data index.html
echo "built index.html ($(wc -c < index.html) bytes)"
