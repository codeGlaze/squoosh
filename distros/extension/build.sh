#!/usr/bin/env bash
# Assemble the loadable unpacked extension into ./ext from the repo's dist/.
set -e
cd "$(dirname "$0")"
rm -rf ext && mkdir ext
cp -r ../../dist/* ext/
rm -f ext/README.md ext/serve.json
cp manifest.json ext/manifest.json
cp ext-background.js ext/ext-background.js
# Drop the web-app manifest link (collides with the extension manifest).
sed -i 's#<link[^>]*rel="manifest"[^>]*>##g' ext/index.html
# MV3 forbids inline scripts; move Squoosh's inline bootstrap into a file.
node extract-inline.mjs ext/index.html
echo "Built ext/ — chrome://extensions -> Developer mode -> Load unpacked -> select ext/"
