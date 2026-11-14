const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function verifyDistArtifacts() {
  const requiredBundles = [
    'dist/extension.js',
    'dist/webview.js',
    'dist/webview.css',
    'dist/codicon.css',
    'dist/mcp.js',
  ];

  const stats = {};
  for (const rel of requiredBundles) {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `Missing compiled bundle artifact: ${rel}`);
    const st = fs.statSync(abs);
    assert.ok(st.size > 0, `Empty bundle artifact: ${rel}`);
    stats[rel] = st.size;
  }
  return stats;
}

function verifyManifest() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  assert.ok(pkg.main && pkg.main.includes('dist/extension.js'), `Unexpected manifest main: ${pkg.main}`);
  assert.ok(Array.isArray(pkg.contributes?.commands) && pkg.contributes.commands.length >= 15, 'Missing contributed commands');
  assert.ok(pkg.contributes?.views && Object.keys(pkg.contributes.views).length > 0, 'Missing contributed views');
  assert.ok(pkg.contributes?.configuration?.properties, 'Missing contributed configuration properties');

  return pkg;
}

async function verifyHeadlessExtensionLifecycle(pkg) {
  const tmpMockFile = path.join(os.tmpdir(), `cf-vscodemock-${process.pid}-${Date.now()}.js`);
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'test', 'vscodeMock.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: tmpMockFile,
  });

  const originalLoad = Module._load;
  const registeredCommands = new Set();
  const registeredProviders = new Set();

  try {
    const rawMock = require(tmpMockFile);
    const instrumentedVscode = {
      ...rawMock,
      env: {
        ...rawMock.env,
        language: 'en',
      },
      commands: {
        ...rawMock.commands,
        registerCommand: (name, handler) => {
          registeredCommands.add(name);
          return rawMock.commands.registerCommand(name, handler);
        },
      },
      window: {
        ...rawMock.window,
        registerWebviewViewProvider: (viewId, provider, options) => {
          registeredProviders.add(viewId);
          return rawMock.window.registerWebviewViewProvider(viewId, provider, options);
        },
      },
    };

    Module._load = function (request, parent, isMain) {
      if (request === 'vscode') {
        return instrumentedVscode;
      }
      return originalLoad.apply(this, arguments);
    };

    const extBundlePath = path.join(ROOT, 'dist', 'extension.js');
    delete require.cache[require.resolve(extBundlePath)];
    const ext = require(extBundlePath);

    assert.strictEqual(typeof ext.activate, 'function', 'dist/extension.js must export activate()');
    assert.strictEqual(typeof ext.deactivate, 'function', 'dist/extension.js must export deactivate()');

    const secretMap = new Map();
    const stateMap = new Map();
    const mockContext = {
      subscriptions: [],
      extensionUri: rawMock.Uri.file(ROOT),
      extensionPath: ROOT,
      globalState: {
        get: (k, d) => (stateMap.has(k) ? stateMap.get(k) : d),
        update: (k, v) => {
          stateMap.set(k, v);
          return Promise.resolve();
        },
        keys: () => Array.from(stateMap.keys()),
      },
      workspaceState: {
        get: (k, d) => (stateMap.has(k) ? stateMap.get(k) : d),
        update: (k, v) => {
          stateMap.set(k, v);
          return Promise.resolve();
        },
        keys: () => Array.from(stateMap.keys()),
      },
      secrets: {
        get: (k) => Promise.resolve(secretMap.get(k)),
        store: (k, v) => {
          secretMap.set(k, v);
          return Promise.resolve();
        },
        delete: (k) => {
          secretMap.delete(k);
          return Promise.resolve();
        },
      },
    };

    await Promise.resolve(ext.activate(mockContext));
    // Allow background initialization (e.g., async server startup) to settle before deactivate()
    await new Promise((r) => setTimeout(r, 150));

    assert.ok(
      mockContext.subscriptions.length >= 10,
      `Expected >= 10 subscriptions registered during activate(), got ${mockContext.subscriptions.length}`
    );
    assert.ok(registeredCommands.has('commitflow.openGraph'), 'Missing commitflow.openGraph command registration');
    assert.ok(registeredCommands.has('commitflow.connectAi'), 'Missing commitflow.connectAi command registration');
    assert.ok(
      registeredCommands.size >= pkg.contributes.commands.length - 2,
      `Too few commands registered (${registeredCommands.size} vs ${pkg.contributes.commands.length} in manifest)`
    );
    assert.ok(registeredProviders.size >= 1, 'Expected at least 1 registered WebviewViewProvider');

    ext.deactivate();
    for (const sub of mockContext.subscriptions) {
      try {
        if (sub && typeof sub.dispose === 'function') sub.dispose();
      } catch {
        // ignore mock dispose errors
      }
    }
    await new Promise((r) => setTimeout(r, 80));

    return {
      subscriptions: mockContext.subscriptions.length,
      registeredCommands: registeredCommands.size,
      registeredProviders: registeredProviders.size,
    };
  } finally {
    Module._load = originalLoad;
    try {
      fs.rmSync(tmpMockFile, { force: true });
    } catch {
      // ignore temp cleanup failure
    }
  }
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`CommitFlow Headless E2E Smoke Suite`);
  console.log(`======================================================`);

  const bundleStats = verifyDistArtifacts();
  console.log(`  ✔ Bundles verified (${Object.keys(bundleStats).length} artifacts non-empty)`);

  const pkg = verifyManifest();
  console.log(`  ✔ Manifest verified (${pkg.contributes.commands.length} contributed commands)`);

  const lifecycle = await verifyHeadlessExtensionLifecycle(pkg);
  console.log(
    `  ✔ Extension activate/deactivate OK (${lifecycle.registeredCommands} commands, ${lifecycle.registeredProviders} webview views, ${lifecycle.subscriptions} disposables)`
  );
  console.log(`======================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[CommitFlow] E2E smoke suite failed:', err);
    process.exit(1);
  });
