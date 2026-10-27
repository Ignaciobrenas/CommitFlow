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

  if (isWatch) {
    console.log('👀 Watching for changes in extension and webview...');
    await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
  } else {
    await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
    await extensionCtx.dispose();
    await webviewCtx.dispose();
    console.log(`✅ Build complete! [Production: ${isProduction}]`);
  }
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
