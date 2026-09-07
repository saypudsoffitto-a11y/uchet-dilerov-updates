const electron = require('electron');
const fs = require('fs');
const path = require('path');

// 8.9.15 loads the assistant and UI reliability patches after the main renderer is ready.
// The assistant is passive by default: it does not start the microphone or speak
// until the user explicitly opens it and starts an interaction.
const originalLoadFile = electron.BrowserWindow.prototype.loadFile;
electron.BrowserWindow.prototype.loadFile = async function(...args) {
  const result = await originalLoadFile.apply(this, args);
  try {
    for (const file of ['assistant-patch.js','ui-fix-8915.js']) {
      const patchPath = path.join(__dirname, file);
      if (fs.existsSync(patchPath)) {
        const code = fs.readFileSync(patchPath, 'utf8');
        await this.webContents.executeJavaScript(code, true);
      }
    }
  } catch (e) {
    console.error('8.9.15 renderer patch injection failed:', e);
  }
  return result;
};

require('./main.js');
