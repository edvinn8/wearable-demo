import router from '@system.router';
import { DCA_BOTS } from '../../common/mock.js';
import { money, price } from '../../common/format.js';

// Mock DCA bot: state, position, Stop (running) or Start (stopped/offline) with a confirm overlay —
// the watch version of /dcastop and /dcastart. Nothing is sent anywhere.
export default {
    data: {
        idx: 0,
        symbol: '',
        dotClass: 'dot running',
        stateText: '',
        posText: '',
        netText: '',
        netClass: 'bot-net up',
        hint: '',
        canStop: false,
        canStart: false,
        overlay: false,
        asking: false,
        doneStep: false,
        confirmTitle: '',
        confirmText: '',
        confirmLabel: ''
    },
    onInit() {
        var b = DCA_BOTS[this.idx] || DCA_BOTS[0];
        var inPos = b.position !== 'flat';
        this.symbol = b.symbol;
        this.dotClass = 'dot ' + b.state;
        this.stateText = b.state;
        this.posText = inPos ? b.position + ' · ' + b.layers + (b.layers === 1 ? ' layer' : ' layers') : 'flat';
        this.netText = inPos ? 'net ' + money(b.net) : '';
        this.netClass = b.net >= 0 ? 'bot-net up' : 'bot-net down';
        this.canStop = b.state === 'running';
        this.canStart = b.state === 'stopped' || b.state === 'offline';
        this.hint = b.state === 'starting' ? 'Starting — wait for it to report in'
            : (this.canStop && inPos ? 'Next DCA at ' + price(b.nextDca, 2) : '');
        if (this.canStop) {
            this.confirmTitle = 'Stop ' + b.symbol + '?';
            this.confirmText = inPos ? 'In a position — while stopped, only broker TP/SL protect it.' : 'Flat — nothing open.';
            this.confirmLabel = 'Stop';
        } else {
            this.confirmTitle = 'Start ' + b.symbol + '?';
            this.confirmText = 'The spawner launches it in about 10–20 s.';
            this.confirmLabel = 'Start';
        }
    },
    ask() {
        this.overlay = true;
        this.asking = true;
        this.doneStep = false;
    },
    confirm() {
        this.asking = false;
        this.doneStep = true;
        this.confirmTitle = this.canStop ? '⏹ Stop requested' : '▶ Start requested';
        this.confirmText = this.symbol + ' (mock — nothing sent)';
    },
    cancel() {
        this.overlay = false;
        this.asking = false;
    },
    back() {
        router.replace({ uri: 'pages/mockdca/mockdca' });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            if (this.overlay) {
                this.cancel();
            } else {
                this.back();
            }
        }
    }
};
