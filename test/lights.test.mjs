import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const main = new URL('../entry/src/main/js/MainAbility/', import.meta.url);
const wrapper = readFileSync(new URL('common/wearengine.js', main), 'utf8')
    .replace(/^import .*;\s*$/m, '').replace(/^export \{.*\};\s*$/m, '');

function page() {
    let receiver; const sent = []; const routes = []; const timers = new Map(); let sequence = 0;
    const native = {
        getWearEngineVersion(o) { o.complete('5.0.2.401'); },
        setPackageName(o) { o.complete(); }, setFingerprint(o) { o.complete(); },
        unsubscribeMsg() {}, subscribeMsg(o) { receiver = o; },
        sendMsg(o) { sent.push(JSON.parse(o.message)); o.success(); },
    };
    const context = vm.createContext({ wearengine: native, console, PHONE_PKG: 'phone', PHONE_FINGERPRINT: 'fingerprint',
        router: { replace(o) { routes.push(o); } },
        setTimeout(fn) { timers.set(++sequence, fn); return sequence; }, clearTimeout(id) { timers.delete(id); } });
    vm.runInContext(wrapper, context);
    const source = readFileSync(new URL('pages/lights/lights.js', main), 'utf8')
        .replace(/^import .*;\s*$/gm, '').replace('export default', 'var page =');
    vm.runInContext(source, context);
    const p = context.page; Object.assign(p, JSON.parse(JSON.stringify(p.data)));
    p.$refs = { listRef: { rotation() {} } };
    p.onInit();
    return { p, sent, timers, native, routes,
        ready() { receiver.success({ isRegister: true }); },
        reply(o) { receiver.success({ message: JSON.stringify(o) }); },
        fire() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
        last() { return sent.at(-1); } };
}

const rows = [
    { id: 'living-room', n: 'Living room', on: false, off: false },
    { id: 'office', n: 'Office lights', on: true, off: true },
];
function catalogue(x) { x.reply({ t: 'lights', id: x.last().id, p: 0, last: true, l: rows }); }

test('lights waits for receiver readiness, loads the phone catalogue and disables placeholders', () => {
    const x = page(); assert.equal(x.sent.length, 0); x.ready();
    assert.equal(x.last().t, 'lights'); assert.ok(x.last().id); catalogue(x);
    assert.equal(x.p.lights.length, 2); assert.equal(x.p.lights[0].name, 'Living room');
    x.p.setLight(0, 'on'); assert.equal(x.sent.length, 1);
    x.p.setLight(1, 'on'); assert.equal(x.last().t, 'light'); assert.equal(x.last().l, 'office'); assert.equal(x.last().a, 'on');
    assert.equal(x.p.busy, true); assert.equal(x.p.lights[1].status, 'Sending On…'); x.p.onDestroy();
});

test('lights ignores unrelated replies and rapid repeat taps, then reports the matching result', () => {
    const x = page(); x.ready(); catalogue(x); x.p.setLight(1, 'off'); const cmd = x.last();
    x.p.setLight(1, 'on'); assert.equal(x.sent.length, 2);
    x.reply({ t: 'pos', net: 50 }); assert.equal(x.p.busy, true);
    x.reply({ t: 'lightres', id: 'other', ok: true }); assert.equal(x.p.busy, true);
    x.reply({ t: 'lightres', id: cmd.id, l: 'office', a: 'off', ok: true, m: 'Off request sent' });
    assert.equal(x.p.busy, false); assert.equal(x.p.lights[1].status, 'Off request sent'); assert.equal(x.timers.size, 0);
    x.reply({ t: 'lightres', id: cmd.id, l: 'office', a: 'off', ok: false, m: 'late duplicate' });
    assert.equal(x.p.lights[1].status, 'Off request sent'); x.p.onDestroy();
});

test('lights assembles ordered catalogue frames and ignores duplicate frames', () => {
    const x = page(); x.ready(); const id = x.last().id;
    x.reply({ t: 'lights', id, p: 0, last: false, l: [rows[0]] });
    x.reply({ t: 'lights', id, p: 0, last: false, l: [rows[0]] });
    x.reply({ t: 'lights', id, p: 1, last: true, l: [rows[1]] });
    assert.equal(x.p.lights.length, 2); assert.equal(x.p.lights[1].name, 'Office lights'); assert.equal(x.p.busy, false);
    x.p.onDestroy();
});

test('lights buffers out-of-order catalogue frames until missing pages arrive', () => {
    const x = page(); x.ready(); const id = x.last().id;
    x.reply({ t: 'lights', id, p: 1, last: true, l: [rows[1]] });
    x.reply({ t: 'lights', id, p: 1, last: true, l: [rows[1]] });
    assert.equal(x.p.busy, true); assert.equal(x.p.lights.length, 0);
    x.reply({ t: 'lights', id, p: 0, last: false, l: [rows[0]] });
    assert.equal(x.p.busy, false); assert.equal(x.timers.size, 0);
    assert.deepEqual(Array.from(x.p.lights, row => row.id), ['living-room', 'office']);
    x.p.onDestroy();
});

test('lights failure and timeout do not claim the light changed, and allow another request', () => {
    const x = page(); x.ready(); catalogue(x); x.p.setLight(1, 'on'); const cmd = x.last();
    x.reply({ t: 'lightres', id: cmd.id, l: 'office', a: 'on', ok: false, m: 'Webhook failed — outcome unknown' });
    assert.equal(x.p.busy, false); assert.equal(x.p.lights[1].status, 'Webhook failed — outcome unknown');
    x.p.setLight(1, 'off'); x.fire();
    assert.equal(x.p.busy, false); assert.match(x.p.lights[1].status, /unknown/); x.p.onDestroy();
});

test('lights delivery failure and malformed replies do not leave an eternal pending command', () => {
    const x = page(); x.ready(); catalogue(x);
    x.native.sendMsg = o => o.fail('disconnected', 206);
    x.p.setLight(1, 'on'); assert.equal(x.p.busy, false); assert.match(x.p.lights[1].status, /not sent/i);
    assert.equal(x.timers.size, 0); x.p.onDestroy();
});

test('lights cleans up timers and ignores callbacks after leaving the page', () => {
    const x = page(); x.ready(); catalogue(x); x.p.setLight(1, 'on');
    x.p.onDestroy(); assert.equal(x.timers.size, 0);
    const status = x.p.lights[1].status;
    x.reply({ t: 'lightres', id: x.last().id, l: 'office', a: 'on', ok: true, m: 'late' });
    assert.equal(x.p.lights[1].status, status); x.ready(); assert.equal(x.sent.length, 2);
});
