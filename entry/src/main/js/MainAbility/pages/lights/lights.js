import router from '@system.router';
import { P2pClient, Message, Builder } from '../../common/wearengine.js';
import { PHONE_PKG, PHONE_FINGERPRINT } from '../../common/peer.js';

// Phone owns the catalogue and credentials. Success is a webhook acknowledgement, not sensed state.
var client = null;
var answerTimer = null;
var pending = null;
var sequence = 0;
var cataloguePage = 0;
var catalogueFrames = {};
var ready = false;
var TIMEOUT_MS = 20000;

export default {
    data: {
        lights: [],
        busy: true,
        status: 'Connecting to phone…'
    },
    onInit() {
        var self = this;
        ready = false;
        pending = null;
        client = new P2pClient();
        var visit = client;
        client.setPeerPkgName(PHONE_PKG);
        client.setPeerFingerPrint(PHONE_FINGERPRINT);
        client.registerReceiver({
            onSuccess: function () {
                if (client !== visit || ready) return;
                ready = true;
                self.refresh();
            },
            onFailure: function () {
                if (client !== visit) return;
                self.busy = true;
                self.status = 'Can\'t listen to phone';
            },
            onReceiveMessage: function (message) {
                if (client !== visit || (message && message.isFileType)) return;
                self.onReply(String(message));
            }
        });
    },
    onShow() {
        this.$refs.listRef.rotation({ focus: true });
    },
    onDestroy() {
        this.clearTimer();
        pending = null;
        ready = false;
        if (client) {
            var previous = client;
            client = null;
            previous.unregisterReceiver({ onSuccess: function () {} });
        }
    },
    request(request, index) {
        if (!client || !ready || pending) return;
        sequence = sequence + 1;
        request.id = 'l' + new Date().getTime() + '-' + sequence;
        pending = { id: request.id, type: request.t, index: index, light: request.l, action: request.a };
        this.busy = true;
        var self = this;
        var visit = client;
        var id = request.id;
        // Arm before sending: a fast reply must be able to cancel the timer.
        answerTimer = setTimeout(function () {
            if (client === visit && pending && pending.id === id) {
                self.finish('No phone reply — outcome unknown');
            }
        }, TIMEOUT_MS);
        var builder = new Builder();
        builder.setDescription(JSON.stringify(request));
        var message = new Message();
        message.builder = builder;
        client.send(message, {
            onSuccess: function () {},
            onFailure: function () {},
            onSendProgress: function () {},
            onSendResult: function (result) {
                if (client === visit && pending && pending.id === id && result.code != 207) {
                    self.finish('Not sent — phone unavailable');
                }
            }
        });
    },
    refresh() {
        if (!ready || pending) return;
        cataloguePage = 0;
        catalogueFrames = {};
        this.status = 'Loading lights…';
        this.request({ t: 'lights' }, -1);
    },
    setLight(index, action) {
        if (this.busy || !ready || pending || index < 0 || index >= this.lights.length) return;
        var light = this.lights[index];
        if ((action !== 'on' && action !== 'off') || !light[action]) return;
        this.setStatus(index, action === 'on' ? 'Sending On…' : 'Sending Off…');
        this.status = 'Waiting for phone…';
        this.request({ t: 'light', l: light.id, a: action }, index);
    },
    onReply(text) {
        if (!pending) return;
        var reply;
        try { reply = JSON.parse(text); } catch (e) { return; }
        if (!reply || reply.id !== pending.id) return;
        if (pending.type === 'lights' && reply.t === 'lights') {
            if (reply.ok === false) {
                this.lights = [];
                this.finish(reply.m || 'Lights configuration error');
                return;
            }
            if (typeof reply.p !== 'number' || reply.p < cataloguePage || Math.floor(reply.p) !== reply.p
                    || !Array.isArray(reply.l) || typeof reply.last !== 'boolean') return;
            if (catalogueFrames[reply.p]) return;
            var rows = [];
            var i;
            for (i = 0; i < reply.l.length; i++) {
                var row = reply.l[i];
                if (!row || typeof row.id !== 'string' || typeof row.n !== 'string'
                        || typeof row.on !== 'boolean' || typeof row.off !== 'boolean') return;
                rows.push({ id: row.id, name: row.n, on: row.on, off: row.off,
                    status: row.on || row.off ? 'Choose On or Off' : 'Not configured' });
            }
            // Wear Engine sends asynchronously; keep future pages until their predecessors arrive.
            catalogueFrames[reply.p] = { rows: rows, last: reply.last };
            while (catalogueFrames[cataloguePage]) {
                var frame = catalogueFrames[cataloguePage];
                delete catalogueFrames[cataloguePage];
                this.lights = cataloguePage === 0 ? frame.rows : this.lights.concat(frame.rows);
                cataloguePage = cataloguePage + 1;
                if (frame.last) {
                    this.finish(this.lights.length ? 'Phone executes each request' : 'No lights configured');
                    break;
                }
            }
            return;
        }
        if (pending.type === 'light' && reply.t === 'lightres' && reply.l === pending.light
                && reply.a === pending.action && typeof reply.ok === 'boolean' && typeof reply.m === 'string') {
            this.finish(reply.m);
        }
    },
    finish(message) {
        if (!pending) return;
        var index = pending.index;
        this.clearTimer();
        pending = null;
        catalogueFrames = {};
        this.busy = false;
        this.status = message;
        if (index >= 0) this.setStatus(index, message);
    },
    setStatus(index, text) {
        var rows = [];
        for (var i = 0; i < this.lights.length; i++) {
            var row = this.lights[i];
            rows.push({ id: row.id, name: row.name, on: row.on, off: row.off, status: i === index ? text : row.status });
        }
        this.lights = rows;
    },
    clearTimer() {
        if (answerTimer !== null) {
            clearTimeout(answerTimer);
            answerTimer = null;
        }
    },
    back() {
        router.replace({ uri: 'pages/index/index' });
    },
    swipe(e) {
        if (e.direction === 'right') this.back();
    }
};
