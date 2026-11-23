const path = require('node:path');

// Mantiene el navegador descargado dentro de las dependencias del backend.
module.exports = { cacheDirectory: path.join(__dirname, 'node_modules', '.cache', 'puppeteer') };
