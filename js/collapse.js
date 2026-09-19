import {collapseAll, expandAll, areAllCollapsed, subscribe} from "./state.js";

export function setupCollapseAllControl(sectionIds, collapseAllCard, collapseAllHeader) {
    const collapseAllLabel = collapseAllHeader.querySelector('.collapse-all-label');

    function sync() {
        const allCollapsed = areAllCollapsed(sectionIds);
        collapseAllLabel.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
        collapseAllCard.classList.toggle('is-collapsed', allCollapsed);
        collapseAllHeader.setAttribute('aria-expanded', String(!allCollapsed));
    }

    subscribe(sync);
    sync();

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
}