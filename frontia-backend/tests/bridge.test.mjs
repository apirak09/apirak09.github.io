import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodexBridge } from '../codex-bridge.mjs';

async function bridge(t, overrides = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cinematic-bridge-'));
  const instance = new CodexBridge({ workspace: dir, codexDir: dir, command: process.execPath, prefixArgs: [fileURLToPath(new URL('./fixtures/codex.mjs', import.meta.url))], rpcTimeout: 1000, turnTimeout: 200, ...overrides });
  t.after(async () => { instance.close(); await fs.rm(dir, { recursive: true, force: true }); });
  return instance;
}
function clean(instance) {
  for (const event of ['item/agentMessage/delta', 'item/completed', 'turn/completed', 'disconnected']) assert.equal(instance.events.listenerCount(event), 0, event);
}
test('Codex streaming produces one JSON response with isolated threads and no leaked listeners', async t => {
  const b = await bridge(t);
  for (let i = 0; i < 3; i++) {
    const result = await b.roleplay({ model: 'test-model', input: 'ถามมีนา' });
    assert.equal(result.scene.body, 'ฝนตกเบา ๆ\n\n“คุณจะไปด้วยกันไหม?”');
    assert.equal(result.memory, 'พบมีนาที่สถานี'); clean(b);
  }
});
test('Codex final agent messages work without deltas', async t => {
  const b = await bridge(t);
  assert.equal((await b.roleplay({ model: 'test-model', input: 'final-only' })).scene.choices.length, 2); clean(b);
});
for (const [input, code] of [['rpcfail', 'codex_rpc_error'], ['sandboxfail', 'sandbox_unavailable'], ['badjson', 'invalid_output'], ['failed', 'turn_failed'], ['timeout', 'turn_timeout'], ['exit', 'codex_unavailable']]) {
  test(`Codex ${input} fails safely and cleans up`, async t => {
    const b = await bridge(t); await assert.rejects(b.roleplay({ model: 'test-model', input }), { code }); clean(b);
  });
}
test('Codex cancellation interrupts an active turn', async t => {
  const b = await bridge(t); await b.ready(); const controller = new AbortController();
  const job = b.roleplay({ model: 'test-model', input: 'timeout' }, controller.signal);
  const timer = setTimeout(() => controller.abort(), 50);
  await assert.rejects(job, { code: 'cancelled' }); clearTimeout(timer); clean(b);
});
test('missing Codex executable is a recoverable service error, not an uncaught exception', async t => {
  const b = await bridge(t, { command: '/not-installed/codex', prefixArgs: [] });
  await assert.rejects(b.ready(), { status: 503 });
});
test('device login status is correlated to its login ID', async t => {
  const b = await bridge(t); const login = await b.loginDevice();
  assert.equal((await b.account(login.loginId)).login.success, true);
  assert.equal((await b.account('different-login')).login, null); await b.cancelLogin(login.loginId);
});
