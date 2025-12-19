import app from '@system.app'

export default {
    data: {
        title: '',
        progressNumber: 0,
        updateTimer: null,
        updateProgress() {
            const randomIncrement = Math.floor(Math.random() * 15) + 1;

            if (this.progressNumber > 99) {
                this.progressNumber = 0
            } else {
                this.progressNumber = Math.min(this.progressNumber + randomIncrement, 100);
            }

            console.log("Incremented by " + randomIncrement + " to: " + this.progressNumber);
        },
        touchMove(e) {
            if (e.direction == "right") {
                this.appExit();
            }
        },
        appExit() {
            app.terminate();
        }
    },
    onInit() {
        this.title = this.$t('strings.world');
        console.log("startup");

        // Start auto progress update with random increments every 2 seconds
        this.updateTimer = setInterval(() => {
            this.updateProgress();
        }, 500);
    },
    onDestroy() {
        // Clean up timer when page is destroyed
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
};
