'use strict';
require('./release-8930-main.js');
require('./release-8937-main.js');
// Register the base handlers before the updater replaces them.
require('./main.js');
if (process.platform === 'win32') require('./updater-8931.js');
