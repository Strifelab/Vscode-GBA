// @ts-nocheck
/**
 * GBA Emulator Webview Script
 * Gestisce l'interfaccia utente, l'input e la comunicazione con l'extension host.
 */
(function () {
  "use strict";

  // Accesso all'API VS Code
  const vscode = acquireVsCodeApi();

  // Stato
  let emulator = null;
  let isRunning = false;
  let isPaused = false;
  let currentRomName = null;
  let translations = {};
  let translationBundles = {};
  let saveInterval = null;
  let debugMode = false;
  let enableExperimentalCheats = false;
  let biosData = null;
  let currentRomData = null;
  let compiledCheats = [];
  let cheatIdCounter = 0;

  // Debug logger
  function log(...args) {
    if (debugMode) {
      console.log("[GBA Debug]", ...args);
    }
  }

  function logError(...args) {
    console.error("[GBA Error]", ...args);
  }

  function reportEmulatorState() {
    const state = isRunning ? (isPaused ? "paused" : "running") : "stopped";
    vscode.postMessage({ type: "emulatorState", state });
  }

  // Elementi DOM
  const canvas = document.getElementById("gba-canvas");
  const ctx = canvas.getContext("2d");
  const statusText = document.getElementById("status-text");
  const screenPlaceholder = document.getElementById("screen-placeholder");
  const screenPlaceholderTitle = document.getElementById("screen-placeholder-title");
  const screenPlaceholderMessage = document.getElementById("screen-placeholder-message");
  const romInfo = document.getElementById("rom-info");
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");
  const screenContainer = document.getElementById("screen-container");
  const fpsSlider = document.getElementById("fps-slider");
  const fpsValue = document.getElementById("fps-value");
  const keyBindings = document.getElementById("key-bindings");
  const controlsKeyGrid = document.getElementById("controls-key-grid");
  const btnResetBindings = document.getElementById("btn-reset-bindings");
  const btnSaveState = document.getElementById("btn-save-state");
  const btnLoadState = document.getElementById("btn-load-state");
  const btnExportState = document.getElementById("btn-export-state");
  const btnImportState = document.getElementById("btn-import-state");
  let languageSelect = document.getElementById("language-select");
  let cheatNameInput = document.getElementById("cheat-name");
  let cheatCodeInput = document.getElementById("cheat-code");
  let btnAddCheat = document.getElementById("btn-add-cheat");
  let speedSelect = document.getElementById("speed-select");
  let speedLabel = document.getElementById("speed-label");
  let cheatList = document.getElementById("cheat-list");
  let cheatStatus = document.getElementById("cheat-status");
  let cheatHelp = document.getElementById("cheat-help");
  let controlsSummary = document.getElementById("controls-summary");
  let settingsSummary = document.getElementById("settings-summary");
  let languageLabel = document.getElementById("language-label");
  let commandsHeading = document.getElementById("commands-heading");
  let stateHeading = document.getElementById("state-heading");
  let cheatsHeading = document.getElementById("cheats-heading");

  // Mappatura tasti GBA
  const DEFAULT_KEY_MAP = {
    ArrowUp: "UP",
    ArrowDown: "DOWN",
    ArrowLeft: "LEFT",
    ArrowRight: "RIGHT",
    z: "A",
    Z: "A",
    x: "B",
    X: "B",
    a: "L",
    A: "L",
    s: "R",
    S: "R",
    Enter: "START",
    "\\": "SELECT",
  };

  let KEY_MAP = Object.assign({}, DEFAULT_KEY_MAP);
  let settings = {
    fps: 60,
    speed: 1,
    locale: "it",
    keyMap: Object.assign({}, DEFAULT_KEY_MAP),
    cheats: [],
  };
  let pendingBinding = null;

  const SUPPORTED_LOCALES = ["it", "en", "de", "fr", "es"];
  const SUPPORTED_SPEEDS = [1, 1.5, 2, 3, 5, 7, 10];
  const LANGUAGE_KEYS = {
    it: "italian",
    en: "english",
    de: "german",
    fr: "french",
    es: "spanish",
  };

  const GBA_BUTTONS = [
    { id: "UP", label: "D-Pad su" },
    { id: "DOWN", label: "D-Pad giù" },
    { id: "LEFT", label: "D-Pad sinistra" },
    { id: "RIGHT", label: "D-Pad destra" },
    { id: "A", label: "A" },
    { id: "B", label: "B" },
    { id: "L", label: "L" },
    { id: "R", label: "R" },
    { id: "START", label: "Start" },
    { id: "SELECT", label: "Select" },
  ];

  const KEY_BITS = {
    A: 0,
    B: 1,
    SELECT: 2,
    START: 3,
    RIGHT: 4,
    LEFT: 5,
    UP: 6,
    DOWN: 7,
    R: 8,
    L: 9,
  };

  function tr(key, fallback, params) {
    let value = translations[key] || fallback || key;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        value = value.replace(`{${paramKey}}`, String(paramValue));
      });
    }
    return value;
  }

  function setTranslationLocale(locale) {
    const nextLocale = SUPPORTED_LOCALES.includes(locale) ? locale : "it";
    settings.locale = nextLocale;
    if (translationBundles[nextLocale]) {
      translations = translationBundles[nextLocale];
    }
    document.documentElement.lang = nextLocale;
  }

  function ensureSettingsControls() {
    const settingsPanel = document.querySelector("#settings-info .settings-panel");
    if (!settingsPanel) return;

    controlsSummary = controlsSummary || document.querySelector("#keyboard-info summary");
    settingsSummary = settingsSummary || document.querySelector("#settings-info summary");

    if (!languageSelect) {
      const row = document.createElement("div");
      row.className = "setting-row";

      languageLabel = document.createElement("label");
      languageLabel.id = "language-label";
      languageLabel.setAttribute("for", "language-select");

      languageSelect = document.createElement("select");
      languageSelect.id = "language-select";
      SUPPORTED_LOCALES.forEach((locale) => {
        const option = document.createElement("option");
        option.value = locale;
        option.textContent = locale.toUpperCase();
        languageSelect.append(option);
      });

      row.append(languageLabel, languageSelect);
      settingsPanel.prepend(row);
    }

    if (!speedSelect && fpsSlider) {
      const row = document.createElement("div");
      row.className = "setting-row";

      speedLabel = document.createElement("label");
      speedLabel.id = "speed-label";
      speedLabel.setAttribute("for", "speed-select");

      speedSelect = document.createElement("select");
      speedSelect.id = "speed-select";
      SUPPORTED_SPEEDS.forEach((speed) => {
        const option = document.createElement("option");
        option.value = String(speed);
        option.textContent = formatSpeedLabel(speed);
        speedSelect.append(option);
      });

      row.append(speedLabel, speedSelect);
      const fpsRow = fpsSlider.closest(".setting-row");
      if (fpsRow && fpsRow.parentNode) {
        fpsRow.parentNode.insertBefore(row, fpsRow.nextSibling);
      } else {
        settingsPanel.prepend(row);
      }
    }

    const headings = settingsPanel.querySelectorAll(".setting-heading");
    commandsHeading = commandsHeading || headings[0] || null;
    stateHeading = stateHeading || headings[1] || null;

    if (enableExperimentalCheats && !cheatList) {
      cheatsHeading = document.createElement("div");
      cheatsHeading.id = "cheats-heading";
      cheatsHeading.className = "setting-heading";

      const form = document.createElement("div");
      form.className = "cheat-form";

      cheatNameInput = document.createElement("input");
      cheatNameInput.id = "cheat-name";
      cheatNameInput.type = "text";

      cheatCodeInput = document.createElement("textarea");
      cheatCodeInput.id = "cheat-code";
      cheatCodeInput.rows = 3;
      cheatCodeInput.spellcheck = false;

      cheatHelp = document.createElement("div");
      cheatHelp.id = "cheat-help";
      cheatHelp.className = "setting-help";

      const actions = document.createElement("div");
      actions.className = "settings-actions";
      btnAddCheat = document.createElement("button");
      btnAddCheat.id = "btn-add-cheat";
      btnAddCheat.type = "button";
      actions.append(btnAddCheat);

      form.append(cheatNameInput, cheatCodeInput, cheatHelp, actions);

      cheatStatus = document.createElement("div");
      cheatStatus.id = "cheat-status";
      cheatStatus.className = "setting-help";
      cheatStatus.setAttribute("aria-live", "polite");

      cheatList = document.createElement("div");
      cheatList.id = "cheat-list";
      cheatList.className = "cheat-list";

      settingsPanel.append(cheatsHeading, form, cheatStatus, cheatList);
    }
  }

  function bindCheatControls() {
    if (btnAddCheat && btnAddCheat.dataset.bound !== "true") {
      btnAddCheat.addEventListener("click", addCheatFromForm);
      btnAddCheat.dataset.bound = "true";
    }
  }

  // ===== INIZIALIZZAZIONE =====

  function init() {
    ensureSettingsControls();
    setStatus(tr("readyToLoadRom", "Emulatore pronto - Carica una ROM per iniziare"));
    showDefaultScreen();
    setupEventListeners();
    // Notifica l'extension host che il webview è pronto
    vscode.postMessage({ type: "ready" });
    reportEmulatorState();
  }

  function setupEventListeners() {
    volumeSlider.addEventListener("input", (e) => {
      const volume = parseInt(e.target.value) / 100;
      if (emulator) {
        setEmulatorVolume(volume);
      }
      updateVolumeIcon(parseInt(e.target.value));
    });

    volumeLabel.addEventListener("click", () => {
      if (volumeSlider.value === "0") {
        volumeSlider.value = "50";
      } else {
        volumeSlider.value = "0";
      }
      volumeSlider.dispatchEvent(new Event("input"));
    });

    fpsSlider.addEventListener("input", (e) => {
      settings.fps = parseInt(e.target.value, 10);
      applyTimingSettings();
      saveSettings();
    });

    if (speedSelect) {
      speedSelect.addEventListener("change", (e) => {
        settings.speed = sanitizeSpeed(e.target.value);
        applyTimingSettings();
        saveSettings();
      });
    }

    if (languageSelect) {
      languageSelect.addEventListener("change", (e) => {
        settings.locale = e.target.value;
        setTranslationLocale(settings.locale);
        compileCheats();
        renderSettings();
        saveSettings();
      });
    }

    btnResetBindings.addEventListener("click", () => {
      pendingBinding = null;
      settings.keyMap = Object.assign({}, DEFAULT_KEY_MAP);
      KEY_MAP = Object.assign({}, settings.keyMap);
      renderSettings();
      saveSettings();
      screenContainer.focus();
    });

    btnSaveState.addEventListener("click", () => sendStateData("save"));
    btnLoadState.addEventListener("click", () => vscode.postMessage({ type: "requestLoadState" }));
    btnExportState.addEventListener("click", () => sendStateData("export"));
    btnImportState.addEventListener("click", () => vscode.postMessage({ type: "requestImportState" }));
    bindCheatControls();

    // Keyboard input - cattura sul canvas container
    screenContainer.setAttribute("tabindex", "0");
    screenContainer.addEventListener("keydown", handleKeyDown);
    screenContainer.addEventListener("keyup", handleKeyUp);
    screenContainer.addEventListener("pointerdown", resumeAudioContext);
    screenContainer.addEventListener("focus", () => {
      screenContainer.classList.add("focused");
      resumeAudioContext();
    });
    screenContainer.addEventListener("blur", () => {
      screenContainer.classList.remove("focused");
    });
    window.addEventListener("pointerdown", resumeAudioContext, true);
    window.addEventListener("keydown", handleBindingCapture, true);
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("keyup", handleGlobalKeyUp, true);
    window.addEventListener("keydown", resumeAudioContext, true);

    // Gestione messaggi dall'extension host
    window.addEventListener("message", handleExtensionMessage);
    renderSettings();
  }

  // ===== GESTIONE MESSAGGI =====

  function handleExtensionMessage(event) {
    const message = event.data;

    switch (message.type) {
      case "init":
        translations = message.translations || {};
        translationBundles = message.translationBundles || {};
        if (message.config) {
          if (message.config.volume !== undefined) {
            volumeSlider.value = message.config.volume;
            updateVolumeIcon(message.config.volume);
          }
          if (message.config.debug !== undefined) {
            debugMode = message.config.debug;
            log("Debug mode enabled");
            // Enable debug in GBA core
            if (typeof setGBADebug === "function") {
              setGBADebug(debugMode);
            }
          }
          enableExperimentalCheats = message.config.enableExperimentalCheats === true;
          ensureSettingsControls();
          bindCheatControls();
          if (message.config.settings !== undefined) {
            applySettings(message.config.settings);
          } else {
            setTranslationLocale(settings.locale);
            renderSettings();
          }
        }
        log("Webview initialized", { translations, config: message.config });
        break;

      case "loadRom":
        loadRom(new Uint8Array(message.data), message.name);
        break;

      case "loadRomStarted":
        currentRomName = message.name || currentRomName;
        updateRomInfo();
        showLoadingScreen(tr("loadingRom", "Caricamento ROM..."));
        break;

      case "loadBios":
        biosData = new Uint8Array(message.data);
        log("BIOS loaded", { size: biosData.length });
        break;

      case "loadSave":
        loadSaveData(new Uint8Array(message.data));
        break;

      case "togglePause":
        togglePause();
        break;

      case "pause":
        pauseRunningEmulator();
        break;

      case "resume":
        resumePausedEmulator();
        break;

      case "reset":
        resetEmulator();
        break;

      case "stop":
        stopRunningEmulator();
        break;

      case "screenshot":
        takeScreenshot();
        break;

      case "requestSaveData":
        sendSaveData();
        break;

      case "requestState":
        sendStateData(message.mode || "save");
        break;

      case "loadState":
        loadStateData(message.stateJson);
        break;

      case "loadStateStarted":
        showLoadingScreen(tr("loadingState", "Caricamento stato..."));
        break;

      case "visibility":
        if (message.visible && emulator && isRunning && !isPaused) {
          startEmulator();
        } else if (!message.visible && emulator && isRunning) {
          pauseEmulator();
        }
        break;
    }
  }

  // ===== EMULATORE =====

  function loadRom(romData, romName) {
    log("loadRom called", { romName, romDataSize: romData.length });
    currentRomName = romName;
    currentRomData = romData;
    updateRomInfo();
    showLoadingScreen(tr("loadingRom", "Caricamento ROM..."));

    window.setTimeout(() => {
    try {
      if (!biosData) {
        throw new Error(tr("biosMissingError", "BIOS non caricato: attendi l'inizializzazione della WebView o verifica gba_bios.bin"));
      }

      // Inizializza l'emulatore GBA
      if (emulator) {
        log("Stopping existing emulator");
        stopEmulator();
      }

      log("Creating new GameBoyAdvance instance");
      emulator = new GameBoyAdvance();
      configureEmulatorLogging();
      applyTimingSettings();

      // Carica il BIOS se disponibile
      if (biosData) {
        log("Setting BIOS data", { size: biosData.length });
        emulator.setBios(toArrayBuffer(biosData), true);
      }

      log("Setting canvas");
      emulator.setCanvas(canvas);
      wrapDrawCallbackForScreenReady();

      // Configura volume
      const volume = parseInt(volumeSlider.value) / 100;
      log("Setting volume", volume);
      setEmulatorVolume(volume);

      // Carica la ROM
      log("Loading ROM into emulator");
      const loaded = emulator.setRom(toArrayBuffer(romData));
      if (!loaded) {
        throw new Error(tr("invalidRomError", "ROM GBA non valida o non riconosciuta"));
      }
      configureCheats();
      log("ROM loaded successfully");

      // Avvia emulazione
      log("Starting emulator");
      startEmulator();
      isRunning = true;
      isPaused = false;
      reportEmulatorState();
      log("Emulator started successfully");

      setStatus("");
      statusText.classList.add("hidden");

      // Focus sul canvas per catturare input
      screenContainer.focus();

      // Avvia auto-save periodico (ogni 30 secondi)
      startAutoSave();
    } catch (err) {
      isRunning = false;
      isPaused = false;
      reportEmulatorState();
      showDefaultScreen();
      logError("Error loading ROM:", err);
      logError("Stack trace:", err.stack);
      setStatus(tr("loadErrorPrefix", "Errore") + ": " + (err.message || tr("romLoadError", "Impossibile caricare la ROM")));
      vscode.postMessage({
        type: "error",
        text:
          "Errore nel caricamento: " + err.message + "\n" + (err.stack || ""),
      });
    }
    }, 0);
  }

  function loadSaveData(saveData) {
    if (emulator) {
      emulator.setSavedata(toArrayBuffer(saveData));
    }
  }

  function togglePause() {
    if (!emulator || !isRunning) return;

    if (isPaused) {
      resumePausedEmulator();
    } else {
      pauseRunningEmulator();
    }
  }

  function pauseRunningEmulator() {
    if (!emulator || !isRunning || isPaused) return;

    pauseEmulator();
    isPaused = true;
    reportEmulatorState();
    setStatus(translations.paused || "In pausa");
    statusText.classList.remove("hidden");
  }

  function resumePausedEmulator() {
    if (!emulator || !isRunning || !isPaused) return;

    startEmulator();
    isPaused = false;
    reportEmulatorState();
    setStatus("");
    statusText.classList.add("hidden");
    screenContainer.focus();
  }

  function resetEmulator() {
    if (!emulator) return;

    pauseEmulator();
    if (currentRomData) {
      const loaded = emulator.setRom(toArrayBuffer(currentRomData));
      if (!loaded) {
        setStatus(tr("romResetError", "Errore: impossibile resettare la ROM"));
        statusText.classList.remove("hidden");
        return;
      }
    }
    configureCheats();
    startEmulator();
    isPaused = false;
    reportEmulatorState();
    setStatus("");
    statusText.classList.add("hidden");
    screenContainer.focus();
  }

  function stopRunningEmulator() {
    if (!emulator) return;

    stopEmulator();
    emulator = null;
    isRunning = false;
    isPaused = false;
    currentRomName = null;
    currentRomData = null;
    updateRomInfo();
    stopAutoSave();
    showDefaultScreen();
    reportEmulatorState();
    screenContainer.focus();
  }

  function takeScreenshot() {
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    vscode.postMessage({ type: "screenshot", dataUrl: dataUrl });
  }

  function sendSaveData() {
    if (emulator) {
      const saveData = getSaveData();
      if (saveData) {
        vscode.postMessage({
          type: "exportSaveData",
          data: Array.from(saveData),
        });
      } else {
        vscode.postMessage({ type: "exportSaveData", data: null });
      }
    }
  }

  function startAutoSave() {
    if (saveInterval) {
      clearInterval(saveInterval);
    }
    saveInterval = setInterval(() => {
      if (emulator && isRunning) {
        const saveData = getSaveData();
        if (saveData) {
          vscode.postMessage({
            type: "saveData",
            data: Array.from(saveData),
          });
        }
      }
    }, 30000); // Salva ogni 30 secondi
  }

  function stopAutoSave() {
    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
    }
  }

  async function sendStateData(mode) {
    if (!emulator || !isRunning) {
      setStatus(tr("noRunningRom", "Nessuna ROM in esecuzione"));
      statusText.classList.remove("hidden");
      return;
    }

    const wasPaused = isPaused;
    pauseEmulator();

    try {
      const state = await serializeStateForJson(emulator.freeze());
      const saveData = getSaveData();
      const serializedSaveData = saveData ? await serializeStateForJson(saveData) : null;
      const stateJson = JSON.stringify({
        version: 3,
        romName: currentRomName,
        createdAt: new Date().toISOString(),
        state,
        saveData: serializedSaveData,
      });
      vscode.postMessage({ type: "stateData", mode, stateJson });
    } catch (err) {
      logError("Error freezing state:", err);
      vscode.postMessage({
        type: "error",
        text: "Errore nel salvataggio dello stato: " + (err.message || err),
      });
    } finally {
      if (!wasPaused) {
        startEmulator();
      }
    }
  }

  function loadStateData(stateJson) {
    if (!emulator || !stateJson) return;

    const wasPaused = isPaused;
    pauseEmulator();
    showLoadingScreen(tr("loadingState", "Caricamento stato..."));

    window.setTimeout(() => {
    try {
      const parsedState = typeof stateJson === "string" ? JSON.parse(stateJson) : stateJson;
      const parsed = deserializeStateFromJson(parsedState);
      const state = parsed.state || parsed;
      validateImportedState(parsed, state);
      if (parsed.saveData) {
        emulator.setSavedata(normalizeStateSaveData(parsed.saveData));
      }
      clearCanvas();
      emulator.defrost(state);
      configureCheats();
      isRunning = true;
      if (!wasPaused) {
        startEmulator();
      } else {
        isPaused = true;
        startEmulator();
        window.setTimeout(() => {
          if (emulator && isPaused) {
            pauseEmulator();
          }
        }, 100);
      }
      setStatus("");
      statusText.classList.add("hidden");
      reportEmulatorState();
      screenContainer.focus();
      vscode.postMessage({ type: "stateLoaded" });
    } catch (err) {
      logError("Error loading state:", err);
      vscode.postMessage({
        type: "error",
        text: "Errore nel caricamento dello stato: " + (err.message || err),
      });
      showGameScreen();
      if (!wasPaused) {
        startEmulator();
      }
    }
    }, 0);
  }

  function validateImportedState(file, state) {
    if (!state || typeof state !== "object") {
      throw new Error("File stato non valido: dati emulatore mancanti");
    }

    if (file.romName && currentRomName && file.romName !== currentRomName) {
      throw new Error(`Questo stato e' per "${file.romName}", ma la ROM corrente e' "${currentRomName}"`);
    }

    if (!state.cpu || !state.mmu || !state.irq || !state.io || !state.audio || !state.video) {
      throw new Error("File stato non valido: sezioni emulatore incomplete");
    }

    validateStateBuffer(state.mmu.ram, "RAM");
    validateStateBuffer(state.mmu.iram, "IRAM");
    validateStateBuffer(state.io.registers, "registri I/O");
  }

  function validateStateBuffer(value, label) {
    if (value instanceof ArrayBuffer && value.byteLength > 0) {
      return;
    }

    const hint =
      value && typeof value === "object" && Object.keys(value).length === 0
        ? " Il file sembra creato da una versione precedente che esportava i buffer come oggetti vuoti."
        : "";
    throw new Error(`File stato non valido: ${label} mancante o vuota.${hint}`);
  }

  function normalizeStateSaveData(saveData) {
    if (saveData instanceof ArrayBuffer || ArrayBuffer.isView(saveData)) {
      return toArrayBuffer(saveData);
    }

    if (Array.isArray(saveData)) {
      return toArrayBuffer(new Uint8Array(saveData));
    }

    throw new Error("File stato non valido: salvataggio SRAM non leggibile");
  }

  async function serializeStateForJson(value) {
    if (value instanceof Blob) {
      const buffer = await blobPayloadToArrayBuffer(value);
      return {
        __gbaType: "ArrayBuffer",
        base64: arrayBufferToBase64(buffer),
      };
    }

    if (value instanceof ArrayBuffer) {
      return {
        __gbaType: "ArrayBuffer",
        base64: arrayBufferToBase64(value),
      };
    }

    if (ArrayBuffer.isView(value)) {
      return {
        __gbaType: "ArrayBuffer",
        base64: arrayBufferToBase64(toArrayBuffer(value)),
      };
    }

    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => serializeStateForJson(item)));
    }

    if (value && typeof value === "object") {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = await serializeStateForJson(value[key]);
      }
      return result;
    }

    return value;
  }

  function deserializeStateFromJson(value) {
    if (Array.isArray(value)) {
      return value.map((item) => deserializeStateFromJson(item));
    }

    if (value && typeof value === "object") {
      if (value.__gbaType === "ArrayBuffer" && typeof value.base64 === "string") {
        return base64ToArrayBuffer(value.base64);
      }

      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = deserializeStateFromJson(value[key]);
      }
      return result;
    }

    return value;
  }

  async function blobPayloadToArrayBuffer(blob) {
    const buffer = await blob.arrayBuffer();
    if (buffer.byteLength < 4) {
      return buffer;
    }

    const view = new DataView(buffer);
    const payloadSize = view.getUint32(0, true);
    const payload = buffer.slice(4);
    return payloadSize === payload.byteLength ? payload : buffer;
  }

  function arrayBufferToBase64(buffer) {
    const view = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < view.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, view.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i += 1) {
      view[i] = binary.charCodeAt(i);
    }
    return buffer;
  }

  // ===== INPUT TASTIERA =====

  function handleKeyDown(e) {
    const gbaKey = KEY_MAP[e.key];
    if (gbaKey && emulator && isRunning && !isPaused) {
      e.preventDefault();
      e.stopPropagation();
      setKeyState(gbaKey, true);
    }
  }

  function handleKeyUp(e) {
    const gbaKey = KEY_MAP[e.key];
    if (gbaKey && emulator && isRunning && !isPaused) {
      e.preventDefault();
      e.stopPropagation();
      setKeyState(gbaKey, false);
    }
  }

  function handleBindingCapture(e) {
    if (!pendingBinding) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    assignBinding(pendingBinding, e.key);
    pendingBinding = null;
    renderSettings();
    saveSettings();
    screenContainer.focus();
  }

  function handleGlobalKeyDown(e) {
    if (!shouldCaptureGameInput()) return;
    const gbaKey = KEY_MAP[e.key];
    if (!gbaKey || !emulator || !isRunning || isPaused) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    setKeyState(gbaKey, true);
  }

  function handleGlobalKeyUp(e) {
    if (!shouldCaptureGameInput()) return;
    const gbaKey = KEY_MAP[e.key];
    if (!gbaKey || !emulator || !isRunning || isPaused) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    setKeyState(gbaKey, false);
  }

  function shouldCaptureGameInput() {
    return document.activeElement === screenContainer;
  }

  function toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) {
      return data;
    }
    if (ArrayBuffer.isView(data)) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return new Uint8Array(data).buffer;
  }

  function configureEmulatorLogging() {
    if (!emulator) return;
    emulator.logLevel = debugMode
      ? emulator.LOG_ERROR | emulator.LOG_WARN | emulator.LOG_STUB | emulator.LOG_INFO
      : emulator.LOG_ERROR | emulator.LOG_WARN;
    emulator.setLogger((level, message) => {
      const prefix = level === emulator.LOG_ERROR ? "[GBA Core Error]" : "[GBA Core]";
      if (level === emulator.LOG_ERROR) {
        console.error(prefix, message);
      } else if (debugMode) {
        console.log(prefix, message);
      }
    });
    let lastFpsLog = 0;
    emulator.reportFPS = debugMode
      ? (fps) => {
          const now = Date.now();
          if (now - lastFpsLog >= 5000) {
            lastFpsLog = now;
            log("FPS", fps.toFixed(1));
          }
        }
      : null;
  }

  function startEmulator() {
    if (!emulator) return;
    resumeAudioContext();
    if (emulator.queue) return;
    emulator.runStable();
    window.setTimeout(resumeAudioContext, 50);
    window.setTimeout(resumeAudioContext, 250);
  }

  function pauseEmulator() {
    if (!emulator) return;
    emulator.pause();
  }

  function stopEmulator() {
    if (!emulator) return;
    emulator.pause();
    if (emulator.queue) {
      clearTimeout(emulator.queue);
      emulator.queue = null;
    }
  }

  function wrapDrawCallbackForScreenReady() {
    if (!emulator || !emulator.video || emulator.__screenReadyHooked) return;
    const originalDrawCallback = emulator.video.drawCallback || function () {};
    emulator.video.drawCallback = function () {
      originalDrawCallback();
      showGameScreen();
    };
    emulator.__screenReadyHooked = true;
  }

  function setEmulatorVolume(volume) {
    if (!emulator || !emulator.audio) return;
    emulator.audio.masterVolume = volume;
  }

  function resumeAudioContext() {
    const context = emulator && emulator.audio && emulator.audio.context;
    if (context && context.state === "suspended" && context.resume) {
      context
        .resume()
        .then(() => {
          if (emulator && emulator.audio && !isPaused) {
            emulator.audio.pause(false);
          }
        })
        .catch((err) => log("Audio resume blocked", err));
    }
  }

  function setKeyState(key, pressed) {
    if (!emulator || !emulator.keypad) return;
    const bit = KEY_BITS[key];
    if (bit === undefined) return;
    const mask = 1 << bit;
    if (pressed) {
      emulator.keypad.currentDown &= ~mask;
    } else {
      emulator.keypad.currentDown |= mask;
    }
  }

  function getSaveData() {
    const save = emulator && emulator.mmu && emulator.mmu.save;
    if (!save || !save.buffer) {
      return null;
    }
    return new Uint8Array(save.buffer.slice(0));
  }

  function configureCheats() {
    if (!emulator || emulator.__gbaCheatHooked) return;
    const originalAdvanceFrame = emulator.advanceFrame.bind(emulator);
    emulator.advanceFrame = function () {
      originalAdvanceFrame();
      applyActiveCheats();
    };
    emulator.__gbaCheatHooked = true;
  }

  function applyActiveCheats() {
    if (!emulator || !emulator.mmu || compiledCheats.length === 0) return;
    compiledCheats.forEach((write) => {
      try {
        if (write.width === 8) {
          emulator.mmu.store8(write.address, write.value & 0xff);
        } else if (write.width === 16) {
          emulator.mmu.store16(write.address, write.value & 0xffff);
        } else {
          emulator.mmu.store32(write.address, write.value >>> 0);
        }
      } catch (err) {
        log("Cheat write failed", write, err);
      }
    });
  }

  function compileCheats() {
    if (!enableExperimentalCheats) {
      compiledCheats = [];
      return;
    }

    const writes = [];
    settings.cheats.forEach((cheat) => {
      cheat.error = "";
      if (!cheat.enabled) return;
      try {
        writes.push(...parseCheatCode(cheat.code));
      } catch (err) {
        cheat.error = err.message || String(err);
      }
    });
    compiledCheats = writes;
    applyActiveCheats();
  }

  function parseCheatCode(code) {
    const writes = [];
    const lines = String(code || "")
      .split(/\r?\n/)
      .map((line) => line.replace(/(?:\/\/|#|;).*$/, "").trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new Error(tr("cheatInvalid", "Codice cheat non valido"));
    }

    lines.forEach((line) => {
      const compactLine = line.replace(/[\s:-]+/g, "");
      let match = line.match(/^([0-9a-fA-F]{8})\s*(?::|=|\s)\s*([0-9a-fA-F]{2,8})$/);
      if (!match && /^[0-9a-fA-F]{10,16}$/.test(compactLine)) {
        match = [line, compactLine.slice(0, 8), compactLine.slice(8)];
      }
      if (!match) return;

      const addressCode = parseInt(match[1], 16) >>> 0;
      const valueHex = match[2];
      const value = parseInt(valueHex, 16) >>> 0;
      const parsed = parseCheatWrite(addressCode, valueHex, value);
      if (!parsed) return;
      writes.push(parsed);
    });

    return writes;
  }

  function parseCheatWrite(addressCode, valueHex, value) {
    const region = addressCode >>> 24;
    if (isWritableRegion(region)) {
      return {
        address: addressCode,
        value,
        width: getValueWidth(valueHex),
      };
    }

    const type = addressCode >>> 28;
    const ramAddress = 0x02000000 | (addressCode & 0x00ffffff);
    if (type === 0x8 && valueHex.length <= 4) {
      return { address: ramAddress, value, width: 16 };
    }
    if (type === 0x3 && valueHex.length <= 4) {
      return { address: ramAddress, value, width: 8 };
    }
    if (type === 0x4 && valueHex.length <= 8) {
      return { address: ramAddress, value, width: 32 };
    }
    if (type === 0x1) {
      if (valueHex.length <= 4) return { address: ramAddress, value, width: 16 };
      if (valueHex.length <= 8) return { address: ramAddress, value, width: 32 };
    }
    if (type === 0x2 && valueHex.length <= 4) {
      return { address: ramAddress, value, width: 8 };
    }

    return null;
  }

  function isWritableRegion(region) {
    return region === 0x02 || region === 0x03 || region === 0x04 || region === 0x05 ||
      region === 0x06 || region === 0x07 || region === 0x0e;
  }

  function getValueWidth(valueHex) {
    if (valueHex.length <= 2) return 8;
    if (valueHex.length <= 4) return 16;
    return 32;
  }

  function applySettings(nextSettings) {
    const sanitized = sanitizeSettings(nextSettings);
    settings = sanitized;
    setTranslationLocale(sanitized.locale);
    KEY_MAP = Object.assign({}, sanitized.keyMap);
    compileCheats();
    renderSettings();
    applyTimingSettings();
  }

  function sanitizeSettings(raw) {
    const sanitized = {
      fps: 60,
      speed: 1,
      locale: "it",
      keyMap: Object.assign({}, DEFAULT_KEY_MAP),
      cheats: [],
    };

    if (raw && Number.isFinite(Number(raw.fps))) {
      sanitized.fps = Math.max(30, Math.min(60, Math.round(Number(raw.fps) / 5) * 5));
    }

    sanitized.speed = sanitizeSpeed(raw && raw.speed);

    if (raw && typeof raw.locale === "string" && SUPPORTED_LOCALES.includes(raw.locale)) {
      sanitized.locale = raw.locale;
    }

    if (raw && raw.keyMap && typeof raw.keyMap === "object") {
      const validActions = new Set(GBA_BUTTONS.map((button) => button.id));
      sanitized.keyMap = {};
      Object.entries(raw.keyMap).forEach(([key, action]) => {
        if (typeof key === "string" && validActions.has(action)) {
          sanitized.keyMap[key] = action;
        }
      });

      GBA_BUTTONS.forEach((button) => {
        if (!getKeyForAction(button.id, sanitized.keyMap)) {
          const defaultKey = getKeyForAction(button.id, DEFAULT_KEY_MAP);
          if (defaultKey) {
            sanitized.keyMap[defaultKey] = button.id;
          }
        }
      });
    }

    if (raw && Array.isArray(raw.cheats)) {
      sanitized.cheats = raw.cheats
        .map((cheat) => sanitizeCheat(cheat))
        .filter(Boolean);
    }

    return sanitized;
  }

  function sanitizeCheat(raw) {
    if (!raw || typeof raw !== "object") return null;
    const code = typeof raw.code === "string" ? raw.code.trim() : "";
    if (!code) return null;

    const id = typeof raw.id === "string" && raw.id
      ? raw.id
      : `cheat-${Date.now()}-${++cheatIdCounter}`;
    const name = typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 80)
      : tr("cheats", "Cheat") + " " + (cheatIdCounter + 1);

    return {
      id,
      name,
      code,
      enabled: raw.enabled !== false,
      error: "",
    };
  }

  function addCheatFromForm() {
    if (!cheatCodeInput) return;
    const code = cheatCodeInput.value.trim();
    if (!code) {
      setCheatStatus(tr("cheatInvalid", "Codice cheat non valido"), true);
      return;
    }

    const cheat = sanitizeCheat({
      name: cheatNameInput ? cheatNameInput.value : "",
      code,
      enabled: true,
    });
    if (!cheat) {
      setCheatStatus(tr("cheatInvalid", "Codice cheat non valido"), true);
      return;
    }

    settings.cheats.push(cheat);
    if (cheatNameInput) cheatNameInput.value = "";
    cheatCodeInput.value = "";
    compileCheats();
    renderCheats();
    setCheatStatus(tr("cheatAdded", "Cheat aggiunto"), false);
    saveSettings();
  }

  function renderCheats() {
    if (!cheatList) return;
    cheatList.textContent = "";

    if (settings.cheats.length === 0) {
      const empty = document.createElement("div");
      empty.className = "setting-help";
      empty.textContent = tr("noCheats", "Nessun cheat aggiunto");
      cheatList.append(empty);
      return;
    }

    settings.cheats.forEach((cheat) => {
      const item = document.createElement("div");
      item.className =
        "cheat-item" +
        (cheat.enabled ? "" : " disabled") +
        (cheat.error ? " invalid" : "");

      const header = document.createElement("div");
      header.className = "cheat-item-header";

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "cheat-toggle";
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = cheat.enabled;
      toggle.setAttribute(
        "aria-label",
        cheat.enabled
          ? tr("cheatEnabled", "Abilitato")
          : tr("cheatDisabled", "Disabilitato")
      );
      toggle.addEventListener("change", () => {
        cheat.enabled = toggle.checked;
        compileCheats();
        renderCheats();
        saveSettings();
      });
      const title = document.createElement("span");
      title.className = "cheat-title";
      title.textContent = cheat.name;
      const state = document.createElement("span");
      state.className = "cheat-state";
      state.textContent = cheat.enabled
        ? tr("cheatEnabled", "Abilitato")
        : tr("cheatDisabled", "Disabilitato");
      toggleLabel.append(toggle, title, state);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = tr("deleteCheat", "Elimina");
      deleteButton.addEventListener("click", () => {
        settings.cheats = settings.cheats.filter((entry) => entry.id !== cheat.id);
        compileCheats();
        renderCheats();
        saveSettings();
      });

      header.append(toggleLabel, deleteButton);

      const code = document.createElement("pre");
      code.textContent = cheat.code;

      item.append(header, code);
      if (cheat.error) {
        const error = document.createElement("div");
        error.className = "cheat-error";
        error.textContent = cheat.error;
        item.append(error);
      }
      cheatList.append(item);
    });
  }

  function setCheatStatus(text, isError) {
    if (!cheatStatus) return;
    cheatStatus.textContent = text;
    cheatStatus.classList.toggle("error", Boolean(isError));
  }

  function saveSettings() {
    vscode.postMessage({
      type: "settingsChanged",
      settings,
    });
  }

  function sanitizeSpeed(value) {
    const numeric = Number(value);
    return SUPPORTED_SPEEDS.includes(numeric) ? numeric : 1;
  }

  function formatSpeedLabel(speed) {
    return speed + "x";
  }

  function applyTimingSettings() {
    if (fpsSlider) {
      fpsSlider.value = String(settings.fps);
    }
    if (fpsValue) {
      fpsValue.textContent = String(settings.fps);
    }
    if (speedSelect) {
      speedSelect.value = String(settings.speed);
    }
    if (emulator) {
      emulator.throttle = Math.max(1, Math.round(1000 / (settings.fps * settings.speed)));
    }
  }

  function renderSettings() {
    renderLocalization();
    applyTimingSettings();
    renderControlHelp();
    renderBindingButtons();
    renderCheats();
  }

  function renderControlHelp() {
    if (!controlsKeyGrid) return;
    controlsKeyGrid.textContent = "";

    [
      { label: tr("dpad", "D-Pad"), actions: ["UP", "DOWN", "LEFT", "RIGHT"] },
      { label: "A", actions: ["A"] },
      { label: "B", actions: ["B"] },
      { label: "L", actions: ["L"] },
      { label: "R", actions: ["R"] },
      { label: "Start", actions: ["START"] },
      { label: "Select", actions: ["SELECT"] },
    ].forEach((row) => {
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = row.actions
        .map((action) => formatKeyLabel(getKeyForAction(action, settings.keyMap)))
        .join(" ");

      const desc = document.createElement("span");
      desc.className = "key-desc";
      desc.textContent = row.label;

      controlsKeyGrid.append(key, desc);
    });
  }

  function renderBindingButtons() {
    if (!keyBindings) return;
    keyBindings.textContent = "";

    GBA_BUTTONS.forEach((button) => {
      const label = document.createElement("span");
      label.className = "binding-label";
      label.textContent = getActionLabel(button.id);

      const control = document.createElement("button");
      control.type = "button";
      control.className = "binding-button";
      control.dataset.gbaKey = button.id;
      control.textContent =
        pendingBinding === button.id
          ? tr("pressAnyKey", "Premi un tasto...")
          : formatKeyLabel(getKeyForAction(button.id, settings.keyMap));
      control.addEventListener("click", () => {
        pendingBinding = button.id;
        renderSettings();
      });

      keyBindings.append(label, control);
    });
  }

  function renderLocalization() {
    if (controlsSummary) controlsSummary.textContent = tr("controls", "Controlli");
    if (settingsSummary) settingsSummary.textContent = tr("settings", "Settings");
    if (languageLabel) languageLabel.textContent = tr("language", "Lingua");
    if (speedLabel) speedLabel.textContent = tr("speed", "Velocita");
    if (commandsHeading) commandsHeading.textContent = tr("commands", "Comandi");
    if (stateHeading) stateHeading.textContent = tr("state", "Stato");
    if (cheatsHeading) cheatsHeading.textContent = tr("cheats", "Cheat");

    if (languageSelect) {
      Array.from(languageSelect.options).forEach((option) => {
        option.textContent = tr(LANGUAGE_KEYS[option.value], option.textContent);
      });
      languageSelect.value = settings.locale;
    }

    if (btnResetBindings) btnResetBindings.textContent = tr("resetBindings", "Reset comandi");
    if (btnSaveState) btnSaveState.textContent = tr("saveState", "Salva stato");
    if (btnLoadState) btnLoadState.textContent = tr("loadState", "Carica stato");
    if (btnExportState) btnExportState.textContent = tr("exportState", "Esporta stato");
    if (btnImportState) btnImportState.textContent = tr("importState", "Importa stato");
    if (btnAddCheat) btnAddCheat.textContent = tr("addCheat", "Aggiungi cheat");
    if (cheatNameInput) cheatNameInput.placeholder = tr("cheatPlaceholderName", "Es. Caramelle rare");
    if (cheatCodeInput) cheatCodeInput.placeholder = tr("cheatPlaceholderCode", "Es. 82005274 0044");
    if (cheatHelp) {
      cheatHelp.textContent = tr(
        "cheatHelp",
        "Supporta raw write tipo 02000000 0063 e CodeBreaker/VBA 82005274 0001. Un codice per riga."
      );
    }
    if (screenPlaceholder && !screenPlaceholder.classList.contains("hidden")) {
      if (screenPlaceholder.classList.contains("loading")) {
        updateScreenPlaceholder(
          "loading",
          tr("loadingScreenTitle", "GAME BOY ADVANCE"),
          screenPlaceholderMessage ? screenPlaceholderMessage.textContent : tr("loadingRom", "Caricamento ROM...")
        );
      } else {
        showDefaultScreen();
      }
    }
  }

  function getActionLabel(action) {
    switch (action) {
      case "UP":
        return tr("dpadUp", "D-Pad su");
      case "DOWN":
        return tr("dpadDown", "D-Pad giu");
      case "LEFT":
        return tr("dpadLeft", "D-Pad sinistra");
      case "RIGHT":
        return tr("dpadRight", "D-Pad destra");
      default:
        return action;
    }
  }

  function assignBinding(action, key) {
    const nextMap = {};
    Object.entries(settings.keyMap).forEach(([existingKey, existingAction]) => {
      if (existingKey !== key && existingAction !== action) {
        nextMap[existingKey] = existingAction;
      }
    });
    nextMap[key] = action;
    settings.keyMap = nextMap;
    KEY_MAP = Object.assign({}, nextMap);
  }

  function getKeyForAction(action, keyMap) {
    const entry = Object.entries(keyMap).find(([, mappedAction]) => mappedAction === action);
    return entry ? entry[0] : "";
  }

  function formatKeyLabel(key) {
    switch (key) {
      case "ArrowUp":
        return "↑";
      case "ArrowDown":
        return "↓";
      case "ArrowLeft":
        return "←";
      case "ArrowRight":
        return "→";
      case " ":
        return "Space";
      case "\\":
        return "\\";
      case "":
        return "-";
      default:
        return key.length === 1 ? key.toUpperCase() : key;
    }
  }

  // ===== UI HELPERS =====

  function setStatus(text) {
    if (statusText) {
      statusText.textContent = text;
      if (text) {
        statusText.classList.remove("hidden");
      }
    }
  }

  function showDefaultScreen() {
    clearCanvas();
    setStatus("");
    statusText.classList.add("hidden");
    updateScreenPlaceholder(
      "default",
      tr("defaultScreenTitle", "GAME BOY ADVANCE"),
      tr("defaultScreenMessage", "Carica una ROM per iniziare a giocare!")
    );
  }

  function showLoadingScreen(message) {
    clearCanvas();
    setStatus("");
    statusText.classList.add("hidden");
    updateScreenPlaceholder(
      "loading",
      tr("loadingScreenTitle", "GAME BOY ADVANCE"),
      message || tr("loadingRom", "Caricamento ROM...")
    );
  }

  function showGameScreen() {
    if (!screenPlaceholder) return;
    screenPlaceholder.classList.add("hidden");
    screenPlaceholder.classList.remove("default", "loading");
  }

  function updateScreenPlaceholder(mode, title, message) {
    if (!screenPlaceholder) return;
    screenPlaceholder.classList.remove("hidden", "default", "loading");
    screenPlaceholder.classList.add(mode);
    if (screenPlaceholderTitle) screenPlaceholderTitle.textContent = title;
    if (screenPlaceholderMessage) screenPlaceholderMessage.textContent = message;
  }

  function clearCanvas() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function enableControls(enabled) {
    // I comandi principali vivono nella toolbar nativa di VS Code.
  }

  function updateRomInfo() {
    if (!romInfo) return;
    if (currentRomName) {
      romInfo.textContent = currentRomName;
      romInfo.classList.remove("hidden");
    } else {
      romInfo.textContent = "";
      romInfo.classList.add("hidden");
    }
  }

  function updateVolumeIcon(value) {
    if (value === 0) {
      volumeLabel.textContent = "🔇";
    } else if (value < 33) {
      volumeLabel.textContent = "🔈";
    } else if (value < 66) {
      volumeLabel.textContent = "🔉";
    } else {
      volumeLabel.textContent = "🔊";
    }
  }

  // Inizializza quando il DOM è pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
