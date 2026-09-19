import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sites = JSON.parse(readFileSync(path.join(__dirname, '../data/sites.json'), 'utf-8'));
const runInfo = JSON.parse(readFileSync(path.join(__dirname, '../data/run-info.json'), 'utf-8'));

describe('sites.json', () => {
    test('every entry has a name, code, and datasetId', () => {
        for (const site of sites) {
            assert.ok(site.name, `entry missing name: ${JSON.stringify(site)}`);
            assert.ok(site.code, `entry missing code: ${JSON.stringify(site)}`);
            assert.ok(site.datasetId, `entry missing datasetId: ${JSON.stringify(site)}`);
        }
    });

    test('site codes are all distinct', () => {
        const codes = sites.map(s => s.code);
        assert.equal(new Set(codes).size, codes.length);
    });

    test('site names are all distinct', () => {
        const names = sites.map(s => s.name);
        assert.equal(new Set(names).size, names.length);
    });

    test('dataset IDs are all distinct', () => {
        const ids = sites.map(s => s.datasetId);
        assert.equal(new Set(ids).size, ids.length);
    });
});

describe('run-info.json structure', () => {
    test('every run has a non-empty name and at least one site', () => {
        for (const run of runInfo.runs) {
            assert.ok(run.name && run.name.trim().length > 0, `run missing a name: ${JSON.stringify(run)}`);
            assert.ok(Array.isArray(run.sites) && run.sites.length > 0, `run "${run.name}" has no sites`);
        }
    });

    test('no site code appears in more than one run', () => {
        const seen = new Map();
        for (const run of runInfo.runs) {
            for (const code of run.sites) {
                if (seen.has(code)) {
                    assert.fail(`site ${code} appears in both "${seen.get(code)}" and "${run.name}"`);
                }
                seen.set(code, run.name);
            }
        }
    });

    test('no site code is listed twice within the same run', () => {
        for (const run of runInfo.runs) {
            assert.equal(new Set(run.sites).size, run.sites.length, `duplicate site within run "${run.name}"`);
        }
    });
});

describe('run-info.json siteMeta thresholds', () => {
    test('sxsUpperLimit is always greater than ftUpperLimit where both are set', () => {
        // This is a real invariant the hydrograph method-threshold bands depend on: if this
        // were ever violated, the "flowtracker below / moving-boat above" zone logic would
        // produce an inverted or nonsensical result for that site.
        for (const [code, meta] of Object.entries(runInfo.siteMeta)) {
            if (typeof meta.ftUpperLimit === 'number' && typeof meta.sxsUpperLimit === 'number') {
                assert.ok(
                    meta.sxsUpperLimit > meta.ftUpperLimit,
                    `${code}: sxsUpperLimit (${meta.sxsUpperLimit}) should be greater than ftUpperLimit (${meta.ftUpperLimit})`
                );
            }
        }
    });

    test('threshold values, where present, are positive numbers', () => {
        for (const [code, meta] of Object.entries(runInfo.siteMeta)) {
            for (const key of ['ftUpperLimit', 'sxsUpperLimit', 'wadeLimitFlow', 'wadeLimitStage']) {
                if (key in meta) {
                    assert.ok(typeof meta[key] === 'number' && meta[key] > 0, `${code}.${key} should be a positive number, got ${meta[key]}`);
                }
            }
        }
    });
});