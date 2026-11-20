import router from '@system.router';
import { P2pClient, Message, Builder } from '../../common/wearengine.js';
import { PHONE_PKG, PHONE_FINGERPRINT } from '../../common/peer.js';

// The phone reads the household light states from EDOS Dashboard and switches through its setLight
// function. A tap flips the light here at once; the phone's reply confirms it or puts it back.
// Several lights can switch at once; the same light ignores taps until its reply arrives.
var client = null;
var ready = false;
var sequence = 0;
var catalogue = null;   // { id, page, frames, timer } while a list request is open
var inflight = {};      // request id -> { light, action, previous, timer }
var TIMEOUT_MS = 20000;

var LABELS = { on: 'On', off: 'Off', offline: 'Offline', unknown: '?' };

function row(id, name, room, state, pending, note) {
    return {
        id: id, name: name, room: room, state: state, pending: pending, note: note,
        label: pending ? LABELS[state] + '…' : LABELS[state],
        isOn: state === 'on', isOff: state === 'off', isOther: state !== 'on' && state !== 'off',
        line: note || room
    };
}

function validState(s) {
    return s === 'on' || s === 'off' || s === 'offline' || s === 'unknown';
}

export default {
    data: {
        lights: [],
        loading: true,
        status: 'Connecting to phone…'
    },
    onInit() {
        var self = this;
        ready = false;
        catalogue = null;
        inflight = {};
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
                self.loading = true;
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
        this.clearTimers();
        ready = false;
        if (client) {
            var previous = client;
            client = null;
            previous.unregisterReceiver({ onSuccess: function () {} });
        }
    },
    // Sends one request with its own timeout; onLost runs if it can't be delivered or gets no reply.
    send(request, onLost) {
        sequence = sequence + 1;
        request.id = 'l' + new Date().getTime() + '-' + sequence;
        var id = request.id;
        var visit = client;
        // Arm before sending: a fast reply must be able to cancel the timer.
        var timer = setTimeout(function () {
            if (client === visit) onLost(id, 'No phone reply — outcome unknown');
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
                if (client === visit && result.code != 207) onLost(id, 'Not sent — phone unavailable');
            }
        });
        return { id: id, timer: timer };
    },
    refresh() {
        if (!client || !ready || catalogue) return;
        var self = this;
        this.loading = true;
        this.status = 'Loading lights…';
        catalogue = { id: null, page: 0, frames: {}, timer: null };
        var sent = this.send({ t: 'lights' }, function (id, message) {
            // id is still null here when delivery fails before send() returns.
            if (catalogue && (catalogue.id === id || catalogue.id === null)) self.endCatalogue(message);
        });
        // A delivery failure may already have ended it.
        if (catalogue && catalogue.id === null) {
            catalogue.id = sent.id;
            catalogue.timer = sent.timer;
        } else {
            clearTimeout(sent.timer);
        }
    },
    endCatalogue(message) {
        if (!catalogue) return;
        if (catalogue.timer !== null) clearTimeout(catalogue.timer);
        catalogue = null;
        this.loading = false;
        this.status = message;
    },
    toggle(index) {
        if (!client || !ready || index < 0 || index >= this.lights.length) return;
        var light = this.lights[index];
        if (light.pending || (light.state !== 'on' && light.state !== 'off')) return;
        var action = light.state === 'on' ? 'off' : 'on';
        var self = this;
        this.update(light.id, action, true, '');
        var entry = { light: light.id, action: action, previous: light.state, timer: null, done: false };
        var sent = this.send({ t: 'light', l: light.id, a: action }, function (id, message) {
            var lost = inflight[id];
            if (!lost) { entry.done = true; entry.message = message; return; }
            delete inflight[id];
            clearTimeout(lost.timer);
            // Not delivered: nothing changed. No reply: the light may or may not have switched.
            self.update(lost.light, message.indexOf('Not sent') === 0 ? lost.previous : 'unknown', false, message);
            self.status = message;
        });
        if (entry.done) {
            // Delivery failed before send() returned.
            clearTimeout(sent.timer);
            this.update(light.id, entry.previous, false, entry.message);
            this.status = entry.message;
            return;
        }
        entry.timer = sent.timer;
        inflight[sent.id] = entry;
    },
    onReply(text) {
        var reply;
        try { reply = JSON.parse(text); } catch (e) { return; }
        if (!reply) return;
        if (reply.t === 'lights' && catalogue && reply.id === catalogue.id) {
            this.onCatalogue(reply);
            return;
        }
        var entry = reply.t === 'lightres' ? inflight[reply.id] : null;
        if (!entry || reply.l !== entry.light || reply.a !== entry.action
                || typeof reply.ok !== 'boolean' || typeof reply.m !== 'string') return;
        delete inflight[reply.id];
        clearTimeout(entry.timer);
        var state = validState(reply.s) ? reply.s : (reply.ok ? entry.action : entry.previous);
        // A plain confirmation needs no note: the button shows the state.
        var note = reply.ok && (reply.m === 'On' || reply.m === 'Off') ? '' : reply.m;
        this.update(entry.light, state, false, note);
        if (!reply.ok) this.status = reply.m;
    },
    onCatalogue(reply) {
        if (reply.ok === false) {
            this.lights = [];
            this.endCatalogue(reply.m || 'Lights unavailable');
            return;
        }
        if (typeof reply.p !== 'number' || reply.p < catalogue.page || Math.floor(reply.p) !== reply.p
                || !Array.isArray(reply.l) || typeof reply.last !== 'boolean') return;
        if (catalogue.frames[reply.p]) return;
        var rows = [];
        for (var i = 0; i < reply.l.length; i++) {
            var item = reply.l[i];
            if (!item || typeof item.id !== 'string' || typeof item.n !== 'string' || !validState(item.s)) return;
            var room = typeof item.r === 'string' ? item.r : '';
            var pending = this.pendingAction(item.id);
            // A light still switching keeps showing what was asked for until its reply arrives.
            rows.push(row(item.id, item.n, room, pending || item.s, !!pending, ''));
        }
        // Wear Engine sends asynchronously; keep future pages until their predecessors arrive.
        catalogue.frames[reply.p] = { rows: rows, last: reply.last };
        while (catalogue && catalogue.frames[catalogue.page]) {
            var frame = catalogue.frames[catalogue.page];
            delete catalogue.frames[catalogue.page];
            this.lights = catalogue.page === 0 ? frame.rows : this.lights.concat(frame.rows);
            catalogue.page = catalogue.page + 1;
            if (frame.last) {
                this.endCatalogue(this.lights.length ? 'Tap a light to switch it' : 'No lights to show');
            }
        }
    },
    pendingAction(lightId) {
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id) && inflight[id].light === lightId) return inflight[id].action;
        }
        return null;
    },
    update(lightId, state, pending, note) {
        var rows = [];
        for (var i = 0; i < this.lights.length; i++) {
            var light = this.lights[i];
            rows.push(light.id === lightId ? row(light.id, light.name, light.room, state, pending, note) : light);
        }
        this.lights = rows;
    },
    clearTimers() {
        if (catalogue && catalogue.timer !== null) clearTimeout(catalogue.timer);
        catalogue = null;
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id)) clearTimeout(inflight[id].timer);
        }
        inflight = {};
    },
    // Back (or swipe right) returns to the main menu.
    back() {
        router.replace({ uri: 'pages/index/index' });
    },
    swipe(e) {
        if (e.direction === 'right') this.back();
    }
};
