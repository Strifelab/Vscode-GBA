import * as vscode from 'vscode';
import { SaveManager } from './saveManager';
import { getAllTranslations, getTranslationBundles, hasLocale, setLocale, t } from './i18n';

export class GbaViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gbaEmulator.emulatorView';

  private view?: vscode.WebviewView;
  private saveManager: SaveManager;
  private currentRomName: string | null = null;
  private readonly settingsKey = 'gba-settings';
  private emulatorState: 'stopped' | 'running' | 'paused' = 'stopped';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.saveManager = new SaveManager(context);
    const locale = this.getStoredLocale();
    if (locale) {
      setLocale(locale);
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'media')
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendMessage({ type: 'visibility', visible: true });
      } else {
        this.sendMessage({ type: 'visibility', visible: false });
      }
    });
  }

  public async loadRom(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'GBA ROM': ['gba', 'bin'],
        [t('allFiles')]: ['*']
      },
      title: t('selectRomFile')
    });

    if (!uris || uris.length === 0) {
      return;
    }

    const romUri = uris[0];
    const romName = romUri.path.split('/').pop() || 'unknown.gba';
    this.sendMessage({ type: 'loadRomStarted', name: romName });

    const romData = await vscode.workspace.fs.readFile(romUri);
    this.currentRomName = romName;

    // Invia ROM al webview
    this.sendMessage({
      type: 'loadRom',
      data: Array.from(romData),
      name: romName
    });

    // Carica salvataggio esistente se disponibile
    const saveData = this.saveManager.loadFromGlobalState(romName);
    if (saveData) {
      this.sendMessage({
        type: 'loadSave',
        data: Array.from(saveData)
      });
    }

    vscode.window.showInformationMessage(
      t('romLoadedSuccess', { name: romName })
    );
  }

  public pause(): void {
    this.sendMessage({ type: 'pause' });
  }

  public resume(): void {
    this.sendMessage({ type: 'resume' });
  }

  public reset(): void {
    this.sendMessage({ type: 'reset' });
  }

  public stop(): void {
    this.currentRomName = null;
    this.sendMessage({ type: 'stop' });
  }

  public screenshot(): void {
    this.sendMessage({ type: 'screenshot' });
  }

  public saveState(): void {
    if (!this.currentRomName) {
      vscode.window.showWarningMessage(t('noRomLoaded'));
      return;
    }
    this.sendMessage({ type: 'requestState', mode: 'save' });
  }

  public loadState(): void {
    if (!this.currentRomName) {
      vscode.window.showWarningMessage(t('noRomLoaded'));
      return;
    }

    const stateJson = this.saveManager.loadStateFromGlobalState(this.currentRomName);
    if (!stateJson) {
      vscode.window.showWarningMessage(t('noStateSaved'));
      return;
    }

    this.sendMessage({ type: 'loadStateStarted' });
    this.sendMessage({ type: 'loadState', stateJson });
  }

  public exportState(): void {
    if (!this.currentRomName) {
      vscode.window.showWarningMessage(t('noRomLoaded'));
      return;
    }
    this.sendMessage({ type: 'requestState', mode: 'export' });
  }

  public async importState(): Promise<void> {
    if (!this.currentRomName) {
      vscode.window.showWarningMessage(t('noRomLoaded'));
      return;
    }

    const stateJson = await this.saveManager.importState();
    if (stateJson) {
      this.sendMessage({ type: 'loadStateStarted' });
      this.sendMessage({ type: 'loadState', stateJson });
    }
  }

  public async exportSave(): Promise<void> {
    if (!this.currentRomName) {
      vscode.window.showWarningMessage(t('noSaveData'));
      return;
    }
    this.sendMessage({ type: 'requestSaveData' });
  }

  public async importSave(): Promise<void> {
    const saveData = await this.saveManager.importSave();
    if (saveData) {
      this.sendMessage({
        type: 'loadSave',
        data: Array.from(saveData)
      });
    }
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'saveData': {
        if (this.currentRomName && message.data) {
          const saveData = new Uint8Array(message.data);
          await this.saveManager.saveToGlobalState(this.currentRomName, saveData);
          await this.saveManager.autoSaveToWorkspace(this.currentRomName, saveData);
        }
        break;
      }
      case 'exportSaveData': {
        if (this.currentRomName && message.data) {
          const saveData = new Uint8Array(message.data);
          await this.saveManager.exportSave(this.currentRomName, saveData);
        } else {
          vscode.window.showWarningMessage(t('noSaveData'));
        }
        break;
      }
      case 'stateData': {
        if (!this.currentRomName || !message.stateJson) {
          vscode.window.showWarningMessage(t('noRomLoaded'));
          break;
        }

        if (message.mode === 'export') {
          await this.saveManager.exportState(this.currentRomName, message.stateJson);
        } else {
          await this.saveManager.saveStateToGlobalState(this.currentRomName, message.stateJson);
          vscode.window.showInformationMessage(t('stateSaved'));
        }
        break;
      }
      case 'settingsChanged': {
        await this.context.globalState.update(this.settingsKey, message.settings || {});
        const locale = typeof message.settings?.locale === 'string' ? message.settings.locale : undefined;
        if (locale && hasLocale(locale)) {
          setLocale(locale);
        }
        break;
      }
      case 'emulatorState': {
        await this.setEmulatorState(message.state);
        break;
      }
      case 'requestLoadState': {
        this.loadState();
        break;
      }
      case 'requestImportState': {
        await this.importState();
        break;
      }
      case 'stateLoaded': {
        vscode.window.showInformationMessage(t('stateLoaded'));
        break;
      }
      case 'screenshot': {
        if (message.dataUrl) {
          await this.saveScreenshot(message.dataUrl);
        }
        break;
      }
      case 'error': {
        vscode.window.showErrorMessage(message.text || t('romLoadError'));
        break;
      }
      case 'requestLoadRom': {
        await this.loadRom();
        break;
      }
      case 'ready': {
        // Invia le traduzioni e la configurazione al webview
        const config = vscode.workspace.getConfiguration('gbaEmulator');
        const settings = this.getSettings();
        const locale = typeof settings.locale === 'string' && hasLocale(settings.locale)
          ? settings.locale
          : 'it';
        setLocale(locale);
        this.sendMessage({
          type: 'init',
          translations: getAllTranslations(),
          translationBundles: getTranslationBundles(),
          config: {
            volume: config.get<number>('volume', 50),
            debug: config.get<boolean>('debug', false),
            enableExperimentalCheats: config.get<boolean>('enableExperimentalCheats', false),
            settings
          }
        });
        // Carica e invia il BIOS automaticamente
        await this.loadAndSendBios();
        break;
      }
    }
  }

  private async loadAndSendBios(): Promise<void> {
    try {
      const biosUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'bios', 'gba_bios.bin');
      const biosData = await vscode.workspace.fs.readFile(biosUri);
      this.sendMessage({
        type: 'loadBios',
        data: Array.from(biosData)
      });
    } catch (err) {
      // Fallback: prova dalla cartella src (dev mode)
      try {
        const biosUri = vscode.Uri.joinPath(this.extensionUri, 'src', 'bios', 'gba_bios.bin');
        const biosData = await vscode.workspace.fs.readFile(biosUri);
        this.sendMessage({
          type: 'loadBios',
          data: Array.from(biosData)
        });
      } catch {
        console.warn('[GBA] BIOS file not found, emulator will use minimal BIOS');
      }
    }
  }

  private async saveScreenshot(dataUrl: string): Promise<void> {
    const defaultName = this.currentRomName
      ? this.currentRomName.replace(/\.[^/.]+$/, '') + '_screenshot.png'
      : 'gba_screenshot.png';

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: {
        'PNG': ['png']
      }
    });

    if (!uri) {
      return;
    }

    // Converte data URL in buffer
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await vscode.workspace.fs.writeFile(uri, buffer);
    vscode.window.showInformationMessage(t('screenshotSaved'));
  }

  private sendMessage(message: any): void {
    if (this.view) {
      this.view.webview.postMessage(message);
    }
  }

  private async setEmulatorState(state: unknown): Promise<void> {
    if (state !== 'running' && state !== 'paused' && state !== 'stopped') {
      return;
    }

    if (this.emulatorState === state) {
      return;
    }

    this.emulatorState = state;
    await vscode.commands.executeCommand('setContext', 'gbaEmulator.emulatorState', state);
  }

  private getSettings(): Record<string, unknown> {
    return this.context.globalState.get<Record<string, unknown>>(this.settingsKey) || {};
  }

  private getStoredLocale(): string | undefined {
    const settings = this.context.globalState.get<Record<string, unknown>>(this.settingsKey) || {};
    const locale = settings.locale;
    return typeof locale === 'string' && hasLocale(locale) ? locale : undefined;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // In dev: media/, in produzione (VSIX): dist/media/
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, 'dist', 'media');

    // Risorse webview
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'webview.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'webview.js'));

    const nonce = getNonce();
    const gbaJsFiles = [
      'util.js',
      'core.js',
      'arm.js',
      'thumb.js',
      'mmu.js',
      'io.js',
      'audio.js',
      'video.js',
      'video/software.js',
      'irq.js',
      'keypad.js',
      'sio.js',
      'savedata.js',
      'gpio.js',
      'gba.js'
    ];
    const gbaScriptTags = gbaJsFiles
      .map((file) => {
        const fileUri = webview.asWebviewUri(
          vscode.Uri.joinPath(mediaUri, 'gbajs', ...file.split('/'))
        );
        return `<script nonce="${nonce}" src="${fileUri}"></script>`;
      })
      .join('\n    ');

    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource}; font-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>GBA Emulator</title>
