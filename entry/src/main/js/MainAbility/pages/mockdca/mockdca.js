import router from '@system.router';
import { DCA_BOTS } from '../../common/mock.js';
import { money } from '../../common/format.js';

// Mock Layered DCA list — running first, like /dca. Tap a bot for Start/Stop.
export default {
    data: {
        summary: '',
        bots: []
    },
    onInit() {
        var running = 0;
        var bots = [];
        for (var i = 0; i < DCA_BOTS.length; i++) {
            var b = DCA_BOTS[i];
            if (b.state === 'running') {
                running++;
            }
            var inPos = b.position !== 'flat';
            bots.push({
                symbol: b.symbol,
                dotClass: 'dot ' + b.state,
                sub: b.state + (inPos ? ' · ' + b.position : ''),
                net: inPos ? money(b.net) : '',
                netClass: b.net >= 0 ? 'bot-net up' : 'bot-net down'
            });
        }
        this.bots = bots;
        this.summary = running + ' running · ' + (DCA_BOTS.length - running) + ' idle';
    },
    onShow() {
        this.$refs.listRef.rotation({ focus: true });
    },
    openBot(idx) {
        router.replace({ uri: 'pages/mockbot/mockbot', params: { idx: idx } });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            router.replace({ uri: 'pages/mockhub/mockhub' });
        }
    }
};
