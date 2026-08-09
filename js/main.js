import {fetchStageData, fetchFlowData} from "./api.js";

const RUN_INFO_URL = new URL('../data/run-info.json', import.meta.url);

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

    const overdueTag = isOverdue
        ? '<span class="overdue-tag" title="Equipment overdue — this site has stopped reporting, value may be stale">Overdue</span>'
        : '';

    let valueMarkup = '<span>—</span>';
    if (hasValue) {
        valueMarkup = `<span>${dataItem.ValueNumber.toFixed(3)}</span>`;
    } else if (isOverdue) {
        valueMarkup = '';
    }

    return `<span class="value-cell">${extraTag}${overdueTag}${valueMarkup}</span>`;
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
            </colgroup>
            <thead>
                <tr>
                    <th>Location</th>
                    <th class="has-text-right">Stage (m)</th>
                    <th class="has-text-right">Flow (m³/s)</th>
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
                    <td colspan="3" class="has-text-grey-light">${siteId} — no data returned</td>
                `;
                tbody.appendChild(row);
                return;
            }

            const meta = siteMeta[siteId];
            const wadeLimitTag = meta?.wadeLimitFlow !== undefined
                ? ` <span class="tag is-warning is-light is-hidden-mobile">limit ${meta.wadeLimitFlow}</span>`
                : '';

            const flowItem = flowBySite.get(siteId);

            row.innerHTML = `
                <td>${item.Location}</td>
                <td class="has-text-right">${formatValueCell(item, wadeLimitTag)}</td>
                <td class="has-text-right">${formatValueCell(flowItem)}</td>
            `;
            tbody.appendChild(row);
        });

        section.appendChild(table);
        container.appendChild(section);
    });
}