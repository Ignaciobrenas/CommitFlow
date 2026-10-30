/**
 * CommitFlow - Official Asset Pipeline
 * Maintains and verifies the official vector and raster brand assets.
 */

const fs = require('fs');
const path = require('path');

const resourcesDir = path.join(__dirname, '..', 'resources');

const requiredAssets = [
  'commitflow-isotipo-color.svg',
  'commitflow-isotipo-white.svg',
  'commitflow-logotipo-white.svg',
  'commitflow-logo-color.png'
];

console.log('--- Verifying CommitFlow Brand Assets ---');
let allPresent = true;
for (const asset of requiredAssets) {
  const assetPath = path.join(resourcesDir, asset);
  if (fs.existsSync(assetPath)) {
    const stats = fs.statSync(assetPath);
    console.log(`[OK] ${asset} (${stats.size} bytes)`);
  } else {
    console.error(`[MISSING] ${asset}`);
    allPresent = false;
  }
}

if (!allPresent) {
  console.error('Some official assets are missing.');
  process.exit(1);
} else {
  console.log('All official CommitFlow vector and raster assets verified successfully.');
}
