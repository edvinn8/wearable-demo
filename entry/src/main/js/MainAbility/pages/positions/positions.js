import app from '@system.app';
import router from '@system.router';
import { P2pClient, Message, Builder } from '../../common/wearengine.js';
import { PHONE_PKG, PHONE_FINGERPRINT } from '../../common/peer.js';

// Positions from the phone (wear-companion LinkService) over Wear Engine P2P.
// Asks with "get" on open and every REFRESH_MS; the phone also pushes changes while we keep asking.
// Reply format: wear-companion Protocol.java — {"t":"pos",st,age,cur,eq,bal,net,ml,n,demo,g:[[side,sym,lots,count,net]],more}
// or {"t":"err","m":"..."}.
var REFRESH_MS = 30000;
var ANSWER_TIMEOUT_MS = 10000;

// Module-level: not UI state.
var client = null;
var refreshTimer = null;
var answerTimer = null;
var receivedAt = 0;
var lastAge = 0;

// "1234567" -> "1,234,567" (no regex lookahead — keep it simple for the lite JS engine).
function group(digits) {
    var out = '';
    for (var i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out = out + ',';
        }
        out = out + digits.charAt(i);
    }
    return out;
}

function money(n) {
    var sign = n < 0 ? '-' : (n > 0 ? '+' : '');
    var parts = Math.abs(n).toFixed(2).split('.');
    return sign + group(parts[0]) + '.' + parts[1];
}

function plain(n) {
    var r = Math.round(n);
    return (r < 0 ? '-' : '') + group(Math.abs(r).toString());
}

function ageText(s) {
    if (s < 0) return 'no time';
    if (s < 90) return s + 's ago';
    if (s < 5400) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
}

export default {
    data: {
        netText: '…',
        netUp: false,
        netDown: false,
        subText: 'asking the phone',
        rows: [],
        hasRows: false,
        msg: '',
        hasMsg: false,
        foot: ''
    },
    onInit() {
        var self = this;
        client = new P2pClient();
        var pageClient = client;
        var ready = false;
        client.setPeerPkgName(PHONE_PKG);
        client.setPeerFingerPrint(PHONE_FINGERPRINT);
        client.registerReceiver({
            onSuccess: function () {
                if (client !== pageClient || ready) {
                    return;
                }
                ready = true;
                console.log('[POSITIONS] receiver ready; requesting phone data');
                self.refresh();
                refreshTimer = setInterval(function () {
                    self.refresh();
                }, REFRESH_MS);
            },
            onFailure: function () {
                self.showMessage('Can\'t listen to the phone (Wear Engine)');
            },
            onReceiveMessage: function (message) {
                if (message && message.isFileType) {
                    return;
                }
                self.onReply(String(message));
            }
        });
    },
    onDestroy() {
        if (refreshTimer !== null) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        this.clearAnswerTimer();
        if (client) {
            client.unregisterReceiver({ onSuccess: function () {} });
            client = null;
        }
    },
    refresh() {
        var self = this;
        if (!client) {
            return;
        }
        this.foot = 'asking…';
        var builder = new Builder();
        builder.setDescription('{"t":"get"}');
        var message = new Message();
        message.builder = builder;
        // Arm before sending: a fast response must be able to clear this timer.
        this.clearAnswerTimer();
        answerTimer = setTimeout(function () {
            answerTimer = null;
            self.phoneUnavailable();
        }, ANSWER_TIMEOUT_MS);
        client.send(message, {
            onSuccess: function () {},
            onFailure: function () {},
            onSendResult: function (r) {
                if (r.code != 207) {
                    self.phoneUnavailable();
                }
            },
            onSendProgress: function () {}
        });
    },
    onReply(text) {
        if (text.indexOf('echo:') === 0) {
            return;
        }
        var o;
        try {
            o = JSON.parse(text);
        } catch (e) {
            return;
        }
        this.clearAnswerTimer();
        receivedAt = new Date().getTime();
        if (o.t === 'err') {
            this.showMessage(o.m || 'Phone error');
            this.foot = 'updated ' + this.clock();
            return;
        }
        if (o.t !== 'pos') {
            return;
        }
        lastAge = o.age;
        this.netText = money(o.net) + ' ' + o.cur;
        this.netUp = o.net >= 0;
        this.netDown = o.net < 0;
        var sub = 'Eq ' + plain(o.eq);
        if (o.ml !== null && o.ml !== undefined) {
            sub = sub + ' · ML ' + o.ml + '%';
        }
        if (o.demo) {
            sub = sub + ' · demo';
        }
        this.subText = sub;

        var rows = [];
        for (var i = 0; i < o.g.length; i++) {
            var g = o.g[i];
            var count = g[3] > 1 ? ' ×' + g[3] : '';
            rows.push({
                label: (g[0] === 'S' ? 'S ' : 'B ') + g[1] + ' ' + g[2].toFixed(2) + count,
                net: money(g[4]),
                up: g[4] >= 0,
                down: g[4] < 0
            });
        }
        if (o.more) {
            rows.push({ label: '+' + o.more + ' more', net: '', up: true, down: false });
        }
        this.rows = rows;
        this.hasRows = rows.length > 0;
        this.hasMsg = rows.length === 0;
        this.msg = rows.length === 0 ? 'No open positions' : '';

        var state = o.st === 'live' ? '' : (o.st === 'stopped' ? 'cBot stopped · ' : 'cBot not updating · ');
        this.foot = state + ageText(o.age);
    },
    phoneUnavailable() {
        this.clearAnswerTimer();
        var seen = receivedAt ? ' · last ' + this.clock() : '';
        this.foot = 'phone unavailable' + seen;
        if (!receivedAt) {
            this.showMessage('Phone unavailable — open Wear Companion on the phone, then Refresh');
        }
    },
    showMessage(text) {
        this.rows = [];
        this.hasRows = false;
        this.msg = text;
        this.hasMsg = true;
        this.netText = '—';
        this.netUp = false;
        this.netDown = false;
    },
    clearAnswerTimer() {
        if (answerTimer !== null) {
            clearTimeout(answerTimer);
            answerTimer = null;
        }
    },
    clock() {
        var d = new Date(receivedAt);
        var m = d.getMinutes();
        return d.getHours() + ':' + (m < 10 ? '0' + m : m);
    },
    tools() {
        router.replace({ uri: 'pages/index/index' });
    },
    swipe(e) {
        if (e.direction === 'right') {
            app.terminate();
        }
    }
};
