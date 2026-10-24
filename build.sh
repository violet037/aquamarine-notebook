#!/usr/bin/env bash
set -euo pipefail

# Static build: publish only the browser-facing files.
rm -rf dist
mkdir -p dist
cp index.html dist/
cp -r css js assets dist/
if [ -f _headers ]; then
  cp _headers dist/
fi
