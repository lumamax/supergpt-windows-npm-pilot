# SuperGPT for Windows 0.5.12 LAB

This LAB package installs SuperGPT into the current Windows profile. It
requires Windows x64, Node.js 22 or later with npm, and the official
ChatGPT/Codex app registered by Microsoft Store for the same user. If it is
missing, install it from [the official ChatGPT download page](https://chatgpt.com/download/).

Quit ChatGPT/Codex from its menu and run this in a regular PowerShell window
from a writable directory such as Downloads:

```powershell
npm.cmd exec --yes --ignore-scripts --package "https://raw.githubusercontent.com/lumamax/supergpt-windows-npm-pilot/v0.5.12-lab/dist/supergpt-windows-x64-0.5.12-lab.tgz" -- supergpt install
```

For offline use, download the archive, verify its SHA-256 against the published
checksum, and run from the directory with the archive:

```powershell
npm.cmd exec --offline --ignore-scripts --yes --package ".\supergpt-windows-x64-0.5.12-lab.tgz" -- supergpt install
```

Use `install --no-launch` to install and leave the apps closed. The package
uses Windows PowerShell to load the managed installation engine directly. It
requires no npm dependencies and does not prompt for elevation. Internal
maintenance code is installed with the desktop components.

The command prints the path to `supergpt-install-*.json` in the working
directory. Keep that JSON with the installation result. It
records the package and detected Core versions, transaction status, reason
codes and the result of requesting launch. It omits credentials, chat
contents, process arguments and raw exception messages. It does not upload
anything. If npm stops before starting SuperGPT, report the npm error.

`installed` means the SuperGPT transaction committed. The launch result is
reported separately. If launched from a restricted agent session, open the installed SuperGPT
shortcut from the Windows desktop if launch is pending or refused. If prompted,
sign in from the Luma tray menu and verify a Luma response in ChatGPT/Codex.

Windows supplies the registered app path. The installer checks the selected
Store volume, publisher and Core files before binding SuperGPT to the app. It only installs into a profile without an active SuperGPT
installation. It is a LAB build and has no production update channel.

## Repack from this repository

Place the matching build's `SuperGPT.Installation.module` and `module.json`
under `native/`, then run `npm pack --ignore-scripts`. The release includes
the exact runtime bytes and metadata. The tracked product commit in the metadata identifies the native engine used
for this build.
