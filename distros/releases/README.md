# Prebuilt distributables

Ready-to-use builds of the distro experiments (rebuild from source with each
distro's own `build.sh` / `build.mjs`).

| File                    | What it is                              | How to use                                                                                                                                                                             |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Squoosh-Windows.zip`   | Self-contained launcher (`Squoosh.exe`) | Unzip, run the exe → opens the app at localhost:8787. Unsigned → SmartScreen "More info → Run anyway"; if it vanishes, Windows Defender quarantined it (Protection history → Restore). |
| `Squoosh-macOS.zip`     | Launcher for Intel + Apple Silicon Macs | Unzip, run the matching binary. Unsigned → right-click → Open the first time.                                                                                                          |
| `Squoosh-Extension.zip` | MV3 browser extension                   | Unzip; chrome://extensions → Developer mode → Load unpacked → pick `ext/`. Keeps multithreading.                                                                                       |
| `squoosh-lite.html`     | Single self-contained HTML              | Double-click — runs off disk, no server. Single-threaded (the file:// tradeoff).                                                                                                       |
| `Squoosh-Linux.deb`     | Tauri desktop app (Debian/Ubuntu)       | `sudo dpkg -i Squoosh-Linux.deb` (or open in your software installer), then launch "Squoosh". A real native window, not a browser tab.                                                 |

The launcher/extension serve the full app (all codecs, threads, PWA-installable);
the single-file is a lean compressor. See each distro folder for details.

## Tauri desktop apps (native windows)

`Squoosh-Linux.deb` is built by the Tauri project in `../tauri`. The other
native installers — Windows (`.msi` / `.exe`), macOS (`.dmg` / `.app`), and the
Linux `.AppImage` — are built on native runners by the
`.github/workflows/tauri-desktop.yml` CI workflow (each OS needs its own
packager, so they can't be cross-built here). Trigger it from the Actions tab
("Build Tauri desktop apps" → Run workflow) and download the installers from the
run's artifacts.

The `.deb` was verified locally end-to-end; the AppImage step only fails in this
sandbox because it downloads `AppRun` from GitHub, which the outbound proxy
blocks — CI runners fetch it fine.
