# TensorGrid Codex Setup

Standalone Windows Electron installer for configuring the official Codex CLI and ChatGPT Desktop Codex mode to use TensorGrid.

## Development

```powershell
npm install
npm test
npm start
```

`start` first syncs the current TensorGrid design tokens, official logo assets and bundled fonts from the repository. If the installer is checked out on its own, the portable snapshots under `source-assets` are used, so no parent monorepo is required. The renderer is standalone vanilla Electron and has no remote font, analytics or telemetry dependency.

## Windows package

```powershell
npm run package:win
```

The Windows build is a per-user NSIS installer. Packaging also runs the installer tests and asset sync, and uses the TensorGrid icon for the executable, installer, uninstaller, desktop shortcut and Start Menu shortcut.

The first-run UI defaults to English and supports English, فارسی and العربية. The language choice is stored locally in the renderer. Theme defaults to System and supports System, Light and Dark; all text, controls and status states are keyboard-accessible and respect `prefers-reduced-motion`.

The installer reads `CODEX_HOME` when set and otherwise uses `%USERPROFILE%\\.codex`.

On launch it inspects the user-level Codex configuration and shows whether the active route is ChatGPT/OpenAI or TensorGrid. When TensorGrid is already configured, the stored key is checked with the read-only `GET /v1/models` request and the UI does not ask for the key again.

While the native ChatGPT Desktop process (`ChatGPT.exe`) is running, all file-changing controls are disabled. The installer never terminates ChatGPT. After the user quits it from the system tray, the state refreshes automatically.

Enabling TensorGrid creates a timestamped, user-protected backup and a metadata-only activation manifest. `Revert to ChatGPT` restores the exact pre-TensorGrid `config.toml` and `.env` state, while preserving `auth.json` byte-for-byte and timestamp-for-timestamp. If the files were changed outside the installer after activation, the UI asks for explicit confirmation; the current files are backed up before the original state is restored.
