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

// Catalogue rows as the phone sends them: id, name, room label, state.
const rows = [
    { id: '1001482cd9:0', n: 'Living Room Light', r: 'Livingroom', s: 'off' },
    { id: '100156392c', n: 'Office lights', r: 'Other', s: 'on' },
    { id: '1001563204', n: 'Bathroom Fan', r: '', s: 'offline' },
];
function catalogue(x) { x.reply({ t: 'lights', id: x.last().id, p: 0, last: true, l: rows }); }
const light = (x, i) => x.p.lights[i];
function answer(x, cmd, extra) { x.reply(Object.assign({ t: 'lightres', id: cmd.id, l: cmd.l, a: cmd.a }, extra)); }

test('lights waits for receiver readiness, then loads the phone list with each light state', () => {
    const x = page(); assert.equal(x.sent.length, 0); x.ready();
    assert.equal(x.last().t, 'lights'); assert.ok(x.last().id); catalogue(x);
    assert.equal(x.p.lights.length, 3); assert.equal(x.p.loading, false);
    assert.deepEqual(Array.from(x.p.lights, l => [l.name, l.label, l.isOn, l.isOff, l.isOther]), [
        ['Living Room Light', 'Off', false, true, false],
        ['Office lights', 'On', true, false, false],
        ['Bathroom Fan', 'Offline', false, false, true],
    ]);
    assert.equal(light(x, 0).line, 'Livingroom');
    assert.equal(x.timers.size, 0); x.p.onDestroy();
});

test('a tap flips the light at once and sends the opposite action', () => {
    const x = page(); x.ready(); catalogue(x);
    x.p.toggle(0);
    const cmd = x.last();
    assert.equal(cmd.t, 'light'); assert.equal(cmd.l, '1001482cd9:0'); assert.equal(cmd.a, 'on');
    assert.equal(light(x, 0).isOn, true); assert.equal(light(x, 0).label, 'On…'); assert.equal(light(x, 0).pending, true);
    answer(x, cmd, { ok: true, m: 'On', s: 'on' });
    assert.equal(light(x, 0).label, 'On'); assert.equal(light(x, 0).pending, false); assert.equal(light(x, 0).line, 'Livingroom');
    assert.equal(x.timers.size, 0); x.p.onDestroy();
});

test('other lights can switch while one waits, but the same light ignores repeat taps', () => {
    const x = page(); x.ready(); catalogue(x);
    x.p.toggle(0); const first = x.last();
    x.p.toggle(0); assert.equal(x.last(), first);
    x.p.toggle(1); const second = x.last();
    assert.notEqual(second.id, first.id); assert.equal(second.l, '100156392c'); assert.equal(second.a, 'off');
    assert.equal(x.sent.length, 3);
    answer(x, second, { ok: true, m: 'Off', s: 'off' });
    assert.equal(light(x, 1).isOff, true); assert.equal(light(x, 0).pending, true);
    answer(x, first, { ok: true, m: 'On', s: 'on' });
    assert.equal(light(x, 0).isOn, true); assert.equal(x.timers.size, 0); x.p.onDestroy();
});

test('a failed switch puts the light back and shows the reason', () => {
    const x = page(); x.ready(); catalogue(x);
    x.p.toggle(0); const cmd = x.last();
    answer(x, cmd, { ok: false, m: 'Living Room Light is offline', s: 'offline' });
    assert.equal(light(x, 0).isOther, true); assert.equal(light(x, 0).label, 'Offline');
    assert.equal(light(x, 0).line, 'Living Room Light is offline'); assert.equal(x.p.status, 'Living Room Light is offline');
    x.p.toggle(1); const other = x.last();
    answer(x, other, { ok: false, m: 'Dashboard refused the request' });
    assert.equal(light(x, 1).isOn, true); x.p.onDestroy();
});

test('an unconfirmed switch keeps the tapped state and says so', () => {
    const x = page(); x.ready(); catalogue(x);
    x.p.toggle(0); const cmd = x.last();
    answer(x, cmd, { ok: true, m: 'Sent — not confirmed yet', s: 'on' });
    assert.equal(light(x, 0).isOn, true); assert.match(light(x, 0).line, /not confirmed/); x.p.onDestroy();
});

test('offline and unknown lights cannot be tapped', () => {
    const x = page(); x.ready(); catalogue(x);
    x.p.toggle(2); assert.equal(x.sent.length, 1); x.p.onDestroy();
});

