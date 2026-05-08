# Contributing to GBA Emulator for VS Code

Thank you for your interest in contributing to the GBA Emulator extension for VS Code. This document provides technical details about the project architecture, development setup, and contribution guidelines.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Building the Extension](#building-the-extension)
- [Testing](#testing)
- [Code Guidelines](#code-guidelines)
- [Technical Details](#technical-details)
- [Compatibility Notes](#compatibility-notes)

## Architecture Overview

The GBA Emulator extension is built using the VS Code Extension API and integrates the [gbajs](https://github.com/endrift/gbajs) emulator core. The architecture consists of three main components:

### Extension Host (Node.js)

- **extension.ts**: Entry point that registers the webview provider and commands
- **GbaViewProvider.ts**: Manages the webview lifecycle, handles communication between VS Code and the emulator
- **SaveManager.ts**: Handles save state and battery save persistence using VS Code's global state and filesystem APIs
- **i18n**: Internationalization support with translations for multiple languages

### Webview (Browser Context)

- **webview.js**: Main webview script that initializes the emulator and handles user interactions
- **webview.css**: Styling for the emulator interface
- **gbajs core**: Collection of JavaScript modules that implement the GBA hardware emulation

### Communication Flow

1. User interacts with the VS Code UI (commands, buttons)
2. Commands are handled by `GbaViewProvider`
3. Messages are posted to the webview using the VS Code webview messaging API
4. Webview updates the emulator state and sends responses back
5. Save data is persisted through `SaveManager`

## Project Structure

```
vscode-gba/
├── src/                      # TypeScript source files
│   ├── extension.ts          # Extension activation and command registration
│   ├── GbaViewProvider.ts    # Webview provider implementation
│   ├── saveManager.ts        # Save state and battery save management
│   ├── bios/                 # Built-in BIOS file
│   └── i18n/                 # Internationalization
│       ├── index.ts          # i18n utilities
│       ├── en.ts             # English translations
│       ├── it.ts             # Italian translations
│       ├── de.ts             # German translations
│       ├── es.ts             # Spanish translations
│       └── fr.ts             # French translations
├── media/                    # Static assets
│   ├── webview.js            # Webview script (browser context)
│   ├── webview.css           # Webview styles
│   ├── icon.svg              # Activity bar icon
│   ├── store-icon.png        # Extension marketplace icon
│   └── gbajs/                # GBA emulator core modules
│       ├── core.js           # Main emulator core
│       ├── arm.js            # ARM7TDMI CPU emulation
│       ├── thumb.js          # Thumb instruction set
│       ├── mmu.js            # Memory management unit
│       ├── io.js             # I/O registers
│       ├── audio.js          # Audio processing unit
│       ├── video.js          # Video rendering
│       ├── irq.js            # Interrupt handling
│       ├── keypad.js         # Input handling
│       ├── savedata.js       # Save data management
│       ├── gpio.js           # GPIO handling
│       ├── sio.js            # Serial I/O
│       ├── util.js           # Utility functions
│       └── video/
│           └── software.js   # Software rendering
├── dist/                     # Compiled output (generated)
├── package.json              # Extension manifest and dependencies
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
└── README.md                 # User-facing documentation

```

## Development Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Visual Studio Code (v1.85.0 or higher)
- Git

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/Strifelab/Vscode-GBA.git
cd vscode-gba
```

2. Install dependencies:

```bash
npm install
```

3. Open the project in VS Code:

```bash
code .
```

4. Press `F5` to launch the extension in development mode. This will:
   - Compile the TypeScript code
   - Open a new VS Code window (Extension Development Host) with the extension loaded
   - Enable debugging with breakpoints

### Development Workflow

- **Live Reload**: Use the `watch` script to automatically rebuild on file changes:

```bash
npm run watch
```

- **Debugging**: Set breakpoints in the TypeScript code and use the VS Code debugger (`F5`)
- **Reload Extension**: In the Extension Development Host, press `Ctrl+R` (or `Cmd+R` on macOS) to reload the extension after making changes

## Building the Extension

### Development Build

Compile the extension without packaging:

```bash
npm run build
```

This uses Vite to:

- Transpile TypeScript to JavaScript
- Bundle the extension code
- Copy media files to the `dist` folder
- Generate source maps for debugging

### Production Build

Create a `.vsix` package for distribution:

```bash
npm run build-vsix
```

This will:

1. Run the production build
2. Package the extension using `@vscode/vsce`
3. Generate a `.vsix` file in the root directory

You can then install the `.vsix` file locally:

```bash
code --install-extension vscode-gba-emulator-1.0.0.vsix
```

Or publish it to the VS Code marketplace using `vsce publish`.

## Testing

### Manual Testing

1. Launch the extension in development mode (`F5`)
2. Click the GBA icon in the Activity Bar
3. Load a test ROM file
4. Verify the following functionality:
   - ROM loading and playback
   - Pause/resume/reset/stop controls
   - Keyboard input
   - Save state creation and restoration
   - Save state export/import
   - Battery save export/import
   - Screenshot capture
   - Volume adjustment
   - Settings persistence

### Test ROMs

Use homebrew ROMs or your legally owned GBA ROMs for testing. Some homebrew test ROMs are available at:

- [GBA Test Suite](https://github.com/destoer/gba-tests)
- [mGBA Test Suite](https://github.com/mgba-emu/suite)

## Code Guidelines

### TypeScript

- Use strict mode (enabled in `tsconfig.json`)
- Prefer `const` over `let` when possible
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Follow the existing code style

### Webview Security

- Always sanitize user input
- Use Content Security Policy (CSP) in webview HTML
- Validate messages between webview and extension
- Avoid inline scripts and styles

### Save Data Management

The extension uses two persistence mechanisms:

1. **Global State**: Automatic saves are stored in VS Code's global state (persists across workspaces)
2. **Filesystem**: Optional workspace saves are written to `.gba-saves/` folder

Both mechanisms are handled by the `SaveManager` class.

### Internationalization

When adding new user-facing strings:

1. Add the translation key to all language files in `src/i18n/`
2. Use the `t()` function to retrieve translations:

```typescript
import { t } from "./i18n";
const message = t("keyName");
```

3. Current supported locales: `en`, `it`, `de`, `es`, `fr`

## Technical Details

### Extension Activation

The extension activates when VS Code starts (no specific activation events). The `activate()` function in `extension.ts`:

1. Creates a `GbaViewProvider` instance
2. Registers the webview view provider
3. Registers all commands
4. Sets initial context for conditional UI

### Webview Communication

Messages are exchanged using the VS Code webview messaging API:

```typescript
// Extension to Webview
webview.postMessage({ type: "command", command: "pause" });

// Webview to Extension
webview.onDidReceiveMessage((message) => {
  if (message.type === "saveData") {
    // Handle save data
  }
});
```

### Save State Format

- **State files** (`.gbastate`): Complete emulator snapshot including RAM, registers, and save data
- **Battery saves** (`.sav`): Raw SRAM/Flash/EEPROM data compatible with other emulators

### Build System

The project uses Vite for building:

- **Library mode**: Bundles the extension as a CommonJS module
- **External dependencies**: `vscode` module is marked as external
- **Media copying**: Custom Vite plugin copies the `media` folder to `dist`

## Compatibility Notes

### BIOS

- No external BIOS file is required
- A minimal built-in BIOS is provided in `src/bios/`
- Some games may have compatibility issues without the official GBA BIOS

### ROM Formats

- Supported formats: `.gba`, `.bin`
- Compressed ROMs (`.zip`, `.gz`) are not supported

### Audio

- Audio playback requires user interaction due to browser autoplay policies
- The webview attempts to resume audio context on first user click

### Performance

- Performance depends on the Electron/Chromium runtime used by VS Code
- Modern systems should run most games at full speed
- Complex 3D games may experience slowdowns

### Browser Limitations

The emulator runs in a webview (Chromium-based), which has some limitations:

- No access to Node.js APIs from the webview
- Limited filesystem access (handled by the extension host)
- Same-origin policy restrictions

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -m "Add my feature"`
4. Push to your fork: `git push origin feature/my-feature`
5. Open a Pull Request with a clear description of your changes

### Pull Request Guidelines

- Provide a clear description of the changes
- Include screenshots or GIFs for UI changes
- Test your changes thoroughly
- Follow the existing code style
- Update documentation if needed

## License

By contributing, you agree that your contributions will be licensed under the BSD-2-Clause license.

## Questions?

If you have questions about development, feel free to open an issue on GitHub or contact the maintainers.
