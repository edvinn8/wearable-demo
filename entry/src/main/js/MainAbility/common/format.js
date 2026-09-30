// Number formatting for the watch UI. No regex lookahead — keep it simple for the lite JS engine.

// "1234567" -> "1,234,567"
function group(digits) {
    var out = '';
    for (var i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) {
            out = out + ',';
        }
        out = out + digits.charAt(i);
    }
    return out;
}

// -1756.87 -> "-1,756.87", 12 -> "+12.00"
export function money(n) {
    var sign = n < 0 ? '-' : (n > 0 ? '+' : '');
    var parts = Math.abs(n).toFixed(2).split('.');
    return sign + group(parts[0]) + '.' + parts[1];
}

// 4617.03 -> "4,617"
export function plain(n) {
    var r = Math.round(n);
    return (r < 0 ? '-' : '') + group(Math.abs(r).toString());
}

// 2618.4, 2 -> "2,618.40"
export function price(n, digits) {
    var parts = n.toFixed(digits).split('.');
    return group(parts[0]) + (parts.length > 1 ? '.' + parts[1] : '');
}

export function ageText(s) {
    if (s < 0) return 'no time';
    if (s < 90) return s + 's ago';
    if (s < 5400) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
}