test('unrelated, mismatched and late replies are ignored', () => {
    const x = page(); x.ready(); catalogue(x); x.p.toggle(1); const cmd = x.last();
    x.reply({ t: 'pos', net: 50 }); x.reply({ t: 'lightres', id: 'other', ok: true, m: 'On' });
    x.reply({ t: 'lightres', id: cmd.id, l: cmd.l, a: 'on', ok: true, m: 'On' });
    assert.equal(light(x, 1).pending, true);
    answer(x, cmd, { ok: true, m: 'Off', s: 'off' });
    answer(x, cmd, { ok: false, m: 'late duplicate', s: 'on' });
    assert.equal(light(x, 1).isOff, true); assert.equal(light(x, 1).line, 'Other'); x.p.onDestroy();
});

test('no reply in time leaves the light unknown until a refresh', () => {
    const x = page(); x.ready(); catalogue(x); x.p.toggle(0); x.fire();
    assert.equal(light(x, 0).isOther, true); assert.equal(light(x, 0).label, '?');
    assert.match(light(x, 0).line, /unknown/); assert.equal(light(x, 0).pending, false);
    x.p.toggle(0); assert.equal(x.sent.length, 2); x.p.onDestroy();
});

test('a light that could not be sent is put back at once without waiting for a timeout', () => {
    const x = page(); x.ready(); catalogue(x);
    x.native.sendMsg = o => o.fail('disconnected', 206);
    x.p.toggle(1); assert.equal(light(x, 1).isOn, true); assert.equal(light(x, 1).pending, false);
    assert.match(light(x, 1).line, /not sent/i); assert.equal(x.timers.size, 0);
    x.p.refresh(); assert.equal(x.p.loading, false); assert.match(x.p.status, /not sent/i); assert.equal(x.timers.size, 0);
    x.p.onDestroy();
});

test('lights assembles ordered catalogue frames and ignores duplicates and bad rows', () => {
    const x = page(); x.ready(); const id = x.last().id;
    x.reply({ t: 'lights', id, p: 1, last: true, l: [rows[1]] });
    x.reply({ t: 'lights', id, p: 1, last: true, l: [rows[1]] });
    assert.equal(x.p.loading, true); assert.equal(x.p.lights.length, 0);
    x.reply({ t: 'lights', id, p: 0, last: false, l: [rows[0]] });
    assert.equal(x.p.loading, false); assert.equal(x.timers.size, 0);
    assert.deepEqual(Array.from(x.p.lights, l => l.id), ['1001482cd9:0', '100156392c']);
    x.p.refresh(); const again = x.last().id;
    x.reply({ t: 'lights', id: again, p: 0, last: true, l: [{ id: 'x', n: 'Bad', s: 'dimmed' }] });
    assert.equal(x.p.loading, true); x.p.onDestroy();
});

test('refresh keeps a light that is still switching in its tapped state', () => {
    const x = page(); x.ready(); catalogue(x); x.p.toggle(0); const cmd = x.last();
    x.p.refresh(); x.reply({ t: 'lights', id: x.last().id, p: 0, last: true, l: rows });
    assert.equal(light(x, 0).isOn, true); assert.equal(light(x, 0).pending, true);
    answer(x, cmd, { ok: true, m: 'On', s: 'on' }); assert.equal(light(x, 0).pending, false); x.p.onDestroy();
});

test('a phone error replaces the list and explains it', () => {
    const x = page(); x.ready();
    x.reply({ t: 'lights', id: x.last().id, p: 0, last: true, l: [], ok: false, m: 'No light states yet — open Lights in EDOS Dashboard' });
    assert.equal(x.p.lights.length, 0); assert.match(x.p.status, /EDOS Dashboard/); assert.equal(x.timers.size, 0); x.p.onDestroy();
});

test('lights cleans up timers and ignores callbacks after leaving the page', () => {
    const x = page(); x.ready(); catalogue(x); x.p.toggle(1); const cmd = x.last();
    x.p.onDestroy(); assert.equal(x.timers.size, 0);
    const before = JSON.stringify(x.p.lights);
    answer(x, cmd, { ok: true, m: 'Off', s: 'off' });
    assert.equal(JSON.stringify(x.p.lights), before); x.ready(); assert.equal(x.sent.length, 2);
});
