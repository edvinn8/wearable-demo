import router from '@system.router';
import { GROUPS, ACCOUNT, groupLots, groupNet } from '../../common/mock.js';
import { money, price } from '../../common/format.js';

// Mock group detail: facts, the individual layers (DCA entries), and a close flow on an overlay
// layer (stack): Close… → confirm sheet → "closing" → result. Nothing is sent anywhere.
export default {
    data: {
        idx: 0,
        title: '',
        isBuy: true,
        isSell: false,
        netText: '',
        netUp: true,
        netDown: false,
        lotsText: '',
        facts: [],
        layersTitle: '',
        layers: [],
        overlay: false,
        step1: false,
        step2: false,
        step3: false,
        confirmTitle: '',
        confirmText: '',
        resultTitle: '',
        resultText: ''
    },
    onInit() {
        var g = GROUPS[this.idx] || GROUPS[0];
        var n = groupNet(g);
        var lots = groupLots(g);
        this.title = g.side + ' ' + g.symbol;
        this.isBuy = g.side === 'BUY';
        this.isSell = g.side !== 'BUY';
        this.netText = money(n) + ' ' + ACCOUNT.cur;
        this.netUp = n >= 0;
        this.netDown = n < 0;
        this.lotsText = lots.toFixed(2) + ' lots' + (g.layers.length > 1 ? ' · ' + g.layers.length + ' layers' : '');
        this.facts = [
            { label: g.layers.length > 1 ? 'Avg entry' : 'Entry', value: price(g.avg, g.digits) },
            { label: 'Now', value: price(g.current, g.digits) },
            { label: 'Pips', value: (g.pips > 0 ? '+' : '') + g.pips.toFixed(1) },
            { label: 'Stop loss', value: g.sl === null ? '—' : price(g.sl, g.digits) },
            { label: 'Take profit', value: g.tp === null ? '—' : price(g.tp, g.digits) }
        ];
        this.layersTitle = g.layers.length > 1 ? 'LAYERS' : 'POSITION';
        var layers = [];
        for (var i = 0; i < g.layers.length; i++) {
            var l = g.layers[i];
            layers.push({
                no: '#' + (i + 1),
                entry: price(l.entry, g.digits),
                sub: l.lots.toFixed(2) + ' · ' + l.opened,
                net: money(l.net),
                up: l.net >= 0,
                down: l.net < 0
            });
        }
        this.layers = layers;
        this.confirmTitle = 'Close ' + this.title + '?';
        this.confirmText = lots.toFixed(2) + ' lots at market · net about ' + money(n) + ' ' + ACCOUNT.cur;
    },
    onShow() {
        this.$refs.listRef.rotation({ focus: true });
    },
    setStep(step) {
        this.overlay = step > 0;
        this.step1 = step === 1;
        this.step2 = step === 2;
        this.step3 = step === 3;
    },
    askClose() {
        this.setStep(1);
    },
    confirmClose() {
        var self = this;
        this.setStep(2);
        setTimeout(function () {
            var g = GROUPS[self.idx] || GROUPS[0];
            self.resultTitle = 'Closed ' + self.title;
            self.resultText = g.layers.length + (g.layers.length === 1 ? ' position' : ' positions')
                + ' · net ' + money(groupNet(g) + 0.46) + ' ' + ACCOUNT.cur + ' (mock)';
            self.setStep(3);
        }, 1800);
    },
    cancel() {
        this.setStep(0);
    },
    done() {
        router.replace({ uri: 'pages/mockpos/mockpos' });
    },
    back() {
        router.replace({ uri: 'pages/mockpos/mockpos' });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            if (this.overlay) {
                this.setStep(0);
            } else {
                this.back();
            }
        }
    }
};
