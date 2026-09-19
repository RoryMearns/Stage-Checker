import { isCollapsed, toggleCollapsed, subscribe } from './state.js';

export const CHEVRON_SVG = '<svg class="chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

export function makeCollapsible(sectionEl, headerEl, bodyEl, sectionId) {
    sectionEl.classList.add('collapsible-section');
    sectionEl.dataset.sectionId = sectionId;

    headerEl.classList.add('run-header');
    headerEl.setAttribute('role', 'button');
    headerEl.setAttribute('tabindex', '0');
    headerEl.setAttribute('aria-controls', bodyEl.id);
    headerEl.insertAdjacentHTML('beforeend', CHEVRON_SVG);

    function sync() {
        const collapsed = isCollapsed(sectionId);
        sectionEl.classList.toggle('is-collapsed', collapsed);
        headerEl.setAttribute('aria-expanded', String(!collapsed));
    }

    headerEl.addEventListener('click', () => toggleCollapsed(sectionId));
    headerEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleCollapsed(sectionId);
        }
    });

    const unsubscribe = subscribe(sync);
    sync();
    return unsubscribe;
}