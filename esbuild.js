const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy CSS to dist
  const cssSrc = path.join(__dirname, 'src', 'webview', 'style.css');
  const cssDest = path.join(distDir, 'webview.css');
  if (fs.existsSync(cssSrc)) {
    fs.copyFileSync(cssSrc, cssDest);
  }

  // Copy @vscode/codicons assets to dist
  const codiconDir = path.join(__dirname, 'node_modules', '@vscode', 'codicons', 'dist');
  if (fs.existsSync(codiconDir)) {
    const codiconCssSrc = path.join(codiconDir, 'codicon.css');
    const codiconTtfSrc = path.join(codiconDir, 'codicon.ttf');
    if (fs.existsSync(codiconCssSrc)) {
      fs.copyFileSync(codiconCssSrc, path.join(distDir, 'codicon.css'));
    }
    if (fs.existsSync(codiconTtfSrc)) {
      fs.copyFileSync(codiconTtfSrc, path.join(distDir, 'codicon.ttf'));
    }
  }

  // 1. Build Extension Host Bundle (Node.js)
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
  });

  // 2. Build Webview Bundle (Browser)
  const webviewCtx = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: !isProduction,
    minify: isProduction,
  });

  // 3. Build Standalone MCP Server Bundle (Node.js)
  const mcpCtx = await esbuild.context({
    entryPoints: ['src/mcp/branchifyMcpServer.ts'],
    bundle: true,
    outfile: 'dist/mcp.js',
    alias: { vscode: './test/vscodeMock.ts' },
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
  });

  if (isWatch) {
    console.log('👀 Watching for changes in extension, webview and mcp...');
    await Promise.all([extensionCtx.watch(), webviewCtx.watch(), mcpCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild(), mcpCtx.rebuild()]);
    await extensionCtx.dispose();
    await webviewCtx.dispose();
    await mcpCtx.dispose();
    console.log(`✅ Build complete! [Production: ${isProduction}]`);
  }
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
