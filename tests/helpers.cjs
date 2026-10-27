'use strict';

const fs = require('node:fs');
const path = require('node:path');

const src = (...parts) => path.join(__dirname, '..', 'src', ...parts);
const read = (...parts) => fs.readFileSync(src(...parts), 'utf8');

module.exports = { src, read };
