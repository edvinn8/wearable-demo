// Mock data for the UI preview pages (pages/mock*). Shaped like what the phone will send, plus the
// extra detail (layers, prices, DCA bots) a future protocol version could carry.

export var ACCOUNT = {
    cur: 'EUR',
    equity: 4617.03,
    balance: 5289.35, // + net P/L of GROUPS (-672.32) = equity; equity / margin = margin level
    margin: 341.25,
    freeMargin: 4275.78,
    marginLevel: 1353,
    todayNet: -412.55,
    weekNet: 1286.40,
    device: 'Macbook',
    age: 12,
    demo: false,
    // Equity over the last 12 hours, for the chart card.
    equityCurve: [5180, 5122, 5064, 4990, 5012, 4935, 4870, 4902, 4788, 4702, 4655, 4617]
};

// Largest |P/L| first, like the real snapshot.
export var GROUPS = [
    {
        side: 'SELL', symbol: 'ETHUSD', digits: 2, avg: 2618.40, current: 2715.95, pips: -975.5, sl: null, tp: 2560.00,
        layers: [
            { entry: 2590.10, lots: 2.40, net: -302.12, opened: 'Mon 09:14' },
            { entry: 2620.55, lots: 2.40, net: -228.84, opened: 'Mon 16:02' },
            { entry: 2644.55, lots: 2.40, net: -171.40, opened: 'Tue 08:40' }
        ]
    },
    {
        side: 'SELL', symbol: 'XAUUSD', digits: 2, avg: 3642.10, current: 3659.68, pips: -175.8, sl: 3680.00, tp: 3600.00,
        layers: [{ entry: 3642.10, lots: 0.33, net: -580.16, opened: 'Tue 11:25' }]
    },
    {
        side: 'BUY', symbol: 'XTIUSD', digits: 2, avg: 67.12, current: 69.49, pips: 237.0, sl: 64.00, tp: 71.00,
        layers: [
            { entry: 66.80, lots: 1.00, net: 259.15, opened: 'Mon 14:30' },
            { entry: 67.44, lots: 1.00, net: 215.20, opened: 'Tue 07:55' }
        ]
    },
    {
        side: 'BUY', symbol: 'US500', digits: 1, avg: 6412.3, current: 6433.5, pips: 212.0, sl: 6350.0, tp: null,
        layers: [{ entry: 6412.3, lots: 1.00, net: 212.40, opened: 'Tue 15:31' }]
    },
    {
        side: 'SELL', symbol: 'DE40', digits: 1, avg: 23810.5, current: 23830.1, pips: -19.6, sl: 23900.0, tp: 23600.0,
        layers: [{ entry: 23810.5, lots: 0.50, net: -98.20, opened: 'Tue 09:05' }]
    },
    {
        side: 'BUY', symbol: 'BTCUSD', digits: 1, avg: 111520.0, current: 111857.5, pips: 337.5, sl: null, tp: 115000.0,
        layers: [{ entry: 111520.0, lots: 0.10, net: 33.75, opened: 'Tue 18:44' }]
    },
    {
        side: 'BUY', symbol: 'UK100', digits: 1, avg: 9215.4, current: 9209.4, pips: -6.0, sl: 9150.0, tp: 9300.0,
        layers: [{ entry: 9215.4, lots: 0.20, net: -12.10, opened: 'Wed 08:02' }]
    }
];

// Running first, like /dca.
export var DCA_BOTS = [
    { symbol: 'XTIUSD', state: 'running', position: 'BUY 2.00', net: 474.35, layers: 2, nextDca: 65.90 },
    { symbol: 'ETHUSD', state: 'running', position: 'SELL 7.20', net: -702.36, layers: 3, nextDca: 2745.00 },
    { symbol: 'XAUUSD', state: 'starting', position: 'flat', net: 0, layers: 0, nextDca: null },
    { symbol: 'US500', state: 'offline', position: 'flat', net: 0, layers: 0, nextDca: null },
    { symbol: 'BTCUSD', state: 'stopped', position: 'flat', net: 0, layers: 0, nextDca: null },
    { symbol: 'DE40', state: 'stopped', position: 'flat', net: 0, layers: 0, nextDca: null },
    { symbol: 'UK100', state: 'stopped', position: 'flat', net: 0, layers: 0, nextDca: null }
];

export function groupLots(g) {
    var lots = 0;
    for (var i = 0; i < g.layers.length; i++) {
        lots = lots + g.layers[i].lots;
    }
    return lots;
}

export function groupNet(g) {
    var net = 0;
    for (var i = 0; i < g.layers.length; i++) {
        net = net + g.layers[i].net;
    }
    return net;
}

export function totalNet() {
    var net = 0;
    for (var i = 0; i < GROUPS.length; i++) {
        net = net + groupNet(GROUPS[i]);
    }
    return net;
}
