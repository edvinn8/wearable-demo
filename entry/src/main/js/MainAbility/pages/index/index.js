import app from '@system.app';
import router from '@system.router';

export default {
    data: {
        title: '',
        progressNumber: 0,
        updateTimer: null
    },
    updateProgress() {
        var randomIncrement = Math.floor(Math.random() * 15) + 1;
        this.progressNumber = this.progressNumber > 99
            ? 0 : Math.min(this.progressNumber + randomIncrement, 100);
    },
    touchMove(e) {
        if (e.direction === 'right') {
            this.appExit();
        }
    },
    goNet() {
        console.log('[NETTEST] opening test page; build 1.0.2');
        router.replace({ uri: 'pages/nettest/nettest' });
    },
    appExit() {
        app.terminate();
    },
    onInit() {
        var self = this;
        this.title = this.$t('strings.world');
        this.updateTimer = setInterval(function () {
            self.updateProgress();
        }, 500);
    },
    onDestroy() {
        if (this.updateTimer !== null) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
};
