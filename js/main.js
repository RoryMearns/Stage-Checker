import {fetchStageData, fetchFlowData} from "./api.js";

const RUN_INFO_URL = new URL('../data/run-info.json', import.meta.url);
const IMAGES_BASE_URL = new URL('../images/', import.meta.url);

const FLOW_ICON_LABELS = {
    flowtracker: 'Flow below FT limit',
    microboard: 'Flow at or above FT limit, below SXS limit',
    'moving-boat': 'Flow at or above SXS limit',
    'no-data': 'No flow limit data available'
};

function flowIconName(flowItem, meta) {
    const ft = meta?.ftUpperLimit;
    const sxs = meta?.sxsUpperLimit;
    const value = (flowItem && typeof flowItem.ValueNumber === 'number') ? flowItem.ValueNumber : null;

    if (value === null || typeof ft !== 'number' || typeof sxs !== 'number') {
        return 'no-data';
    }
    if (value < ft) return 'flowtracker';
    if (value < sxs) return 'microboard';
    return 'moving-boat';
}

async function loadRunInfo() {
    const res = await fetch(RUN_INFO_URL, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to load run-info.json (${res.status})`);
    }
    return res.json();
}

document.addEventListener('DOMContentLoaded', async () => {
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const runsContainer = document.getElementById('runs-container');
    const errorMessage = document.getElementById('error-message');

    try {
        const [runInfo, stageResponse, flowResponse] = await Promise.all([
            loadRunInfo(),
            fetchStageData(),
            fetchFlowData()
        ]);

        const siteMeta = runInfo.siteMeta ?? {};

        const stageBySite = new Map(
            (stageResponse.Data ?? []).map(item => [item.LocationIdentifier, item])
        );
        const flowBySite = new Map(
            (flowResponse.Data ?? []).map(item => [item.LocationIdentifier, item])
        );

        renderRuns(runInfo.runs, stageBySite, flowBySite, siteMeta, runsContainer);

        loadingDiv.style.display = 'none';
        runsContainer.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Failed to load data: ${error.message}`;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
});

function formatValueCell(dataItem, extraTag = '') {
    const isOverdue = dataItem?.State === 'OVERDUE';
    const hasValue = dataItem && typeof dataItem.ValueNumber === 'number';

    const text = hasValue ? dataItem.ValueNumber.toFixed(3) : '—';
    const overdueAttrs = isOverdue
        ? ' class="is-overdue" title="Equipment overdue — this site has stopped reporting, value may be stale"'
        : '';

    return `<span class="value-cell">${extraTag}<span${overdueAttrs}>${text}</span></span>`;
}

function renderRuns(runs, stageBySite, flowBySite, siteMeta, container) {
    container.innerHTML = '';

    runs.forEach(run => {
        const section = document.createElement('div');
        section.className = 'run-section';

        const heading = document.createElement('h2');
        heading.className = 'run-heading';
        heading.textContent = run.name;
        section.appendChild(heading);

        const table = document.createElement('table');
        table.className = 'table is-striped is-hoverable is-fullwidth';
        table.innerHTML = `
            <colgroup>
                <col>
                <col class="col-stage">
                <col class="col-flow">
                <col class="col-icon">
            </colgroup>
            <thead>
                <tr>
                    <th>Location</th>
                    <th class="has-text-right">Stage<span class="unit-label is-hidden-mobile"> (m)</span></th>
                    <th class="has-text-right">Flow<span class="unit-label is-hidden-mobile"> (m³/s)</span></th>
                    <th></th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        run.sites.filter(Boolean).forEach(siteId => {
            const item = stageBySite.get(siteId);
            const row = document.createElement('tr');

            if (!item) {
                row.innerHTML = `
                    <td colspan="4" class="has-text-grey-light">${siteId} — no data returned</td>
                `;
                tbody.appendChild(row);
                return;
            }

            const meta = siteMeta[siteId];
            const shortName = meta?.shortName?.trim();
            const locationCell = shortName
                ? `<span class="full-name">${item.Location}</span><span class="short-name">${shortName}</span>`
                : item.Location;

            const flowItem = flowBySite.get(siteId);
            const iconName = flowIconName(flowItem, meta);
            const iconUrl = new URL(`${iconName}.svg`, IMAGES_BASE_URL).href;
            const iconLabel = FLOW_ICON_LABELS[iconName];

            row.innerHTML = `
                <td>${locationCell}</td>
                <td class="has-text-right stage-cell">${formatValueCell(item)}</td>
                <td class="has-text-right flow-cell">${formatValueCell(flowItem)}</td>
                <td class="has-text-centered icon-cell"><img src="${iconUrl}" alt="${iconLabel}" title="${iconLabel}" class="row-icon"></td>
            `;
            tbody.appendChild(row);
        });

        section.appendChild(table);
        container.appendChild(section);
    });
}