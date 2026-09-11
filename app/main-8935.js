'use strict';
require('./release-8930-main.js');
// Register the base handlers before the updater replaces them.
require('./main.js');
require('./updater-8931.js');
