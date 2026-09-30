import router from '@system.router';
import { ACCOUNT } from '../../common/mock.js';
import { money, plain, ageText } from '../../common/format.js';

// Mock Account cards (vertical swiper): equity, today/week P/L, margin-level gauge, equity chart,
// data source. The chart and the arc are the riskiest lite components — if one doesn't render on
// the GT 6, only that card is affected.
export default {
    data: {
        cur: '',
        equity: '',
        balanceLine: '',
        freeLine: '',
        today: '',
        todayClass: 'big-up',
        week: '',
        weekClass: 'big-up',
        ml: '',
        marginLine: '',
        gaugePercent: 0,
        chartOptions: {},
        chartData: [],
        curveLine: '',
        sourceLine: '',
        ageLine: ''
    },
    onInit() {
        var a = ACCOUNT;
        this.cur = a.cur;
        this.equity = plain(a.equity);
        this.balanceLine = 'Balance ' + plain(a.balance);
        this.freeLine = 'Free margin ' + plain(a.freeMargin);
        this.today = money(a.todayNet);
        this.todayClass = a.todayNet >= 0 ? 'big-up' : 'big-down';
        this.week = money(a.weekNet);
        this.weekClass = a.weekNet >= 0 ? 'big-up' : 'big-down';
        this.ml = a.marginLevel + '%';
        this.marginLine = 'margin ' + plain(a.margin);
        // Full arc at 2000 %, so healthy levels read as a mostly full gauge.
        this.gaugePercent = Math.min(100, Math.round(a.marginLevel / 20));

        var min = a.equityCurve[0];
        var max = a.equityCurve[0];
        for (var i = 1; i < a.equityCurve.length; i++) {
            min = Math.min(min, a.equityCurve[i]);
            max = Math.max(max, a.equityCurve[i]);
        }
        this.chartOptions = {
            xAxis: { min: 0, max: a.equityCurve.length - 1, display: false },
            yAxis: { min: min - 50, max: max + 50, display: false }
        };
        this.chartData = [{ strokeColor: '#1f6feb', fillColor: '#1f6feb', data: a.equityCurve, gradient: true }];
        this.curveLine = plain(a.equityCurve[0]) + ' → ' + plain(a.equityCurve[a.equityCurve.length - 1]);
        this.sourceLine = 'Positions Report · ' + a.device + (a.demo ? ' · demo' : '');
        this.ageLine = 'updated ' + ageText(a.age);
    },
    back() {
        router.replace({ uri: 'pages/mockhub/mockhub' });
    },
    onSwipe(e) {
        if (e.direction === 'right') {
            this.back();
        }
    }
};
