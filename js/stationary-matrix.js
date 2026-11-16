export const QC_ORDER = [200, 400, 500, 600];

export const QC_LABELS = {
    600: 'Good',
    500: 'Fair',
    400: 'Poor',
    200: 'Unverified'
};

const SOLO = 'all';

function option(qc, text, derived = false) {
    return { qc, text, derived };
}

function solo(...options) {
    return [{ id: SOLO, label: null, options }];
}

function percentBands(noneText, derivedFiveText) {
    return solo(
        option(600, noneText),
        option(500, derivedFiveText, true),
        option(400, '25–50%'),
        option(200, '> 50%', true)
    );
}

export const SITE_CRITERIA = [
    {
        id: 's1',
        section: 'Channel characteristics',
        name: 'Straight channel',
        groups: solo(
            option(600, 'No discernible flow angles, or ADCP'),
            option(500, 'Flow angle up to 20 degrees', true),
            option(400, '20–45 degree flow angle'),
            option(200, 'Flow angle over 45 degrees', true)
        )
    },
    {
        id: 's2',
        section: 'Channel characteristics',
        name: 'Change in depth',
        groups: solo(
            option(600, '< 100%, or ADCP'),
            option(500, '100–300%', true),
            option(400, '> 300%')
        )
    },
    {
        id: 's3',
        section: 'Channel characteristics',
        name: 'Undercut banks',
        groups: solo(
            option(600, 'None'),
            option(500, 'Less than 25%', true),
            option(400, '25–50%'),
            option(200, '> 50%', true)
        )
    },
    {
        id: 's4',
        section: 'In-flow obstructions',
        name: 'Benthic weed',
        groups: percentBands('< 10%, or ADCP', '10–25%')
    },
    {
        id: 's5',
        section: 'In-flow obstructions',
        name: 'Riverside/surface vegetation',
        groups: percentBands('< 10%', '10–25%')
    },
    {
        id: 's6',
        section: 'In-flow obstructions',
        name: 'Submerged obstructions',
        hint: '> 1/3 of depth',
        groups: percentBands('None, or ADCP', 'Less than 25%')
    },
    {
        id: 's7',
        section: 'In-flow obstructions',
        name: 'Partially submerged obstructions',
        groups: percentBands('None, or ADCP', 'Less than 25%')
    },
    {
        id: 's8',
        section: 'In-flow obstructions',
        name: 'Total percentage of in-flow obstructions',
        groups: percentBands('< 10%, or ADCP', '10–25%')
    }
];

export const CHANNEL_CRITERION_IDS = ['s1', 's2', 's3'];

