const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const ext = fs.readFileSync(path.join(root, 'src', 'extension.ts'), 'utf8');

const packageCommands = pkg.contributes?.commands?.map((c) => c.command) || [];
const registeredCommands = [];

const regex = /vscode\.commands\.registerCommand\(\s*['"]([^'"]+)['"]/g;
let match;
while ((match = regex.exec(ext)) !== null) {
  registeredCommands.push(match[1]);
}

console.log('package.json commands count:', packageCommands.length);
console.log('Registered commands count:', registeredCommands.length);

const missingInExtension = packageCommands.filter((c) => !registeredCommands.includes(c));
const extraInExtension = registeredCommands.filter((c) => !packageCommands.includes(c));

if (missingInExtension.length > 0) {
  console.error('Commands declared in package.json but not registered in extension.ts:', missingInExtension);
}

if (extraInExtension.length > 0) {
  console.warn('Commands registered in extension.ts but not declared in package.json:', extraInExtension);
}

if (missingInExtension.length > 0) {
  process.exit(1);
} else {
  console.log('All package.json commands are properly registered in extension.ts.');
}
