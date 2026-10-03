import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fileEnv = path => existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
const env = { ...fileEnv(resolve(root, '.env.local')), ...process.env };
const bridgeEnv = fileEnv(resolve(root, 'integrations/dsa/.env'));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' }); } catch { /* Already exited. */ }
    } else child.kill('SIGTERM');
  }
  process.exit(code);
}
function launch(command, args, label, childEnv = env) {
  const child = spawn(command, args, { cwd: root, env: childEnv, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', () => { console.error(`${label} could not start.`); stop(1); });
  child.on('exit', code => { if (!stopping) { console.error(`${label} stopped; closing companion processes.`); stop(code || 1); } });
  return child;
}
async function requireFreePort(port) {
  await new Promise((accept, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied. Stop the existing service before starting both services.`)));
    server.listen(port, '127.0.0.1', () => server.close(accept));
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  const dev = process.argv.includes('--dev');
  if (!dev && !existsSync(resolve(root, '.next/BUILD_ID'))) throw new Error('Run npm run build before npm run start:all.');
  await requireFreePort(3001);
  const configuredBridge = env.DSA_BASE_URL && env.DSA_SERVICE_TOKEN;
  if (env.MARKET_DATA_PROVIDER === 'dsa' && !configuredBridge) throw new Error('Configure DSA_BASE_URL and DSA_SERVICE_TOKEN in .env.local.');
  if (configuredBridge) {
    const url = new URL(env.DSA_BASE_URL);
    if (['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:') {
      const token = env.DSA_SERVICE_TOKEN;
      if (token.length < 32 || (bridgeEnv.DSA_SERVICE_TOKEN && token !== bridgeEnv.DSA_SERVICE_TOKEN)) throw new Error('The two DSA service tokens must match and contain at least 32 characters.');
      const repo = env.DSA_REPO_PATH || bridgeEnv.DSA_REPO_PATH;
      if (!repo || !existsSync(resolve(repo, 'data_provider/yfinance_fetcher.py'))) throw new Error('Configure a valid DSA_REPO_PATH in integrations/dsa/.env.');
      const executable = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
      const python = [env.DSA_PYTHON, resolve(root, `integrations/dsa/.venv/${executable}`), resolve(repo, `.venv-zeitgeist/${executable}`)].find(path => path && existsSync(path));
      if (!python) throw new Error('Install the integration Python environment or set DSA_PYTHON to its executable.');
      const port = Number(url.port || 80);
      await requireFreePort(port);
      launch(python, ['-m', 'uvicorn', 'bridge:app', '--app-dir', 'integrations/dsa', '--host', '127.0.0.1', '--port', String(port)], 'DSA bridge', { ...env, DSA_REPO_PATH: repo });
      let ready = false;
      for (let i = 0; i < 30; i++) {
        try { const response = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* Wait for startup, not provider data. */ }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!ready) throw new Error('DSA bridge did not become ready.');
      console.log('DSA bridge ready.');
    } else console.log('Using the configured remote DSA bridge.');
  }
  launch(process.execPath, ['node_modules/next/dist/bin/next', dev ? 'dev' : 'start', ...(dev ? ['--turbopack'] : []), '-p', '3001'], 'Zeitgeist');
  console.log('Zeitgeist: http://localhost:3001 — Ctrl+C stops both local services.');
} catch (error) { console.error(error.message); stop(1); }