</head>
<body>
    <div id="emulator-container">
        <div id="screen-container">
            <canvas id="gba-canvas" width="240" height="160"></canvas>
            <div id="screen-placeholder" class="screen-placeholder default" aria-live="polite">
                <div class="screen-placeholder-inner">
                    <div id="screen-placeholder-title" class="screen-placeholder-title">GAME BOY ADVANCE</div>
                    <div id="screen-placeholder-message" class="screen-placeholder-message">Carica una ROM per iniziare a giocare!</div>
                </div>
            </div>
            <div id="status-overlay">
                <span id="status-text"></span>
            </div>
        </div>
        <div id="controls">
            <div id="rom-info" class="hidden" aria-live="polite"></div>
            <div id="volume-control">
                <label for="volume-slider" id="volume-label">🔊</label>
                <input type="range" id="volume-slider" min="0" max="100" value="50">
            </div>
        </div>
        <div id="keyboard-info">
            <details>
                <summary>⌨️ Controlli</summary>
                <div id="controls-key-grid" class="key-grid">
                    <span class="key">↑↓←→</span><span class="key-desc">D-Pad</span>
                    <span class="key">Z</span><span class="key-desc">A</span>
                    <span class="key">X</span><span class="key-desc">B</span>
                    <span class="key">A</span><span class="key-desc">L</span>
                    <span class="key">S</span><span class="key-desc">R</span>
                    <span class="key">Enter</span><span class="key-desc">Start</span>
                    <span class="key">&#92;</span><span class="key-desc">Select</span>
                </div>
            </details>
        </div>
        <div id="settings-info">
            <details>
                <summary>Settings</summary>
                <div class="settings-panel">
                    <div class="setting-row">
                        <label for="fps-slider">FPS</label>
                        <div class="range-setting">
                            <input type="range" id="fps-slider" min="30" max="60" step="5" value="60">
                            <span id="fps-value">60</span>
                        </div>
                    </div>
                    <div class="setting-row">
                        <label id="speed-label" for="speed-select">Velocita</label>
                        <select id="speed-select">
                            <option value="1">1x</option>
                            <option value="1.5">1.5x</option>
                            <option value="2">2x</option>
                            <option value="3">3x</option>
                            <option value="5">5x</option>
                            <option value="7">7x</option>
                            <option value="10">10x</option>
                        </select>
                    </div>
                    <div class="setting-heading">Comandi</div>
                    <div id="key-bindings" class="binding-grid"></div>
                    <div class="settings-actions">
                        <button id="btn-reset-bindings" type="button">Reset comandi</button>
                    </div>
                    <div class="setting-heading">Stato</div>
                    <div class="settings-actions">
                        <button id="btn-save-state" type="button">Salva stato</button>
                        <button id="btn-load-state" type="button">Carica stato</button>
                        <button id="btn-export-state" type="button">Esporta stato</button>
                        <button id="btn-import-state" type="button">Importa stato</button>
                    </div>
                </div>
            </details>
        </div>
    </div>
    ${gbaScriptTags}
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
