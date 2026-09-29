import fetch from '@system.fetch';

// Public-data diagnostics only. The watchdog does not cancel native fetch.
export default {
    data: {
        status: 'ready',
        detail: 'example.com: compare HTTP / HTTPS',
        elapsed: '15 s callback limit'
    },
    onInit() {
        this._requestId = 0;
        this._timer = null;
        this._pending = false;
        this._destroyed = false;
        console.log('[NETTEST] page init; build 1.0.2; fetch module is ' + (typeof fetch));
        if (typeof fetch === 'undefined' || !fetch || typeof fetch.fetch !== 'function') {
            this.status = 'NO API';
            this.detail = 'system.fetch missing';
        }
    },
    onDestroy() {
        this._destroyed = true;
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    },
    run(label, url, usersResponse) {
        var self = this;
        if (self._destroyed) {
            return;
        }
        if (self._pending) {
            console.log('[NETTEST] busy; ignored tap ' + label);
            return;
        }
        var requestId = ++self._requestId;
        var started = Date.now();
        var settled = false;
        var expired = false;
        var prefix = '[NETTEST] #' + requestId + ' ' + label;
        self._pending = true;
        self.status = 'WAITING';
        self.detail = label + ': example.com';
        if (usersResponse) {
            self.detail = label + ': JSONPlaceholder';
        }
        self.elapsed = 'waiting (max 15 s)';
        console.log(prefix + ' START url=' + url);

        function logResult(event, details) {
            var ignored = expired || settled || self._destroyed || self._requestId !== requestId;
            console.log(prefix + ' ' + event + ' elapsed=' + (Date.now() - started) + ' ms'
                + (ignored ? ' [late/ignored]' : '') + ' ' + details);
        }
        function finish() {
            if (expired || settled || self._destroyed || self._requestId !== requestId) {
                return false;
            }
            settled = true;
            self._pending = false;
            if (self._timer !== null) {
                clearTimeout(self._timer);
                self._timer = null;
            }
            self.elapsed = label + ': ' + (Date.now() - started) + ' ms';
            return true;
        }
        self._timer = setTimeout(function () {
            if (settled || self._destroyed || self._requestId !== requestId) {
                return;
            }
            logResult('TIMEOUT', 'no callback; native request not cancelled');
            expired = true;
            self._timer = null;
            self._pending = false;
            self.status = 'TIMEOUT';
            self.detail = label + ': no callback in 15 s';
            self.elapsed = label + ': ' + (Date.now() - started) + ' ms';
        }, 15000);
        try {
            fetch.fetch({
                url: url,
                method: 'GET',
                responseType: 'text',
                success: function (resp) {
                    var code = resp && typeof resp.code === 'number' ? resp.code : '?';
                    var body = resp && resp.data ? String(resp.data) : '';
                    logResult('SUCCESS', 'code=' + code + ' body=' + body.substring(0, 200));
                    if (!finish()) {
                        return;
                    }
                    self.status = code >= 200 && code < 300 ? 'OK ' + code : 'HTTP ' + code;
                    self.detail = label + ': ' + (body ? body.length + ' chars received' : 'empty body');
                    if (usersResponse && code >= 200 && code < 300) {
                        try {
                            var parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
                            var users = Array.isArray(parsed) ? parsed : parsed && parsed.users;
                            if (!Array.isArray(users) || users.length === 0) {
                                throw new Error('No users list in response');
                            }
                            var first = users[0].name || (users[0].firstName + ' ' + users[0].lastName);
                            self.detail = label + ': ' + users.length + ' users / ' + first;
                        } catch (error) {
                            self.status = 'BAD JSON ' + code;
                            self.detail = label + ': ' + String(error.message || error).substring(0, 45);
                        }
                    }
                },
                fail: function (data, code) {
                    logResult('FAIL', 'code=' + code + ' data=' + data);
                    if (!finish()) {
                        return;
                    }
                    self.status = 'FAIL ' + code;
                    self.detail = label + ': ' + String(data).substring(0, 45);
                },
                complete: function () {
                    console.log(prefix + ' COMPLETE elapsed=' + (Date.now() - started) + ' ms');
                }
            });
        } catch (e) {
            logResult('EXCEPTION', String(e));
            if (finish()) {
                self.status = 'THREW';
                self.detail = label + ': ' + String(e && e.message ? e.message : e).substring(0, 45);
            }
        }
    },

    testHttps() {
        this.run('HTTPS', 'https://example.com/');
    },
    testJson() {
        this.run('Users', 'https://jsonplaceholder.typicode.com/users?_limit=3', true);
    },

    testFetch() {
        fetch.fetch({
            url: 'https://jsonplaceholder.typicode.com/todos/1',
            method: 'GET',
            responseType: 'json', // Crucial for Lite Wearables
            success: function(response) {
                console.log("Success: " + response.code);
                console.log("Data: " + response.data);
            },
            fail: function(data, code) {
                console.log("Fail code: " + code);
            }
        });
    }
};
