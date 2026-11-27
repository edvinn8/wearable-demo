import router from '@system.router';
import { P2pClient, Message, Builder } from '../../common/wearengine.js';
import { PHONE_PKG, PHONE_FINGERPRINT } from '../../common/peer.js';

// The phone reads the household light states from EDOS Dashboard and switches through its setLight
// function. A tap flips the light here at once; the phone's reply confirms it or puts it back.
// Several lights can switch at once; the same light ignores taps until its reply arrives.
//
// GT 6 (Huawei Lite) limits, as learned on Matchday Scores:
// - Replacing the list's array rebuilds every row natively; doing that on each tap ran the watch out
//   of memory after a couple of taps. The list repeats over `lightOrder` (ids only) and a tap or reply
//   edits that light's row object in place. Only a reload replaces the arrays.
// - Only a few timers can be pending at once, so all requests share one timeout timer, armed for the
//   earliest deadline, instead of one timer per tap.
var client = null;
var ready = false;
var sequence = 0;
var catalogue = null;   // { id, page, frames, rows, due } while a list request is open
var inflight = {};      // request id -> { light, action, previous, due }
var watchdog = null;    // the one pending timer
var TIMEOUT_MS = 20000;
var NO_REPLY = 'No phone reply — outcome unknown';
var NOT_SENT = 'Not sent — phone unavailable';

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

function now() {
    return new Date().getTime();
}

export default {
    data: {
        lightOrder: [],
        lights: [],
        loading: true,
        status: 'Connecting to phone…'
    },
    onInit() {
        var self = this;
        ready = false;
        catalogue = null;
        inflight = {};
        watchdog = null;
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
    nextId() {
        sequence = sequence + 1;
        return 'l' + now() + '-' + sequence;
    },
    // Sends one request (its id already registered); onUndelivered runs if Wear Engine can't deliver it.
    deliver(request, onUndelivered) {
        var visit = client;
        var builder = new Builder();
        builder.setDescription(JSON.stringify(request));
        var message = new Message();
        message.builder = builder;
        client.send(message, {
            onSuccess: function () {},
            onFailure: function () {},
            onSendProgress: function () {},
            onSendResult: function (result) {
                if (client === visit && result.code != 207) onUndelivered();
            }
        });
    },
    // One timer for every open request, armed for the earliest deadline.
    armWatchdog() {
        if (watchdog !== null || !client) return;
        var due = catalogue ? catalogue.due : null;
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id) && (due === null || inflight[id].due < due)) due = inflight[id].due;
        }
        if (due === null) return;
        var self = this;
        var visit = client;
        watchdog = setTimeout(function () {
            watchdog = null;
            if (client === visit) self.expire();
        }, Math.max(0, due - now()) + 50);
    },
    // Cancels the shared timer once nothing is waiting for the phone.
    settle() {
        if (watchdog === null || catalogue) return;
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id)) return;
        }
        clearTimeout(watchdog);
        watchdog = null;
    },
    expire() {
        var t = now();
        if (catalogue && catalogue.due <= t) this.endCatalogue(NO_REPLY);
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id) && inflight[id].due <= t) this.lose(id, NO_REPLY);
        }
        this.armWatchdog();
    },
    refresh() {
        if (!client || !ready || catalogue) return;
        var self = this;
        this.loading = true;
        this.status = 'Loading lights…';
        var id = this.nextId();
        catalogue = { id: id, page: 0, frames: {}, rows: [], due: now() + TIMEOUT_MS };
        this.deliver({ t: 'lights', id: id }, function () {
            if (catalogue && catalogue.id === id) self.endCatalogue(NOT_SENT);
        });
        this.armWatchdog();
    },
    endCatalogue(message) {
        if (!catalogue) return;
        catalogue = null;
        this.loading = false;
        this.status = message;
        this.settle();
    },
    toggle(index) {
        if (!client || !ready || index < 0 || index >= this.lights.length) return;
        var light = this.lights[index];
        if (light.pending || (light.state !== 'on' && light.state !== 'off')) return;
        var action = light.state === 'on' ? 'off' : 'on';
        var self = this;
        var id = this.nextId();
        inflight[id] = { light: light.id, action: action, previous: light.state, due: now() + TIMEOUT_MS };
        this.update(light.id, action, true, '');
        this.deliver({ t: 'light', id: id, l: light.id, a: action }, function () {
            self.lose(id, NOT_SENT);
        });
        this.armWatchdog();
    },
    // A request that won't get a reply. Not delivered: nothing changed. No reply: it may have switched.
    lose(id, message) {
        var entry = inflight[id];
        if (!entry) return;
        delete inflight[id];
        this.update(entry.light, message === NOT_SENT ? entry.previous : 'unknown', false, message);
        this.status = message;
        this.settle();
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
        var state = validState(reply.s) ? reply.s : (reply.ok ? entry.action : entry.previous);
        // A plain confirmation needs no note: the button shows the state.
        var note = reply.ok && (reply.m === 'On' || reply.m === 'Off') ? '' : reply.m;
        this.update(entry.light, state, false, note);
        if (!reply.ok) this.status = reply.m;
        this.settle();
    },
    onCatalogue(reply) {
        if (reply.ok === false) {
            this.replaceRows([]);
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
        // Wear Engine sends asynchronously; keep future pages until their predecessors arrive, and
        // show the list once, when the last page is in, rather than rebuilding it for every page.
        catalogue.frames[reply.p] = { rows: rows, last: reply.last };
        while (catalogue && catalogue.frames[catalogue.page]) {
            var frame = catalogue.frames[catalogue.page];
            delete catalogue.frames[catalogue.page];
            catalogue.rows = catalogue.rows.concat(frame.rows);
            catalogue.page = catalogue.page + 1;
            if (frame.last) {
                this.replaceRows(catalogue.rows);
                this.endCatalogue(this.lights.length ? 'Tap a light to switch it' : 'No lights to show');
            }
        }
    },
    // The only place the list's arrays are replaced (a reload); everything else edits rows in place.
    replaceRows(rows) {
        var order = [];
        for (var i = 0; i < rows.length; i++) order.push(rows[i].id);
        this.lights = rows;
        this.lightOrder = order;
    },
    pendingAction(lightId) {
        for (var id in inflight) {
            if (inflight.hasOwnProperty(id) && inflight[id].light === lightId) return inflight[id].action;
        }
        return null;
    },
    // Changes one light's row in place, writing only the fields that differ.
    update(lightId, state, pending, note) {
        for (var i = 0; i < this.lights.length; i++) {
            var current = this.lights[i];
            if (current.id !== lightId) continue;
            var next = row(current.id, current.name, current.room, state, pending, note);
            for (var key in next) {
                if (next.hasOwnProperty(key) && current[key] !== next[key]) current[key] = next[key];
            }
            return;
        }
    },
    clearTimers() {
        if (watchdog !== null) clearTimeout(watchdog);
        watchdog = null;
        catalogue = null;
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
