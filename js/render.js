import {toggleCollapsed} from "./state.js";
import {runSectionId} from "./utils.js";
import {flowIconName, flowIconUrl, FLOW_ICON_LABELS} from "./icons.js";

const CHEVRON_SVG = `<svg class="chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

function formatValueCell(dataItem, extraTag = '') {
    const isOverdue = dataItem?.State === 'OVERDUE';
    const hasValue = dataItem && typeof dataItem.ValueNumber === 'number';

    const text = hasValue ? dataItem.ValueNumber.toFixed(3) : '—';
    const overdueAttrs = isOverdue
        ? ' class="is-overdue" title="Equipment overdue — this site has stopped reporting, value may be stale"'
        : '';

    return `<span class="value-cell">${extraTag}<span${overdueAttrs}>${text}</span></span>`;
}

export function renderRuns(runs, stageBySite, flowBySite, siteMeta, container) {
    container.innerHTML = '';

    runs.forEach(run => {
        const sectionId = runSectionId(run.name);
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
            const iconUrl = flowIconUrl(iconName);
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