import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const main = new URL('../entry/src/main/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('config.json', main), 'utf8'));

function menu(info) {
    const routes = []; let exited = false;
    const context = vm.createContext({
        app: { getInfo() { return info; }, terminate() { exited = true; } },
        router: { replace(o) { routes.push(o.uri); } },
    });
    const source = readFileSync(new URL('js/MainAbility/pages/index/index.js', main), 'utf8')
        .replace(/^import .*;\s*$/gm, '').replace('export default', 'var page =');
    vm.runInContext(source, context);
    const p = context.page; Object.assign(p, JSON.parse(JSON.stringify(p.data)));
    p.onInit();
    return { p, routes, exited: () => exited };
}

test('the menu shows the installed version from the build, not a hard-coded one', () => {
    assert.equal(menu({ versionName: config.app.version.name }).p.version, 'v' + config.app.version.name);
    assert.equal(menu(undefined).p.version, '');
    const hml = readFileSync(new URL('js/MainAbility/pages/index/index.hml', main), 'utf8');
    assert.doesNotMatch(hml, /v\d+\.\d+/);
});

test('the menu offers Lights and Exit only', () => {
    const hml = readFileSync(new URL('js/MainAbility/pages/index/index.hml', main), 'utf8');
    assert.deepEqual(Array.from(hml.matchAll(/value="([^"{]+)"/g), m => m[1]), ['Lights', 'Exit']);
    const x = menu({ versionName: '1' });
    x.p.goLights(); assert.deepEqual(x.routes, ['pages/lights/lights']);
    x.p.appExit(); assert.equal(x.exited(), true);
});

test('the P2P test page is gone from the build', () => {
    assert.deepEqual(config.module.js[0].pages, ['pages/lights/lights', 'pages/index/index']);
    assert.equal(existsSync(new URL('js/MainAbility/pages/p2p', main)), false);
});

test('the Lights page footer has Refresh and Back', () => {
    const hml = readFileSync(new URL('js/MainAbility/pages/lights/lights.hml', main), 'utf8');
    assert.match(hml, /value="Refresh"/); assert.match(hml, /value="Back" onclick="back"/);
    assert.doesNotMatch(hml, /Tools/);
});
