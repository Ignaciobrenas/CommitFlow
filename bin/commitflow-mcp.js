#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const distMcp = path.join(__dirname, '..', 'dist', 'mcp.js');
if (fs.existsSync(distMcp)) {
  require(distMcp);
} else {
  require('esbuild').buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', 'mcp', 'commitflowMcpServer.ts')],
    outfile: distMcp,
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['vscode'],
  });
  require(distMcp);
}
