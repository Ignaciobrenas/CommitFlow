const fs = require('fs');
const path = require('path');

function checkPackageNls() {
  const root = path.resolve(__dirname, '..');
  const enPath = path.join(root, 'package.nls.json');
  const esPath = path.join(root, 'package.nls.es.json');

  if (!fs.existsSync(enPath) || !fs.existsSync(esPath)) {
    console.error('Missing package.nls.json or package.nls.es.json');
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

  const enKeys = Object.keys(en);
  const esKeys = Object.keys(es);

  let hasError = false;

  const missingInEs = enKeys.filter((k) => !(k in es));
  const missingInEn = esKeys.filter((k) => !(k in en));

  if (missingInEs.length > 0) {
    console.error('Keys present in package.nls.json but missing in package.nls.es.json:', missingInEs);
    hasError = true;
  }

  if (missingInEn.length > 0) {
    console.error('Keys present in package.nls.es.json but missing in package.nls.json:', missingInEn);
    hasError = true;
  }

  return !hasError;
}

function checkLocalesTs() {
  const root = path.resolve(__dirname, '..');
  const localesFile = path.join(root, 'src', 'i18n', 'locales.ts');
  const content = fs.readFileSync(localesFile, 'utf8');

  const esBlockMatch = content.match(/es:\s*\{([\s\S]*?)\},\s*en:\s*\{/);
  const enBlockMatch = content.match(/en:\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*\};/);

  if (!esBlockMatch || !enBlockMatch) {
    console.error('Failed to parse LOCALES blocks from src/i18n/locales.ts');
    process.exit(1);
  }

  const extractKeys = (block) => {
    const keys = [];
    const lines = block.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*['"]([^'"]+)['"]\s*:/);
      if (match) {
        keys.push(match[1]);
      }
    }
    return keys;
  };

  const esKeys = extractKeys(esBlockMatch[1]);
  const enKeys = extractKeys(enBlockMatch[1]);

  let hasError = false;

  const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
  const missingInEs = enKeys.filter((k) => !esKeys.includes(k));

  if (missingInEn.length > 0) {
    console.error('Keys present in LOCALES.es but missing in LOCALES.en:', missingInEn);
    hasError = true;
  }

  if (missingInEs.length > 0) {
    console.error('Keys present in LOCALES.en but missing in LOCALES.es:', missingInEs);
    hasError = true;
  }

  return !hasError;
}

const nlsOk = checkPackageNls();
const localesOk = checkLocalesTs();

if (!nlsOk || !localesOk) {
  process.exit(1);
} else {
  console.log('All i18n locales have 100% key parity.');
}
