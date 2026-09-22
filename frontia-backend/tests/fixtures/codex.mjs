// A deterministic stdio peer. This never contacts OpenAI or uses real credentials.
import { createInterface } from 'node:readline';
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
let seq = 0;
createInterface({ input: process.stdin }).on('line', line => {
  const { id, method, params: p } = JSON.parse(line);
  if (!method || id === undefined) return;
  const reply = result => send({ id, result });
  if (method === 'initialize') return reply({});
  if (method === 'account/read') return reply({ account: { type: 'chatgpt', planType: 'plus' } });
  if (method === 'model/list') return reply({ data: [{ model: 'test-model', displayName: 'Test', isDefault: true }], nextCursor: null });
  if (method === 'account/login/start') {
    reply({ loginId: 'test-login', verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'TEST-CODE' });
    return send({ method: 'account/login/completed', params: { loginId: 'test-login', success: true } });
  }
  if (method === 'thread/start') {
    if (p.sandbox !== 'read-only' || p.approvalPolicy !== 'never' || !p.ephemeral || p.config['features.shell_tool'] !== false) throw new Error('Unsafe thread settings');
    return reply({ thread: { id: `thread-${++seq}` } });
  }
  if (method === 'turn/start') {
    const payload = JSON.parse(p.input[0].text);
    if (payload.input === 'rpcfail') return send({ id, error: { code: -1, message: 'Fixture error' } });
    if (payload.input === 'sandboxfail') return send({ id, error: { code: -1, message: 'bwrap: Operation not permitted' } });
    if (p.sandboxPolicy.networkAccess !== false || !p.outputSchema) throw new Error('Missing turn constraints');
    const turnId = `turn-${seq}`;
    reply({ turn: { id: turnId } });
    if (payload.input === 'timeout') return;
    if (payload.input === 'exit') return process.exit(1);
    const params = { threadId: p.threadId, turnId, itemId: `message-${seq}` };
    const scene = { chapter: 'ฉากทดสอบ', location: 'สถานี', speaker: 'มีนา', body: 'ฝนตกเบา ๆ\n\n“คุณจะไปด้วยกันไหม?”', choices: [{ id: 'a', label: 'ไปด้วย' }, { id: 'b', label: 'รอก่อน' }], memory: 'พบมีนาที่สถานี' };
    const output = payload.input === 'badjson' ? 'not json' : JSON.stringify(scene);
    send({ method: 'item/agentMessage/delta', params: { ...params, threadId: 'unrelated', delta: 'ignore' } });
    send({ method: 'item/agentMessage/delta', params: { delta: 'unscoped noise' } });
    send({ id: 'approval-test', method: 'item/commandExecution/requestApproval', params });
    if (payload.input === 'final-only') send({ method: 'item/completed', params: { ...params, item: { type: 'agentMessage', phase: 'final_answer', text: output } } });
    else for (let i = 0; i < output.length; i += 31) send({ method: 'item/agentMessage/delta', params: { ...params, delta: output.slice(i, i + 31) } });
    return send({ method: 'turn/completed', params: { ...params, turn: { id: turnId, status: payload.input === 'failed' ? 'failed' : 'completed' } } });
  }
  reply({});
});
