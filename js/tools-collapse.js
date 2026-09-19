import { slugify } from './utils.js';
import { makeCollapsible } from './collapsible.js';

document.querySelectorAll('.calc-card').forEach(card => {
    const heading = card.querySelector('.calc-title');
    if (!heading) return;

    const sectionId = `tool-${slugify(heading.textContent.trim())}`;
    const bodyId = `${sectionId}-body`;

    const body = document.createElement('div');
    body.className = 'run-body';
    body.id = bodyId;
    Array.from(card.children)
        .filter(el => el !== heading)
        .forEach(el => body.appendChild(el));

    const header = document.createElement('div');
    header.className = 'calc-header';
    header.appendChild(heading);

    card.appendChild(header);
    card.appendChild(body);

    makeCollapsible(card, header, body, sectionId);
});