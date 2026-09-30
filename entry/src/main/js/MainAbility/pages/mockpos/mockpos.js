import router from '@system.router';
import { ACCOUNT, GROUPS, groupLots, groupNet, totalNet } from '../../common/mock.js';
import { money, plain, ageText } from '../../common/format.js';

// Mock Positions page — the planned real page, fed by common/mock.js.
// `state` comes from the States page: ok | loading | unavailable | error | stale | stopped | empty.
export default {
    data: {
        state: 'ok',
        isLoading: false,
        isMessage: false,
        headLabel: '',
        headSub: '',
        message: '',
        icon: '',
        cur: '',
        netText: '',
        netUp: true,
        netDown: false,
        equity: '',
        ml: '',
        badge: '',
        hasBadge: false,
        isEmpty: false,
        rows: [],
        foot: ''
    },
    onInit() {
        this.render();
    },
    onShow() {
        if (this.$refs.listRef) {
            this.$refs.listRef.rotation({ focus: true });
        }
    },
    render() {
        var s = this.state;
        this.isLoading = s === 'loading';
        this.isMessage = s === 'unavailable' || s === 'error';
        if (s === 'loading') {
            // Pretend the phone answers after 2 s.
            var self = this;
            setTimeout(function () {
                self.state = 'ok';
                self.render();
            }, 2000);
            return;
        }
        if (s === 'unavailable') {
            this.icon = '⌁';
            this.message = 'Phone unavailable — open Wear Companion on the phone';
            return;
        }
        if (s === 'error') {
            this.icon = '!';
            this.message = 'Sign in on the phone (Wear Companion)';
            return;
        }

        var empty = s === 'empty';
        var net = empty ? 0 : totalNet();
        this.cur = ACCOUNT.cur;
        this.netText = money(net);
        this.netUp = net >= 0;
        this.netDown = net < 0;
        this.equity = plain(empty ? ACCOUNT.balance : ACCOUNT.equity);
        this.ml = empty ? '—' : ACCOUNT.marginLevel;
        this.headLabel = 'NET P/L · ' + this.cur;
        this.headSub = empty ? 'Eq ' + this.equity + ' · no margin used' : 'Eq ' + this.equity + ' · ML ' + this.ml + '%';
        this.badge = s === 'stale' ? '⚠ cBot not updating' : (s === 'stopped' ? '⏹ cBot stopped' : '');
        this.hasBadge = this.badge !== '';

        var rows = [];
        if (!empty) {
            for (var i = 0; i < GROUPS.length; i++) {
                var g = GROUPS[i];
                var n = groupNet(g);
                rows.push({
                    sideShort: g.side === 'BUY' ? 'B' : 'S',
                    sideClass: g.side === 'BUY' ? 'side buy' : 'side sell',
                    symbol: g.symbol,
                    lots: groupLots(g).toFixed(2) + (g.layers.length > 1 ? ' ×' + g.layers.length : ''),
                    net: money(n),
                    netClass: n >= 0 ? 'net up' : 'net down'
                });
            }
        }
        this.rows = rows;
        this.isEmpty = rows.length === 0;
        var age = s === 'stale' ? 1380 : (s === 'stopped' ? 5400 : ACCOUNT.age);
        this.foot = ACCOUNT.device + ' · ' + ageText(age);
    },
    retry() {
        this.state = 'loading';
        this.render();
    },
    openGroup(idx) {
        router.replace({ uri: 'pages/mockgroup/mockgroup', params: { idx: idx } });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            router.replace({ uri: 'pages/mockhub/mockhub' });
        }
    }
};
