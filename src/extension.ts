import * as vscode from 'vscode';
import { GbaViewProvider } from './GbaViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new GbaViewProvider(context.extensionUri, context);
  void vscode.commands.executeCommand('setContext', 'gbaEmulator.emulatorState', 'stopped');

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GbaViewProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Registra comandi
  context.subscriptions.push(
    vscode.commands.registerCommand('gbaEmulator.loadRom', () => provider.loadRom()),
    vscode.commands.registerCommand('gbaEmulator.pause', () => provider.pause()),
    vscode.commands.registerCommand('gbaEmulator.resume', () => provider.resume()),
    vscode.commands.registerCommand('gbaEmulator.reset', () => provider.reset()),
    vscode.commands.registerCommand('gbaEmulator.stop', () => provider.stop()),
    vscode.commands.registerCommand('gbaEmulator.screenshot', () => provider.screenshot()),
    vscode.commands.registerCommand('gbaEmulator.saveState', () => provider.saveState()),
    vscode.commands.registerCommand('gbaEmulator.loadState', () => provider.loadState()),
    vscode.commands.registerCommand('gbaEmulator.exportState', () => provider.exportState()),
    vscode.commands.registerCommand('gbaEmulator.importState', () => provider.importState()),
    vscode.commands.registerCommand('gbaEmulator.exportSave', () => provider.exportSave()),
    vscode.commands.registerCommand('gbaEmulator.importSave', () => provider.importSave())
  );
}

export function deactivate() {}
