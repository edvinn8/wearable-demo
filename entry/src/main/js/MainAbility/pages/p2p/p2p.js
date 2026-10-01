import router from '@system.router';
import { P2pClient, Message, Builder } from '../../common/wearengine.js';
import { PHONE_PKG, PHONE_FINGERPRINT } from '../../common/peer.js';

// Wear Engine P2P smoke test with the wear-companion phone app. The phone app must be open and
// have run "2 · Find watch + listen" to receive; it echoes every message back.
// Ping codes from the SDK: 205 = phone app installed, 204 = not installed, 203 = other error.

// Module-level, not in data: page data is observed, and the client is not UI state.
var client = null;

export default {
    data: {
        status: 'ready',
        detail: 'open Wear Companion on the phone first'
    },
    onInit() {
        var self = this;
        client = new P2pClient();
        client.setPeerPkgName(PHONE_PKG);
        client.setPeerFingerPrint(PHONE_FINGERPRINT);
        console.log('[P2P] wearengine service version ' + client.version);
        client.registerReceiver({
            onSuccess: function () {
                console.log('[P2P] receiver registered');
            },
            onFailure: function () {
                self.status = 'RECV FAIL';
                self.detail = 'registerReceiver failed';
            },
            onReceiveMessage: function (message) {
                var text = (message && message.isFileType) ? ('file ' + message.name) : String(message);
                console.log('[P2P] received: ' + text);
                self.status = 'RECEIVED';
                self.detail = text.substring(0, 80);
            }
        });
    },
    onDestroy() {
        if (client) {
            client.unregisterReceiver({ onSuccess: function () {} });
            client = null;
        }
    },
    ping() {
        var self = this;
        self.status = 'pinging…';
        self.detail = '';
        client.ping({
            onSuccess: function () {},
            onFailure: function () {},
            onPingResult: function (r) {
                console.log('[P2P] ping ' + r.code + ' ' + r.data);
                self.status = r.code == 205 ? 'PHONE OK' : ('PING ' + r.code);
                self.detail = r.data;
            }
        });
    },
    sendHello() {
        var self = this;
        var builder = new Builder();
        builder.setDescription('hello from watch');
        var message = new Message();
        message.builder = builder;
        self.status = 'sending…';
        client.send(message, {
            onSuccess: function () {},
            onFailure: function () {},
            onSendResult: function (r) {
                console.log('[P2P] send ' + r.code + ' ' + r.data);
                self.status = r.code == 207 ? 'SENT' : ('SEND ' + r.code);
                self.detail = r.code == 207 ? 'waiting for echo…' : String(r.data);
            },
            onSendProgress: function () {}
        });
    },
    back() {
        router.replace({ uri: 'pages/index/index' });
    }
};
