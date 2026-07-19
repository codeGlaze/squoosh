# Prebuilt distributables

Ready-to-use builds of the distro experiments (rebuild from source with each
distro's own `build.sh` / `build.mjs`).

| File                    | What it is                              | How to use                                                                                                                                                                             |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Squoosh-Windows.zip`   | Self-contained launcher (`Squoosh.exe`) | Unzip, run the exe → opens the app at localhost:8787. Unsigned → SmartScreen "More info → Run anyway"; if it vanishes, Windows Defender quarantined it (Protection history → Restore). |
| `Squoosh-macOS.zip`     | Launcher for Intel + Apple Silicon Macs | Unzip, run the matching binary. Unsigned → right-click → Open the first time.                                                                                                          |
| `Squoosh-Extension.zip` | MV3 browser extension                   | Unzip; chrome://extensions → Developer mode → Load unpacked → pick `ext/`. Keeps multithreading.                                                                                       |
| `squoosh-lite.html`     | Single self-contained HTML              | Double-click — runs off disk, no server. Single-threaded (the file:// tradeoff).                                                                                                       |

The launcher/extension serve the full app (all codecs, threads, PWA-installable);
the single-file is a lean compressor. See each distro folder for details.
