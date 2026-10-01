import app from '@system.app';
import router from '@system.router';

export default {
    goLights() { router.replace({ uri: 'pages/lights/lights' }); },
    goP2p() { router.replace({ uri: 'pages/p2p/p2p' }); },
    appExit() { app.terminate(); },
    touchMove(e) { if (e.direction === 'right') this.goLights(); }
};