export const METHOD_CRITERIA = [
    {
        id: 'm1',
        name: 'Instrument calibration valid',
        ref: '3.5',
        groups: solo(option(600, 'Yes'), option(200, 'No'))
    },
    {
        id: 'm2',
        name: 'Instrument used within calibrated velocity/depth range',
        ref: '3.4.4.5',
        groups: solo(option(600, 'Yes'), option(200, 'No'))
    },
    {
        id: 'm3',
        name: 'Pre-deployment test',
        ref: '3.4.4.3',
        groups: solo(
            option(600, 'Completed with no errors'),
            option(200, 'Not completed, or completed with error/failed')
        )
    },
    {
        id: 'm4',
        name: 'Oblique flow',
        ref: '3.4.4.2',
        groups: solo(
            option(600, 'Not present, or ADCP/ADV used'),
            option(500, 'Present, measured and accounted for', true),
            option(400, 'Present, but not measured and accounted for')
        )
    },
    {
        id: 'm5',
        name: 'Depth measurement',
        ref: '3.3.2',
        groups: [
            {
                id: 'adcp',
                label: 'ADCP',
                options: [option(600, 'ADCP used')]
            },
            {
                id: 'cable-firm',
                label: 'Cable, firm bed',
                options: [
                    option(600, 'No mobile bed and wet/air-line angles absent, or angles present, measured and applied, or POEM'),
                    option(400, 'Mobile bed known/likely, or wet/air-line angles present and not applied')
                ]
            },
            {
                id: 'cable-soft',
                label: 'Cable, soft bed',
                options: [
                    option(600, 'Bed visible across entire section'),
                    option(400, 'Bed not visible across entire section')
                ]
            },
            {
                id: 'rod-firm',
                label: 'Rod, firm bed',
                options: [
                    option(600, 'No mobile bed'),
                    option(500, 'Mobile bed')
                ]
            },
            {
                id: 'rod-soft',
                label: 'Rod, soft bed',
                options: [
                    option(600, 'Bed visible across entire section'),
                    option(400, 'Bed not visible across entire section')
                ]
            }
        ]
    },
    {
        id: 'm6',
        name: 'Maximum segment discharge',
        ref: '3.4.2',
        groups: solo(
            option(600, '≤ 10%'),
            option(400, '> 10% but < 15%'),
            option(200, '≥ 15%', true)
        )
    },
    {
        id: 'm7',
        name: 'Velocity profile',
        ref: '3.6.1',
        groups: [
            {
                id: 'adcp-poem',
                label: 'ADCP, or POEM',
                options: [option(600, 'ADCP or POEM used')]
            },
            {
                id: 'regular',
                label: 'Proven regular velocity profile',
                options: [
                    option(600, 'Single-point method, < 0.5 m deep, or ≥ 3-point method'),
                    option(500, 'Single-point method, > 0.5 m deep')
                ]
            },
            {
                id: 'irregular',
                label: 'Known irregular or unknown velocity profile',
                options: [
                    option(600, '≥ 3-point method, or single-point method, < 0.2 m deep'),
                    option(500, 'Single-point method, 0.2–0.5 m deep', true),
                    option(400, 'Single-point method, > 0.5 m deep')
                ]
            }
        ]
    },
    {
        id: 'm8',
        name: 'QC warnings: Poor Boundary, Low SNR and Spikes only',
        groups: solo(
            option(600, 'None, or ADCP used'),
            option(500, 'Up to 25% of verticals contain warnings', true),
            option(400, '25–50% of verticals contain warnings'),
            option(200, '> 50% of verticals contain warnings', true)
        )
    },
    {
        id: 'm10',
        name: '95% uncertainty',
        ref: '3.7.2',
        groups: solo(
            option(600, '≤ 8%'),
            option(500, '> 8% but < 10%', true),
            option(400, '10–20%'),
            option(200, '> 20%', true)
        )
    }
];

export function optionValue(group, opt) {
    return `${group.id}:${opt.qc}`;
}

export function findOption(criterion, value) {
    for (const group of criterion.groups) {
        const match = group.options.find(opt => optionValue(group, opt) === value);
        if (match) return { group, option: match };
    }
    return null;
}

export function qcForSelection(criterion, value) {
    const found = findOption(criterion, value);
    return found ? found.option.qc : null;
}

export function lowestQc(codes) {
    const valid = codes.filter(code => typeof code === 'number');
    return valid.length ? Math.min(...valid) : null;
}

function selectedCodes(criteria, selections) {
    return criteria
        .map(criterion => qcForSelection(criterion, selections[criterion.id]))
        .filter(code => code !== null);
}

export function channelTotalQc(selections) {
    const channelCriteria = SITE_CRITERIA.filter(c => CHANNEL_CRITERION_IDS.includes(c.id));
    const codes = selectedCodes(channelCriteria, selections);
    if (!codes.length) return null;

    const atOrBelow400 = codes.filter(code => code <= 400).length;
    const at500 = codes.filter(code => code === 500).length;

    if (atOrBelow400 >= 1 || at500 >= 2) return 400;
    if (at500 === 1) return 500;
    return 600;
}

export function channelCounts(selections) {
    const channelCriteria = SITE_CRITERIA.filter(c => CHANNEL_CRITERION_IDS.includes(c.id));
    const codes = selectedCodes(channelCriteria, selections);
    return {
        answered: codes.length,
        below600: codes.filter(code => code < 600).length,
        total: channelCriteria.length
    };
}

export function siteQuality(selections) {
    const codes = [...selectedCodes(SITE_CRITERIA, selections), channelTotalQc(selections)];
    return lowestQc(codes);
}

export function methodQuality(selections, siteQc) {
    return lowestQc([...selectedCodes(METHOD_CRITERIA, selections), siteQc]);
}

export function assessedCount(criteria, selections) {
    return selectedCodes(criteria, selections).length;
}
