const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    title: '员工考勤薪资管理系统',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.setMenu(null);
}

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(options || {});
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(options || {});
  return result;
});

ipcMain.handle('fs:readFile', async (event, filePath, encoding) => {
  try {
    return fs.readFileSync(filePath, encoding || 'utf8');
  } catch (e) {
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data, encoding) => {
  try {
    fs.writeFileSync(filePath, data, encoding || 'utf8');
    return true;
  } catch (e) {
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
