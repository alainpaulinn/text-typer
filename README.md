# Text Typer

Text Typer is a small Windows desktop app for typing pasted text into another focused application, character by character. It is useful when a target field blocks paste, handles paste badly, or needs realistic keyboard input.

The app is built with Tauri, Rust, React, Tailwind CSS, and shadcn-style UI components.

## Features

- Paste or write text in the app, then type it into the currently focused target window.
- Configurable countdown before typing starts.
- Large racing-style countdown numbers that grow and fade over each second.
- Configurable delay between characters.
- Stop an active typing run.
- Clear the current text.
- Keep the window always on top.
- Compact frameless window with draggable top bar.
- Minimize and close controls with large top-right click targets.
- Orange accent theme and custom app icon.

## Requirements

- Windows.
- Node.js 20 or newer.
- Rust stable toolchain.
- Tauri Windows prerequisites, including Microsoft Edge WebView2.

## Install Dependencies

```powershell
npm install
```

## Run For Development

This starts the Vite dev server and launches the Tauri desktop app:

```powershell
npm run tauri -- dev
```

Frontend-only build check:

```powershell
npm run build
```

Rust backend check:

```powershell
cd src-tauri
cargo check
```

## Build For Production

From the repository root:

```powershell
npm run tauri -- build
```

The production executable is created at:

```text
src-tauri/target/release/text-typer.exe
```

Installers are created at:

```text
src-tauri/target/release/bundle/nsis/Text Typer_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Text Typer_0.1.0_x64_en-US.msi
```

## Make Builds Visible On GitHub

GitHub does not show local build outputs automatically. Build output folders such as `dist/` and `src-tauri/target/` are intentionally ignored by git because they are generated artifacts.

Use GitHub Actions to build the app on GitHub and publish the outputs.

This repository includes `.github/workflows/windows-build.yml`:

- On every push or pull request, GitHub builds the Windows app and uploads the `.exe`, `.msi`, and setup `.exe` as workflow artifacts.
- On a tag that starts with `v`, GitHub also creates a Release and attaches the same build outputs as downloadable release assets.

To publish a release build:

```powershell
git add .
git commit -m "Prepare Windows build"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

After the workflow finishes, open the repository on GitHub:

- For normal builds: go to `Actions`, open the latest workflow run, and download the artifact.
- For release builds: go to `Releases`, open the tag release, and download the attached installer or executable.

## How It Works

The React frontend collects the text and settings. The Tauri Rust backend receives a start command, waits through the countdown, then sends keyboard input through the Windows `SendInput` API. Newline and tab characters are sent as real `Enter` and `Tab` key events.

Typing goes to whatever application has focus after the countdown. Start the run, click the target field during the countdown, and let Text Typer send the characters.
