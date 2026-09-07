import {isCollapsed, toggleCollapsed, collapseAll, expandAll, areAllCollapsed, subscribe} from "./state.js";

export function setupCollapseControls(sectionIds, collapseAllCard, collapseAllHeader) {
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

    const legendHeader = document.querySelector('#legend .run-header');
    legendHeader.addEventListener('click', () => toggleCollapsed('legend'));
    legendHeader.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCollapsed('legend');
        }
    });
}