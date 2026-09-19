import {toggleCollapsed} from "./state.js";
import {runSectionId} from "./utils.js";
import {flowIconName, flowIconUrl, FLOW_ICON_LABELS} from "./icons.js";
import {fetchDischargeTimeSeries} from "./api.js";
import {todayIsoNz} from "./form-utils.js";
import {parseTimeSeriesResponse, renderHydrograph} from "./hydrograph.js";

const CHEVRON_SVG = `<svg class="chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

function extractTimeFromEndOfRecord(endOfRecord) {
    if (!endOfRecord) return null;
    const match = endOfRecord.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    return `${match[1]}:${match[2]}`;
}

function formatValueCell(dataItem, extraTag = '') {
    const isOverdue = dataItem?.State === 'OVERDUE';
    const hasValue = dataItem && typeof dataItem.ValueNumber === 'number';

    const text = hasValue ? dataItem.ValueNumber.toFixed(3) : '—';
    const overdueAttrs = isOverdue
        ? ' class="is-overdue" title="Equipment overdue — this site has stopped reporting, value may be stale"'
        : '';

    const time = hasValue ? extractTimeFromEndOfRecord(dataItem.EndOfRecord) : null;
    const timestampHtml = time ? `<span class="value-timestamp">at ${time}</span>` : '';

    return `<span class="value-cell-wrap"><span class="value-cell">${extraTag}<span${overdueAttrs}>${text}</span></span>${timestampHtml}</span>`;
}

function buildSectionHeader(sectionId, name, bodyId) {
    const header = document.createElement('div');
    header.className = 'run-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', 'true');
    header.setAttribute('aria-controls', bodyId);
    header.innerHTML = `<h2 class="run-heading">${name}</h2>${CHEVRON_SVG}`;

    header.addEventListener('click', () => toggleCollapsed(sectionId));
    header.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCollapsed(sectionId);
        }
    });

    return header;
}

function buildTableSkeleton() {
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
    return table;
}

function buildHydrographRow(datasetId, siteCode, methodThresholds) {
    const tr = document.createElement('tr');
    tr.className = 'hydrograph-row';

    const td = document.createElement('td');
    td.colSpan = 4;
    td.innerHTML = `
        <div class="hydrograph-panel">
            <div class="hydrograph-loading">
                <span class="hydrograph-spinner"></span>
                <span>Loading hydrograph...</span>
            </div>
            <div class="hydrograph-content is-hidden"></div>
        </div>
    `;
    tr.appendChild(td);

    const loadingEl = td.querySelector('.hydrograph-loading');
    const contentEl = td.querySelector('.hydrograph-content');

    fetchDischargeTimeSeries({ datasetId, siteCode, date: todayIsoNz() })
        .then(raw => {
            const parsed = parseTimeSeriesResponse(raw);
            if (parsed === null || !parsed.points.length) {
                loadingEl.textContent = 'No recent data available for this site.';
                return;
            }
            loadingEl.classList.add('is-hidden');
            contentEl.classList.remove('is-hidden');
            renderHydrograph(contentEl, parsed.points, null, parsed.nowTime, [], methodThresholds);
        })
        .catch(error => {
            console.error('Failed to load hydrograph:', error);
            loadingEl.textContent = "Couldn't load data for this site.";
        });

    return tr;
}

function buildSiteRow(siteId, stageBySite, flowBySite, siteMeta) {
    const item = stageBySite.get(siteId);
    const row = document.createElement('tr');

    if (!item) {
        row.innerHTML = `<td colspan="4" class="has-text-grey-light">${siteId} — no data returned</td>`;
        return row;
    }

    const meta = siteMeta[siteId];
    const shortName = meta?.shortName?.trim();
    const locationCell = shortName
        ? `<span class="full-name">${item.Location}</span><span class="short-name">${shortName}</span>`
        : item.Location;

    const flowItem = flowBySite.get(siteId);
    const iconName = flowIconName(flowItem, meta);
    const iconUrl = flowIconUrl(iconName);
    const iconLabel = FLOW_ICON_LABELS[iconName];

    row.innerHTML = `
        <td>${locationCell}</td>
        <td class="has-text-right stage-cell">${formatValueCell(item)}</td>
        <td class="has-text-right flow-cell">${formatValueCell(flowItem)}</td>
        <td class="has-text-centered icon-cell"><img src="${iconUrl}" alt="${iconLabel}" title="${iconLabel}" class="row-icon"></td>
    `;

    if (flowItem?.DatasetId) {
        row.classList.add('is-clickable-row');
        row.addEventListener('click', () => {
            const next = row.nextElementSibling;
            if (next && next.classList.contains('hydrograph-row')) {
                next.remove();
                return;
            }
            const methodThresholds = {
                ftUpperLimit: meta?.ftUpperLimit,
                sxsUpperLimit: meta?.sxsUpperLimit,
                icons: {
                    flowtracker: flowIconUrl('flowtracker'),
                    microboard: flowIconUrl('microboard'),
                    'moving-boat': flowIconUrl('moving-boat')
                },
                iconLabels: FLOW_ICON_LABELS
            };
            row.insertAdjacentElement('afterend', buildHydrographRow(flowItem.DatasetId, siteId, methodThresholds));
        });
    }

    return row;
}

function buildRunSection(run, stageBySite, flowBySite, siteMeta) {
    const sectionId = runSectionId(run.name);
    const bodyId = `${sectionId}-body`;

    const section = document.createElement('div');
    section.className = 'run-section collapsible-section';
    section.dataset.sectionId = sectionId;

    const header = buildSectionHeader(sectionId, run.name, bodyId);

    const body = document.createElement('div');
    body.className = 'run-body';
    body.id = bodyId;

    const table = buildTableSkeleton();
    const tbody = table.querySelector('tbody');

    run.sites.filter(Boolean).forEach(siteId => {
        tbody.appendChild(buildSiteRow(siteId, stageBySite, flowBySite, siteMeta));
    });

    body.appendChild(table);
    section.appendChild(header);
    section.appendChild(body);

    return section;
}

export function renderRuns(runs, stageBySite, flowBySite, siteMeta, container) {
    container.innerHTML = '';
    runs.forEach(run => {
        container.appendChild(buildRunSection(run, stageBySite, flowBySite, siteMeta));
    });
}