import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    QC_ORDER,
    SITE_CRITERIA,
    METHOD_CRITERIA,
    optionValue,
    findOption,
    qcForSelection,
    lowestQc,
    channelTotalQc,
    channelCounts,
    siteQuality,
    methodQuality,
    assessedCount
} from '../js/stationary-matrix.js';

const allCriteria = [...SITE_CRITERIA, ...METHOD_CRITERIA];

function best(criteria) {
    const selections = {};
    for (const criterion of criteria) {
        const group = criterion.groups[0];
        const top = group.options.find(opt => opt.qc === 600);
        selections[criterion.id] = optionValue(group, top);
    }
    return selections;
}

function pick(criteria, id, qc) {
    const criterion = criteria.find(c => c.id === id);
    for (const group of criterion.groups) {
        const opt = group.options.find(o => o.qc === qc);
        if (opt) return optionValue(group, opt);
    }
    throw new Error(`no QC ${qc} option on ${id}`);
}

describe('matrix definitions', () => {
    test('criterion ids are unique across both matrices', () => {
        const ids = allCriteria.map(c => c.id);
        assert.equal(new Set(ids).size, ids.length);
    });

    test('every option uses a valid QC level and option values are unique within a criterion', () => {
        for (const criterion of allCriteria) {
            const values = [];
            for (const group of criterion.groups) {
                for (const opt of group.options) {
                    assert.ok(QC_ORDER.includes(opt.qc), `${criterion.id}: invalid QC ${opt.qc}`);
                    values.push(optionValue(group, opt));
                }
            }
            assert.equal(new Set(values).size, values.length, `${criterion.id}: duplicate option values`);
        }
    });

    test('every criterion offers a QC 600 option', () => {
        for (const criterion of allCriteria) {
            const hasTop = criterion.groups.some(group => group.options.some(opt => opt.qc === 600));
            assert.ok(hasTop, `${criterion.id} has no QC 600 option`);
        }
    });

    test('matrix sizes match Annex B and C', () => {
        assert.equal(SITE_CRITERIA.length, 8);
        assert.equal(METHOD_CRITERIA.length, 9);
    });
});

describe('lookups', () => {
    test('findOption and qcForSelection resolve a grouped option', () => {
        const criterion = METHOD_CRITERIA.find(c => c.id === 'm5');
        assert.equal(qcForSelection(criterion, 'rod-firm:500'), 500);
        assert.equal(findOption(criterion, 'cable-soft:400').group.label, 'Cable, soft bed');
    });

    test('unknown or missing selections give null', () => {
        const criterion = SITE_CRITERIA[0];
        assert.equal(qcForSelection(criterion, 'nope'), null);
        assert.equal(qcForSelection(criterion, undefined), null);
    });
});

describe('lowestQc', () => {
    test('returns the lowest code', () => {
        assert.equal(lowestQc([600, 500, 400]), 400);
        assert.equal(lowestQc([600, 200, 500]), 200);
    });

    test('ignores non-numbers and returns null for nothing', () => {
        assert.equal(lowestQc([null, 600, undefined]), 600);
        assert.equal(lowestQc([]), null);
        assert.equal(lowestQc([null]), null);
    });
});

describe('channelTotalQc (Annex B total row)', () => {
    test('nothing answered gives null', () => {
        assert.equal(channelTotalQc({}), null);
    });

    test('all QC 600 gives 600', () => {
        assert.equal(channelTotalQc(best(SITE_CRITERIA)), 600);
    });

    test('exactly one QC 500 gives 500', () => {
        const selections = { ...best(SITE_CRITERIA), s3: pick(SITE_CRITERIA, 's3', 500) };
        assert.equal(channelTotalQc(selections), 500);
    });

    test('two QC 500 gives 400', () => {
        const selections = {
            ...best(SITE_CRITERIA),
            s2: pick(SITE_CRITERIA, 's2', 500),
            s3: pick(SITE_CRITERIA, 's3', 500)
        };
        assert.equal(channelTotalQc(selections), 400);
    });

    test('one QC 400 gives 400', () => {
        const selections = { ...best(SITE_CRITERIA), s1: pick(SITE_CRITERIA, 's1', 400) };
        assert.equal(channelTotalQc(selections), 400);
    });

    test('in-flow obstruction answers do not affect the channel total', () => {
        const selections = { ...best(SITE_CRITERIA), s4: pick(SITE_CRITERIA, 's4', 400) };
        assert.equal(channelTotalQc(selections), 600);
    });
});

describe('siteQuality', () => {
    test('nothing answered gives null', () => {
        assert.equal(siteQuality({}), null);
    });

    test('all best answers give 600', () => {
        assert.equal(siteQuality(best(SITE_CRITERIA)), 600);
    });

    test('lowest in-flow obstruction answer wins', () => {
        const selections = { ...best(SITE_CRITERIA), s6: pick(SITE_CRITERIA, 's6', 400) };
        assert.equal(siteQuality(selections), 400);
    });

    test('a single QC 500 channel answer caps the site at 500', () => {
        const selections = { ...best(SITE_CRITERIA), s3: pick(SITE_CRITERIA, 's3', 500) };
        assert.equal(siteQuality(selections), 500);
    });

    test('QC 200 on a row wins', () => {
        const selections = { ...best(SITE_CRITERIA), s3: pick(SITE_CRITERIA, 's3', 200) };
        assert.equal(siteQuality(selections), 200);
    });
});

describe('methodQuality', () => {
    test('all best answers with a 600 site give 600', () => {
        assert.equal(methodQuality(best(METHOD_CRITERIA), 600), 600);
    });

    test('site quality feeds the method result', () => {
        assert.equal(methodQuality(best(METHOD_CRITERIA), 500), 500);
        assert.equal(methodQuality(best(METHOD_CRITERIA), 400), 400);
    });

    test('a QC 200 method answer overrides a good site', () => {
        const selections = { ...best(METHOD_CRITERIA), m3: pick(METHOD_CRITERIA, 'm3', 200) };
        assert.equal(methodQuality(selections, 600), 200);
    });

    test('unassessed site does not block the method result', () => {
        assert.equal(methodQuality(best(METHOD_CRITERIA), null), 600);
    });

    test('nothing at all gives null', () => {
        assert.equal(methodQuality({}, null), null);
    });
});

describe('channelCounts', () => {
    test('counts answered and below-600 channel characteristics', () => {
        const selections = {
            s1: pick(SITE_CRITERIA, 's1', 600),
            s2: pick(SITE_CRITERIA, 's2', 500),
            s4: pick(SITE_CRITERIA, 's4', 400)
        };
        assert.deepEqual(channelCounts(selections), { answered: 2, below600: 1, total: 3 });
    });
});

describe('assessedCount', () => {
    test('counts only recognised selections', () => {
        const selections = { s1: pick(SITE_CRITERIA, 's1', 600), s2: 'bogus' };
        assert.equal(assessedCount(SITE_CRITERIA, selections), 1);
    });
});
