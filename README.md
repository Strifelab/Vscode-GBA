# GBA Emulator for VS Code

![GBA Emulator icon](media/store-icon.png)

Play Game Boy Advance games without leaving your editor. GBA Emulator brings a lightweight, in-editor handheld experience to VS Code with quick ROM loading, save support, and a compact Activity Bar entry designed for everyday use.

Built on the [gbajs](https://github.com/endrift/gbajs) core by Jeffrey Pfau (endrift).

## Highlights

- Embedded GBA emulator in the VS Code Activity Bar
- Fast ROM loading from your local filesystem
- Pause, resume, reset, and stop controls
- Screenshots directly from the running game
- Save states with import and export support
- Standard `.sav` import and export for compatibility with other tools
- Automatic internal saving between VS Code sessions
- Optional workspace `.sav` output for easier file-based backup
- Adjustable emulator volume
- Keyboard-first gameplay
- Multilingual interface support

## Getting Started

### Install from source

```bash
git clone <repository-url>
cd vscode-gba
npm install
npm run build
```

Open the project in VS Code and press `F5` to launch the extension in development mode, or package it manually with:

```bash
npx @vscode/vsce package
```

to generate a `.vsix` file for local installation.

## How It Works

1. After installation, a GBA icon appears in the Activity Bar.
2. Open the view to load a ROM and start playing.
3. Use the view controls or Command Palette actions to manage gameplay and save data.
4. Click the game canvas and use your keyboard to control the emulator.

## Keyboard Controls

| Key        | GBA Action |
| ---------- | ---------- |
| Arrow keys | D-Pad      |
| Z          | A          |
| X          | B          |
| A          | L          |
| S          | R          |
| Enter      | Start      |
| Backslash  | Select     |

## Available Commands

All commands are available from the Command Palette (`Ctrl+Shift+P`):

| Command                   | Description                               |
| ------------------------- | ----------------------------------------- |
| `GBA: Load ROM`           | Open a file picker to select a ROM        |
| `GBA: Pause`              | Pause the running emulator                |
| `GBA: Resume`             | Resume gameplay                           |
| `GBA: Reset`              | Restart the current session               |
| `GBA: Stop`               | Stop the emulator                         |
| `GBA: Screenshot`         | Capture the current frame                 |
| `GBA: Save State`         | Save a full emulator snapshot             |
| `GBA: Load State`         | Restore the most recent internal snapshot |
| `GBA: Export State`       | Export a snapshot as `.gbastate`          |
| `GBA: Import State`       | Import a `.gbastate` snapshot             |
| `GBA: Export Save (.sav)` | Export the current battery save           |
| `GBA: Import Save (.sav)` | Import a battery save                     |

## Settings

| Setting                  | Type    | Default | Description                                                   |
| ------------------------ | ------- | ------- | ------------------------------------------------------------- |
| `gbaEmulator.volume`     | number  | 50      | Default emulator volume (0-100)                               |
| `gbaEmulator.saveToFile` | boolean | false   | Automatically save progress as a `.sav` file in the workspace |
| `gbaEmulator.debug`      | boolean | false   | Enable detailed console logs for troubleshooting              |

## Compatibility Notes

- No external BIOS file is required; the extension provides a minimal built-in BIOS.
- ROM files should use `.gba` or `.bin` format.
- Audio may require a user interaction before playback starts because of browser autoplay restrictions.
- Performance depends on the Electron/Chromium runtime used by VS Code.

## License

BSD-2-Clause

- Original emulator core: Copyright © 2012-2013 Jeffrey Pfau
- VS Code extension: Copyright © 2024-2026 Strifelab
