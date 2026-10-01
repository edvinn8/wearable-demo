import router from '@system.router';

// Opens the mock Positions page in each state the real one can be in.
export default {
    data: {
        states: [
            { key: 'ok', label: 'Normal', sub: 'live data' },
            { key: 'loading', label: 'Loading', sub: 'answers after 2 s' },
            { key: 'unavailable', label: 'Phone unavailable', sub: 'no answer / send failed' },
            { key: 'error', label: 'Phone error', sub: 'e.g. not signed in' },
            { key: 'stale', label: 'cBot not updating', sub: 'snapshot 23 min old' },
            { key: 'stopped', label: 'cBot stopped', sub: 'last known figures' },
            { key: 'empty', label: 'No positions', sub: 'flat account' }
        ]
    },
    onShow() {
        this.$refs.listRef.rotation({ focus: true });
    },
    open(idx) {
        router.replace({ uri: 'pages/mockpos/mockpos', params: { state: this.states[idx].key } });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            router.replace({ uri: 'pages/mockhub/mockhub' });
        }
    }
};
