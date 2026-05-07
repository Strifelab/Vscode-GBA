import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, cpSync } from "fs";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/extension.ts"),
      formats: ["cjs"],
      fileName: () => "extension.js",
    },
    outDir: "dist",
    rollupOptions: {
      external: ["vscode"],
      output: {
        // Mantieni i nomi delle esportazioni
        exports: "named",
      },
    },
    sourcemap: true,
    // Non minificare il codice dell'estensione (facilita il debug)
    minify: false,
    // Pulisci la cartella dist prima di ogni build
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "copy-media",
      closeBundle() {
        // Copia la cartella media in dist/media
        mkdirSync(resolve(__dirname, "dist/media"), { recursive: true });
        mkdirSync(resolve(__dirname, "dist/media/gbajs"), { recursive: true });
        cpSync(
          resolve(__dirname, "media"),
          resolve(__dirname, "dist/media"),
          { recursive: true }
        );
        // Copia il BIOS in dist/bios
        mkdirSync(resolve(__dirname, "dist/bios"), { recursive: true });
        copyFileSync(
          resolve(__dirname, "src/bios/gba_bios.bin"),
          resolve(__dirname, "dist/bios/gba_bios.bin")
        );
      },
    },
  ],
});
