import app from '@system.app';
import router from '@system.router';

// Main menu: one entry per feature, then Exit.
export default {
    data: {
        version: ''
    },
    onInit() {
        // The installed version, from the build (entry/src/main/config.json), as on Matchday Scores' menu.
        var info = app.getInfo();
        this.version = info && info.versionName ? 'v' + info.versionName : '';
    },
    goLights() { router.replace({ uri: 'pages/lights/lights' }); },
    appExit() { app.terminate(); },
    touchMove(e) { if (e.direction === 'right') this.goLights(); }
};
