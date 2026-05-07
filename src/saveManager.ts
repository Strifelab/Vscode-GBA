import * as vscode from 'vscode';
import { t } from './i18n';

export class SaveManager {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Salva i dati di salvataggio nel globalState (persistente tra sessioni)
   */
  async saveToGlobalState(romName: string, saveData: Uint8Array): Promise<void> {
    const key = this.getSaveKey(romName);
    const base64 = Buffer.from(saveData).toString('base64');
    await this.context.globalState.update(key, base64);
  }

  /**
   * Carica i dati di salvataggio dal globalState
   */
  loadFromGlobalState(romName: string): Uint8Array | null {
    const key = this.getSaveKey(romName);
    const base64 = this.context.globalState.get<string>(key);
    if (!base64) {
      return null;
    }
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /**
   * Esporta il salvataggio come file .sav nel filesystem
   */
  async exportSave(romName: string, saveData: Uint8Array): Promise<void> {
    const defaultName = romName.replace(/\.[^/.]+$/, '') + '.sav';
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: {
        'GBA Save': ['sav'],
        [t('allFiles')]: ['*']
      },
      title: t('saveSaveFile')
    });

    if (!uri) {
      return;
    }

    await vscode.workspace.fs.writeFile(uri, saveData);
    vscode.window.showInformationMessage(t('saveExported'));
  }

  /**
   * Importa un salvataggio da file .sav dal filesystem
   */
  async importSave(): Promise<Uint8Array | null> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'GBA Save': ['sav'],
        [t('allFiles')]: ['*']
      },
      title: t('selectSaveFile')
    });

    if (!uris || uris.length === 0) {
      return null;
    }

    const data = await vscode.workspace.fs.readFile(uris[0]);
    vscode.window.showInformationMessage(t('saveImported'));
    return new Uint8Array(data);
  }

  /**
   * Salva automaticamente nel workspace se l'opzione è abilitata
   */
  async autoSaveToWorkspace(romName: string, saveData: Uint8Array): Promise<void> {
    const config = vscode.workspace.getConfiguration('gbaEmulator');
    if (!config.get<boolean>('saveToFile')) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const savesDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.gba-saves');
    try {
      await vscode.workspace.fs.createDirectory(savesDir);
    } catch {
      // Directory già esistente
    }

    const saveFileName = romName.replace(/\.[^/.]+$/, '') + '.sav';
    const saveUri = vscode.Uri.joinPath(savesDir, saveFileName);
    await vscode.workspace.fs.writeFile(saveUri, saveData);
  }

  /**
   * Verifica se esiste un salvataggio per la ROM indicata
   */
  hasSave(romName: string): boolean {
    return this.loadFromGlobalState(romName) !== null;
  }

  /**
   * Rimuove un salvataggio dal globalState
   */
  async deleteSave(romName: string): Promise<void> {
    const key = this.getSaveKey(romName);
    await this.context.globalState.update(key, undefined);
  }

  async saveStateToGlobalState(romName: string, stateJson: string): Promise<void> {
    await this.context.globalState.update(this.getStateKey(romName), stateJson);
  }

  loadStateFromGlobalState(romName: string): string | null {
    return this.context.globalState.get<string>(this.getStateKey(romName)) || null;
  }

  async exportState(romName: string, stateJson: string): Promise<void> {
    const defaultName = romName.replace(/\.[^/.]+$/, '') + '.gbastate';

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: {
        'GBA State': ['gbastate', 'json'],
        [t('allFiles')]: ['*']
      },
      title: t('exportStateTitle')
    });

    if (!uri) {
      return;
    }

    await vscode.workspace.fs.writeFile(uri, Buffer.from(stateJson, 'utf8'));
    vscode.window.showInformationMessage(t('stateExported'));
  }

  async importState(): Promise<string | null> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'GBA State': ['gbastate', 'json'],
        [t('allFiles')]: ['*']
      },
      title: t('importStateTitle')
    });

    if (!uris || uris.length === 0) {
      return null;
    }

    const data = await vscode.workspace.fs.readFile(uris[0]);
    vscode.window.showInformationMessage(t('stateImported'));
    return Buffer.from(data).toString('utf8');
  }

  private getSaveKey(romName: string): string {
    return `gba-save:${romName}`;
  }

  private getStateKey(romName: string): string {
    return `gba-state:${romName}`;
  }
}
