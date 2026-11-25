# SuperGPT for Windows 0.5.10 LAB

This npm package performs the first per-user installation of SuperGPT. It
requires Windows x64, Node.js 22 or later with npm and the official ChatGPT/Codex
app installed for the testing user. Use a regular PowerShell window in that
user's signed-in desktop session. Quit ChatGPT/Codex and SuperGPT from their
menus before running. Use a writable directory such as Downloads.

Run from PowerShell in a writable directory:

```powershell
npm.cmd exec --yes --ignore-scripts --package "https://raw.githubusercontent.com/lumamax/supergpt-windows-npm-pilot/v0.5.10-lab/dist/supergpt-windows-x64-0.5.10-lab.tgz" -- supergpt install
```

The tagged repository includes the archive and its SHA-256 under `dist/` for offline use.
From the directory with the downloaded file, run:

```powershell
npm.cmd exec --offline --yes --ignore-scripts --package ".\supergpt-windows-x64-0.5.10-lab.tgz" -- supergpt install
```

Use `install --no-launch` to install and leave the apps closed. The package
uses Windows PowerShell to load the managed installation engine directly. It
requires no npm dependencies and does not prompt for elevation. Internal
maintenance code is installed with the desktop components.

The command prints the path to `supergpt-install-*.json` in the working
directory. Send that JSON back to the person who gave you the package. It
records the package and detected Core versions, transaction status, reason
codes and the result of requesting launch. It omits credentials, chat
contents, process arguments and raw exception messages. It does not upload
anything. If npm stops before starting SuperGPT, report the npm error.

`installed` means the SuperGPT transaction committed. The launch result is
reported separately. If prompted, sign in from the Luma tray menu and verify
a Luma response in ChatGPT/Codex.

This pilot uses the same Store/Core compatibility checks as the desktop
product. It only installs into a profile without an active SuperGPT
installation. It is a LAB build and has no production update channel.

## Repack from the tagged archive

Extract `package/native/` from the tagged archive into `native/`, then run
`npm pack --ignore-scripts`. The archive in `dist/` includes the exact runtime bytes and metadata. The module metadata identifies the native engine used for this build.
