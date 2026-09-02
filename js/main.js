import {fetchStageData, fetchFlowData} from "./api.js";
import {isCollapsed, toggleCollapsed, collapseAll, expandAll, areAllCollapsed, subscribe} from "./state.js";

const RUN_INFO_URL = new URL('../data/run-info.json', import.meta.url);
const IMAGES_BASE_URL = new URL('../images/', import.meta.url);

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CHEVRON_SVG = `<svg class="chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

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
    const runsControls = document.getElementById('runs-controls');
    const collapseAllHeader = document.getElementById('collapse-all-header');
    const legendDiv = document.getElementById('legend');
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

        const sectionIds = ['legend', ...runInfo.runs.map(run => `run-${slugify(run.name)}`)];
        setupCollapseControls(sectionIds, runsControls, collapseAllHeader);

        loadingDiv.style.display = 'none';
        runsControls.style.display = 'block';
        runsContainer.style.display = 'block';
        legendDiv.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Failed to load data: ${error.message}`;
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'block';
    }
});

function setupCollapseControls(sectionIds, collapseAllCard, collapseAllHeader) {
    const collapseAllLabel = collapseAllHeader.querySelector('.collapse-all-label');

    function syncCollapsedUI() {
        document.querySelectorAll('.collapsible-section').forEach(section => {
            const id = section.dataset.sectionId;
            const collapsed = isCollapsed(id);
            section.classList.toggle('is-collapsed', collapsed);
            const header = section.querySelector('.run-header');
            if (header) header.setAttribute('aria-expanded', String(!collapsed));
        });

        const allCollapsed = areAllCollapsed(sectionIds);
        collapseAllLabel.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
        collapseAllCard.classList.toggle('is-collapsed', allCollapsed);
        collapseAllHeader.setAttribute('aria-expanded', String(!allCollapsed));
    }

    subscribe(syncCollapsedUI);
    syncCollapsedUI();

    function toggleAll() {
        if (areAllCollapsed(sectionIds)) {
            expandAll(sectionIds);
        } else {
            collapseAll(sectionIds);
        }
    }

    collapseAllHeader.addEventListener('click', toggleAll);
    collapseAllHeader.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleAll();
        }
    });

    // Legend is static markup, not built by renderRuns, so wire its toggle here
    const legendHeader = document.querySelector('#legend .run-header');
    legendHeader.addEventListener('click', () => toggleCollapsed('legend'));
    legendHeader.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCollapsed('legend');
        }
    });
}

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
        const sectionId = `run-${slugify(run.name)}`;
        const bodyId = `${sectionId}-body`;

        const section = document.createElement('div');
        section.className = 'run-section collapsible-section';
        section.dataset.sectionId = sectionId;

        section.innerHTML = `
            <div class="run-header" role="button" tabindex="0" aria-expanded="true" aria-controls="${bodyId}">
                <h2 class="run-heading">${run.name}</h2>
                ${CHEVRON_SVG}
            </div>
            <div class="run-body" id="${bodyId}"></div>
        `;

        const header = section.querySelector('.run-header');
        header.addEventListener('click', () => toggleCollapsed(sectionId));
        header.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCollapsed(sectionId);
            }
        });

        const body = section.querySelector('.run-body');

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

        body.appendChild(table);
        container.appendChild(section);
    });
}