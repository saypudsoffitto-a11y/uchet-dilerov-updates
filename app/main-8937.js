'use strict';
require('./release-8930-main.js');
require('./release-8937-main.js');
// Register the base handlers first. Windows replaces them with its helper-based updater;
// macOS keeps the ZIP updater from main.js so it can replace and relaunch the .app automatically.
require('./main.js');
if (process.platform === 'win32') require('./updater-8931.js');
