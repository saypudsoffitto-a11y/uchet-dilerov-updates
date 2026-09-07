const electron = require('electron');
const fs = require('fs');
const path = require('path');

const originalLoadFile = electron.BrowserWindow.prototype.loadFile;
electron.BrowserWindow.prototype.loadFile = async function(...args) {
  const result = await originalLoadFile.apply(this, args);
  try {
    const patchPath = path.join(__dirname, 'assistant-patch.js');
    if (fs.existsSync(patchPath)) {
      const code = fs.readFileSync(patchPath, 'utf8');
      await this.webContents.executeJavaScript(code, true);
    }
  } catch (e) {
    console.error('Assistant patch injection failed:', e);
  }
  return result;
};

require('./main.js');
