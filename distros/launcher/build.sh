#!/usr/bin/env bash
# Build the self-contained Squoosh launcher for all platforms.
# Requires Go (>=1.16 for embed). Embeds ../../dist into each binary.
set -e
cd "$(dirname "$0")"
rm -rf app && cp -r ../../dist app && rm -f app/README.md
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o Squoosh.exe .
CGO_ENABLED=0 GOOS=darwin  GOARCH=amd64 go build -ldflags="-s -w" -o Squoosh-macos-intel .
CGO_ENABLED=0 GOOS=darwin  GOARCH=arm64 go build -ldflags="-s -w" -o Squoosh-macos-apple .
CGO_ENABLED=0 GOOS=linux   GOARCH=amd64 go build -ldflags="-s -w" -o Squoosh-linux .
echo "Built self-contained binaries (each embeds the whole app)."
