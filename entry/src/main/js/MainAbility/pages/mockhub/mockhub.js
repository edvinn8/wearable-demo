import router from '@system.router';
import { totalNet, GROUPS } from '../../common/mock.js';
import { money } from '../../common/format.js';

// Mock UI hub — every screen of the planned watch app, fed by common/mock.js.
// Swipe right on any mock page goes one level up; here it returns to Tools.
export default {
    data: {
        items: []
    },
    onInit() {
        this.items = [
            { icon: '€', label: 'Positions', sub: money(totalNet()) + ' · ' + GROUPS.length + ' open', uri: 'pages/mockpos/mockpos' },
            { icon: '≡', label: 'Layered DCA', sub: '2 running · 5 idle', uri: 'pages/mockdca/mockdca' },
            { icon: '◔', label: 'Account', sub: 'cards · swipe up/down', uri: 'pages/mockacct/mockacct' },
            { icon: '⚑', label: 'States', sub: 'loading, errors, empty', uri: 'pages/mockstates/mockstates' },
            { icon: '✕', label: 'Exit mock', sub: 'back to Tools', uri: 'pages/index/index' }
        ];
    },
    onShow() {
        this.$refs.listRef.rotation({ focus: true });
    },
    open(idx) {
        router.replace({ uri: this.items[idx].uri });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            router.replace({ uri: 'pages/index/index' });
        }
    }
};
