'use strict';
// 8.9.40 is a versioned wrapper around the fully verified 8.9.39 runtime.
// Do not replace this with an older entrypoint: all overnight fixes remain loaded
// through main-8939.js (dealer deletion, sync queue, product horizontal scroll,
// compact tables and PDF fixes).
require('./main-8939.js');
