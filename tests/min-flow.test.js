import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { minFlowStatus, minFlowNoteHtml } from '../js/min-flow.js';

describe('minFlowStatus', () => {
    test('400% and above is good', () => {
        assert.equal(minFlowStatus(1, 0.25).level, 'good');
        assert.equal(minFlowStatus(2, 0.25).level, 'good');
    });

    test('150% up to but not including 400% is warn', () => {
        assert.equal(minFlowStatus(0.375, 0.25).level, 'warn');
        assert.equal(minFlowStatus(0.99, 0.25).level, 'warn');
    });

    test('below 150% is low', () => {
        assert.equal(minFlowStatus(0.37, 0.25).level, 'low');
        assert.equal(minFlowStatus(0, 0.25).level, 'low');
    });

    test('level uses the unrounded percentage', () => {
        const status = minFlowStatus(0.9996, 0.25);
        assert.equal(status.level, 'warn');
        assert.equal(status.text, '400%');
    });

    test('text is just the rounded percentage', () => {
        assert.equal(minFlowStatus(0.512, 0.25).text, '205%');
    });

    test('invalid inputs give null', () => {
        assert.equal(minFlowStatus(undefined, 0.25), null);
        assert.equal(minFlowStatus(1, undefined), null);
        assert.equal(minFlowStatus(1, 0), null);
        assert.equal(minFlowStatus(NaN, 0.25).level, 'low');
    });
});

describe('minFlowNoteHtml', () => {
    test('renders nothing without minFlow metadata', () => {
        assert.equal(minFlowNoteHtml({ ValueNumber: 1 }, { shortName: 'x' }), '');
        assert.equal(minFlowNoteHtml({ ValueNumber: 1 }, undefined), '');
    });

    test('renders nothing without a flow value', () => {
        assert.equal(minFlowNoteHtml(undefined, { minFlow: 0.25 }), '');
        assert.equal(minFlowNoteHtml({ ValueNumber: null }, { minFlow: 0.25 }), '');
    });

    test('renders a coloured note when both are present', () => {
        const html = minFlowNoteHtml({ ValueNumber: 0.5 }, { minFlow: 0.25 });
        assert.match(html, /min-flow-warn/);
        assert.match(html, />200%</);
    });
});