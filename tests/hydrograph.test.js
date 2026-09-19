import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatFlowValue, parseTimeSeriesResponse } from '../js/hydrograph.js';

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