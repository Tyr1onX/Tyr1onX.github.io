// Read-only Level 6 capture for Baidu Netdisk research.
// Requires the two observer executables to be built beside this script.
// This script only reads BrowserEngine CDP state, local file size and
// observer stdout. It does not click UI controls or modify the Baidu process.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const nativeTaskId = arg('native-task-id', 'b9583c2d733809b9349644679acc6d4a');
const uiTaskId = arg('ui-task-id', '1788314213');
const filePath = arg('file', 'D:\\BaiduNetdiskDownload\\_limit_observe_live\\1.项目总览.mp4');
const durationSec = Number(arg('duration-sec', '15'));
const waitRunningMs = Number(arg('wait-running-ms', '300000'));
const waitPausedMs = Number(arg('wait-paused-ms', '0'));
const pollMs = Number(arg('poll-ms', '250'));
const observerIntervalMs = Number(arg('observer-interval-ms', '20'));
const pausedOnly = process.argv.includes('--paused-only');

function targetList() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function connect() {
  const targets = await targetList();
  const t = targets.find(x => x.type === 'page' && x.title === '百度网盘') || targets.find(x => x.type === 'page');
  if (!t) throw new Error('BrowserEngine page target not found');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let seq = 1;
  const pending = new Map();
  ws.onmessage = e => {
    const x = JSON.parse(e.data);
    const f = pending.get(x.id);
    if (f) { pending.delete(x.id); f(x); }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  return {
    ws,
    evalState() {
      return new Promise(resolve => {
        const id = seq++;
        pending.set(id, x => {
          try {
            const d = JSON.parse(x.result.result.value);
            const m = d.downloadFileMeta && d.downloadFileMeta[uiTaskId];
            resolve(m ? {
              rate: Number(m.rate || 0),
              finish: Number(m.finish_size || 0),
              status: String(m.status),
              error: String(m.error || ''),
            } : null);
          } catch { resolve(null); }
        });
        const expression = "(()=>{const el=document.querySelector('[data-id=transfer]');const s=el&&el.__vue__&&el.__vue__.$store&&el.__vue__.$store.state;return JSON.stringify(s&&s.downloading||{});})()";
        ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      });
    }
  };
}

function resolveDiskPath() {
  const candidates = [filePath, `${filePath}.baiduyun.p.downloading`];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
function sparseAllocatedBytes() {
  const resolved = resolveDiskPath();
  if (!resolved) return null;
  try {
    const out = execFileSync('fsutil.exe', ['sparse', 'queryrange', resolved], { windowsHide: true }).toString();
    const hex = [...out.matchAll(/0x([0-9a-fA-F]+)/g)].map(m => Number.parseInt(m[1], 16));
    let total = 0;
    for (let i = 1; i < hex.length; i += 2) total += hex[i];
    return total;
  } catch { return null; }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function percentile(values, p) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
}
function parseSummary(text) {
  const line = (text.match(/SUMMARY[^\r\n]*/g) || []).at(-1) || '';
  const fields = {};
  for (const m of line.matchAll(/([A-Za-z0-9_]+)=(-?\d+)/g)) fields[m[1]] = Number(m[2]);
  return { line, fields };
}
function spawnObserver(exe, args) {
  const proc = spawn(exe, args, { windowsHide: true });
  let stdout = '', stderr = '';
  proc.stdout.on('data', c => stdout += c);
  proc.stderr.on('data', c => stderr += c);
  const closed = new Promise(resolve => {
    proc.on('close', code => resolve({ code, stdout, stderr }));
    proc.on('error', e => resolve({ code: -1, stdout, stderr: stderr + String(e) }));
  });
  return { proc, closed };
}

async function waitFor(conn, predicate, timeoutMs, label) {
  const start = Date.now();
  let prev = null;
  while (Date.now() - start <= timeoutMs) {
    const s = await conn.evalState();
    if (s && predicate(s, prev)) return s;
    prev = s;
    await sleep(pollMs);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function captureRunning(conn) {
  await waitFor(conn, (s, prev) => s.rate > 0 || (prev && s.finish > prev.finish), waitRunningMs, 'running task');
  const exe = path.join(__dirname, 'legacy-live-task-gate-observer.exe');
  const obs = spawnObserver(exe, [nativeTaskId, String(observerIntervalMs), String(durationSec)]);
  const rows = [];
  const diskStart = sparseAllocatedBytes();
  const start = Date.now();
  while (Date.now() - start < durationSec * 1000 + 500) {
    const s = await conn.evalState();
    if (s) rows.push({ t: Date.now(), ...s });
    await sleep(pollMs);
  }
  const o = await obs.closed;
  const rates = rows.map(x => x.rate).filter(x => x > 0);
  const elapsed = rows.length > 1 ? rows.at(-1).t - rows[0].t : 0;
  const finishDelta = rows.length > 1 ? rows.at(-1).finish - rows[0].finish : 0;
  const diskEnd = sparseAllocatedBytes();
  const fileDelta = diskStart != null && diskEnd != null ? diskEnd - diskStart : null;
  const sum = parseSummary(o.stdout);
  return {
    type: 'running',
    observerExit: o.code,
    observerStderr: o.stderr.trim(),
    uiSamples: rows.length,
    positiveRateSamples: rates.length,
    statuses: [...new Set(rows.map(x => x.status))],
    rateMin: rates.length ? Math.min(...rates) : 0,
    rateMax: rates.length ? Math.max(...rates) : 0,
    rateAverage: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
    rateMedian: percentile(rates, 0.5),
    rateP10: percentile(rates, 0.1),
    rateP90: percentile(rates, 0.9),
    elapsedMs: elapsed,
    finishDelta,
    finishBps: elapsed ? Math.round(finishDelta * 1000 / elapsed) : 0,
    fileDelta,
    fileBps: elapsed && fileDelta != null ? Math.round(fileDelta * 1000 / elapsed) : null,
    observer: sum.fields,
    observerSummary: sum.line,
  };
}

async function capturePaused(conn) {
  await waitFor(conn, s => s.rate === 0 && s.status === '3', waitPausedMs, 'paused task');
  const exe = path.join(__dirname, 'legacy-global-gate-lifecycle-observer.exe');
  const obs = spawnObserver(exe, [String(observerIntervalMs), '10']);
  const startState = await conn.evalState();
  const startFile = sparseAllocatedBytes();
  const o = await obs.closed;
  const endState = await conn.evalState();
  const endFile = sparseAllocatedBytes();
  const sum = parseSummary(o.stdout);
  return {
    type: 'paused',
    observerExit: o.code,
    observerStderr: o.stderr.trim(),
    startState,
    endState,
    finishDelta: startState && endState ? endState.finish - startState.finish : null,
    fileDelta: startFile != null && endFile != null ? endFile - startFile : null,
    observer: sum.fields,
    observerSummary: sum.line,
  };
}

(async () => {
  const conn = await connect();
  const result = { capturedAt: new Date().toISOString(), nativeTaskId, uiTaskId, filePath };
  if (pausedOnly) {
    result.paused = await capturePaused(conn);
  } else {
    result.running = await captureRunning(conn);
    if (waitPausedMs > 0) result.paused = await capturePaused(conn);
  }
  conn.ws.close();
  console.log(JSON.stringify(result, null, 2));
})().catch(e => {
  console.error(String(e && e.stack || e));
  process.exit(1);
});
