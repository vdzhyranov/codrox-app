process.env.PATH = `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`;

import { app, shell, BrowserWindow, Menu } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { registerAllHandlers } from "./ipc";
import { persistenceService } from "./services/PersistenceService";
import { claudeEnvManager } from "./services/ClaudeEnvManager";

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    icon: join(__dirname, "../../resources/icon.png"),
    backgroundColor: "#18181b",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  registerAllHandlers(mainWindow);

  mainWindow.on("ready-to-show", () => {
    // Apply saved zoom level before showing window
    try {
      const settings = persistenceService.getAppState<{ zoomLevel: number }>('settings')
      if (settings?.zoomLevel) {
        mainWindow.webContents.setZoomLevel(settings.zoomLevel)
      }
    } catch { /* ignore */ }

    mainWindow.show();
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: "bottom" });
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    mainWindow.webContents.send('browser:open-url', { url: details.url });
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.codrox.app");

  // Refresh the bundled Claude runtime cache (skills, agents, commands, hooks)
  // before any workspace materializes its fake $HOME.
  try {
    claudeEnvManager.bumpRuntimeIfStale();
  } catch (err) {
    console.warn("[main] bumpRuntimeIfStale failed:", err);
  }

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Application menu with zoom shortcuts
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+=',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (!win) return
            const level = Math.min(3, Math.round((win.webContents.getZoomLevel() + 0.5) * 2) / 2)
            win.webContents.setZoomLevel(level)
            win.webContents.send('settings:zoomChanged', { level })
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (!win) return
            const level = Math.max(-2, Math.round((win.webContents.getZoomLevel() - 0.5) * 2) / 2)
            win.webContents.setZoomLevel(level)
            win.webContents.send('settings:zoomChanged', { level })
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CommandOrControl+0',
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (!win) return
            win.webContents.setZoomLevel(0)
            win.webContents.send('settings:zoomChanged', { level: 0 })
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
