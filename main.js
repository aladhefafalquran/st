const { app, BrowserWindow, session, ipcMain, Menu } = require('electron');
const path = require('path');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

let mainWindow = null;

async function setupAdBlocker() {
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
  console.log('--- Pro Stealth Blocker Active ---');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Remove default menu and add F11 shortcut
  const menu = Menu.buildFromTemplate([
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            const isFS = !mainWindow.isFullScreen();
            mainWindow.setFullScreen(isFS);
            if (isFS) {
              mainWindow.webContents.send('enter-cinema-mode');
            } else {
              mainWindow.webContents.send('exit-cinema-mode');
            }
          }
        }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  // BLOCK POPUPS
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // NATIVE FULLSCREEN HANDLERS (From player clicks)
  mainWindow.webContents.on('enter-html-full-screen', () => {
    mainWindow.setFullScreen(true);
    mainWindow.webContents.send('enter-cinema-mode');
  });
  mainWindow.webContents.on('leave-html-full-screen', () => {
    mainWindow.setFullScreen(false);
    mainWindow.webContents.send('exit-cinema-mode');
  });

  // GLOBAL KEYBOARD LISTENER (The "Panic Button")
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'Escape') {
        if (mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(false);
        }
        mainWindow.webContents.send('exit-cinema-mode');
      }
      // F11 is now handled by the Menu Accelerator for better reliability
    }
  });

  // Spoof User Agent
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  mainWindow.webContents.setUserAgent(userAgent);

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('vidsrc')) {
      details.requestHeaders['Referer'] = 'https://vidsrc.xyz/';
      details.requestHeaders['Origin'] = 'https://vidsrc.xyz/';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// CORS BYPASS FOR SCRAPING
ipcMain.handle('fetch-html', async (event, url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });
    return await response.text();
  } catch (err) {
    console.error('Fetch Error:', err);
    return null;
  }
});

app.whenReady().then(async () => {
  await setupAdBlocker();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
