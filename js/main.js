import {fetchStageData} from "./api.js";

async function loadRunInfo() {
    const res = await fetch('../data/run-info.json');
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
        const [runInfo, response] = await Promise.all([
            loadRunInfo(),
            fetchStageData()
        ]);

        const siteMeta = runInfo.siteMeta ?? {};

        const dataBySite = new Map(
            (response.Data ?? []).map(item => [item.LocationIdentifier, item])
        );

        renderRuns(runInfo.runs, dataBySite, siteMeta, runsContainer);

        loadingDiv.style.display = 'none';
        runsContainer.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Failed to load data: ${error.message}`;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
});

function renderRuns(runs, dataBySite, siteMeta, container) {
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
            <thead>
                <tr>
                    <th>Location</th>
                    <th class="has-text-right">Stage (m)</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        run.sites.filter(Boolean).forEach(siteId => {
            const item = dataBySite.get(siteId);
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
                ? ` <span class="tag is-warning is-light">limit ${meta.wadeLimitFlow}</span>`
                : '';

            row.innerHTML = `
                <td>${item.Location}</td>
                <td class="has-text-right">${wadeLimitTag}${item.ValueNumber.toFixed(3)}</td>
            `;
            tbody.appendChild(row);
        });

        section.appendChild(table);
        container.appendChild(section);
    });
}