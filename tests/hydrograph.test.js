import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatFlowValue, parseTimeSeriesResponse, canPlaceBelow, canPlaceAbove, gaugedLabelSide, gaugedLabelHorizontalSide } from '../js/hydrograph.js';

describe('canPlaceBelow / canPlaceAbove (regression: method-icon placement swap)', () => {
    // Regression test: an earlier version had these two conditions swapped, causing a
    // threshold line near the bottom edge to incorrectly show its icon crowded below it
    // (where there's no room) instead of above it (where there's plenty of room).
    test('a line near the top has room below but not above', () => {
        assert.equal(canPlaceBelow(0.05), true);
        assert.equal(canPlaceAbove(0.05), false);
    });

    test('a line near the bottom has room above but not below', () => {
        assert.equal(canPlaceBelow(0.95), false);
        assert.equal(canPlaceAbove(0.95), true);
    });

    test('a line in the middle has room on both sides', () => {
        assert.equal(canPlaceBelow(0.5), true);
        assert.equal(canPlaceAbove(0.5), true);
    });

    test('respects a custom edge threshold', () => {
        assert.equal(canPlaceAbove(0.15, 0.1), true);
        assert.equal(canPlaceAbove(0.05, 0.1), false);
    });
});

describe('gaugedLabelSide (regression: label landing on the curve)', () => {
    // Regression test: an earlier version decided above/below based on the gauged value's
    // position in the whole chart, rather than relative to the curve at that specific time -
    // so a gauging that was (very commonly) close to the recorded curve would often place
    // the label directly on top of the curve line, making it unreadable.
    test('gauged flow below the curve places the label below (away from the curve)', () => {
        assert.equal(gaugedLabelSide(58.5, 61.05), 'below');
    });

    test('gauged flow above the curve places the label above (away from the curve)', () => {
        assert.equal(gaugedLabelSide(61.5, 61.05), 'above');
    });

    test('an exact match defaults to above', () => {
        assert.equal(gaugedLabelSide(60, 60), 'above');
    });
});

describe('gaugedLabelHorizontalSide (regression: label overflow near the right edge)', () => {
    // Regression test: the label always extended rightward from its anchor, so a gauging
    // window near the end of the chart (a very common case - "just gauged, right now")
    // pushed the label past the chart's edge, worse on narrow mobile screens with no
    // spare margin.
    test('extends right when there is room', () => {
        assert.equal(gaugedLabelHorizontalSide(30), 'right');
    });

    test('flips to extend left when the anchor is near the right edge', () => {
        assert.equal(gaugedLabelHorizontalSide(90), 'left');
    });

    test('respects a custom edge threshold', () => {
        assert.equal(gaugedLabelHorizontalSide(80, 75), 'left');
        assert.equal(gaugedLabelHorizontalSide(70, 75), 'right');
    });
});

describe('formatFlowValue', () => {
    test('below 10 shows 3 decimal places', () => {
        assert.equal(formatFlowValue(5.123456), '5.123');
        assert.equal(formatFlowValue(0), '0.000');
    });

    test('below 100 shows 2 decimal places', () => {
        assert.equal(formatFlowValue(87.6543), '87.65');
    });

    test('below 1000 shows 1 decimal place', () => {
        assert.equal(formatFlowValue(234.567), '234.6');
    });

    test('1000 or more shows 0 decimal places', () => {
        assert.equal(formatFlowValue(1234.5678), '1235');
        assert.equal(formatFlowValue(1000), '1000');
    });

    test('boundary values fall into the higher-magnitude (fewer-decimal) bucket', () => {
        // The rule is strictly "< 10 / < 100 / < 1000", so a value exactly on a boundary
        // belongs to the next bucket up, not the one below it.
        assert.equal(formatFlowValue(10), '10.00');
        assert.equal(formatFlowValue(100), '100.0');
        assert.equal(formatFlowValue(1000), '1000');
    });
});

describe('parseTimeSeriesResponse', () => {
    function apiPoint(time, value) {
        return { Time: time, Value: value };
    }

    test('parses a well-formed response', () => {
        const raw = {
            Series: [{ Data: [
                    apiPoint('2026-09-19T00:00:00Z', '10.5'),
                    apiPoint('2026-09-19T00:05:00Z', '11.2')
                ] }],
            NowTime: '2026-09-19T00:10:00Z'
        };
        const result = parseTimeSeriesResponse(raw);
        assert.equal(result.points.length, 2);
        assert.equal(result.points[0].value, 10.5);
        assert.ok(result.nowTime instanceof Date);
    });

    test('sorts points by time even if the API returns them out of order', () => {
        const raw = {
            Series: [{ Data: [
                    apiPoint('2026-09-19T00:10:00Z', '20'),
                    apiPoint('2026-09-19T00:00:00Z', '10')
                ] }]
        };
        const result = parseTimeSeriesResponse(raw);
        assert.equal(result.points[0].value, 10);
        assert.equal(result.points[1].value, 20);
    });

    test('filters out points with an unparseable time or non-numeric value', () => {
        const raw = {
            Series: [{ Data: [
                    apiPoint('2026-09-19T00:00:00Z', '10'),
                    apiPoint('not a time', '20'),
                    apiPoint('2026-09-19T00:10:00Z', 'not a number')
                ] }]
        };
        const result = parseTimeSeriesResponse(raw);
        assert.equal(result.points.length, 1);
        assert.equal(result.points[0].value, 10);
    });

    test('returns null for a response with an unexpected shape', () => {
        assert.equal(parseTimeSeriesResponse({}), null);
        assert.equal(parseTimeSeriesResponse({ Series: [] }), null);
        assert.equal(parseTimeSeriesResponse(null), null);
    });
});