import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const main = new URL('../entry/src/main/js/MainAbility/', import.meta.url);
const wrapper = readFileSync(new URL('common/wearengine.js', main), 'utf8')
    .replace(/^import .*;\s*$/m, '').replace(/^export \{.*\};\s*$/m, '');

function runtime(immediateVersion = false) {
    const calls = [];
    const logs = [];
    const native = {
        getWearEngineVersion(options) { if (immediateVersion) options.complete('5.0.2.401'); },
        setPackageName(options) { calls.push('package'); options.complete(); },
        setFingerprint(options) { calls.push('fingerprint'); options.complete(); },
        unsubscribeMsg() { calls.push('unsubscribe'); },
        subscribeMsg(options) { calls.push('subscribe'); native.receiver = options; },
        detect(options) { calls.push('detect'); options.success(); },
        sendMsg(options) { calls.push('send'); native.lastSent = options; options.success(); },
    };
    const context = vm.createContext({ wearengine: native, console: {
        info: (...args) => logs.push(args.join(' ')), log: (...args) => logs.push(args.join(' ')),
        error: (...args) => logs.push(args.join(' ')),
    }});
    vm.runInContext(wrapper, context);
    const client = new context.P2pClient();
    client.setPeerPkgName('com.edvinn.wearcompanion');
    client.setPeerFingerPrint('73A6B25A06E39EBAA6D14E4A0F53540AF225E4CF182A533EEEE9D1034CDA2FCF');
    return { context, native, client, calls, logs };
}

for (const immediate of [false, true]) {
    test(`native GT6 round trip works with ${immediate ? 'immediate' : 'delayed'} version callback`, () => {
        const { context, native, client, calls } = runtime(immediate);
        let ready = false;
        let reply;
        assert.doesNotThrow(() => client.registerReceiver({
            onSuccess() { ready = true; }, onFailure() { assert.fail('registration failed'); },
            onReceiveMessage(text) { reply = text; },
        }));
        native.receiver.success({ isRegister: true });
        assert.equal(ready, true);
        let pingCode;
        client.ping({ onSuccess() {}, onFailure() {}, onPingResult(r) { pingCode = r.code; } });
        assert.equal(pingCode, 205);
        const message = new context.Message();
        message.builder = new context.Builder();
        message.builder.setDescription('hello from watch');
        let sendCode;
        client.send(message, { onSuccess() {}, onFailure() {}, onSendProgress() {}, onSendResult(r) { sendCode = r.code; } });
        assert.equal(sendCode, 207);
        assert.equal(native.lastSent.message, 'hello from watch');
        native.receiver.success({ message: 'echo: hello from watch' });
        assert.equal(reply, 'echo: hello from watch');
        client.unregisterReceiver({ onSuccess() {} });
        assert.ok(calls.includes('detect'));
        assert.ok(calls.includes('send'));
    });
}

test('native registration failure retains its original code in logs', () => {
    const { client, native, logs } = runtime(true);
    let failed = false;
    client.registerReceiver({ onSuccess() {}, onFailure() { failed = true; }, onReceiveMessage() {} });
    native.receiver.fail('denied', 123);
    assert.equal(failed, true);
    assert.ok(logs.some(line => line.includes('subscribeMsg') && line.includes('123') && line.includes('denied')));
});

test('watch installation declares its phone peer in supportLists', () => {
    const config = JSON.parse(readFileSync(new URL('../entry/src/main/config.json', import.meta.url)));
    const metadata = config.module.metaData?.customizeData || [];
    const peer = readFileSync(new URL('common/peer.js', main), 'utf8');
    const pkg = peer.match(/PHONE_PKG = '([^']+)'/)[1];
    const fingerprint = peer.match(/PHONE_FINGERPRINT = '([^']+)'/)[1];
    assert.equal(metadata.find(item => item.name === 'supportLists')?.value, `${pkg}:${fingerprint}`);
});
