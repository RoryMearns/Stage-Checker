let sitesPromise = null;

function loadSites() {
    if (!sitesPromise) {
        sitesPromise = fetch('/data/sites.json', { cache: 'no-store' })
            .then(response => response.json())
            .catch(error => {
                console.error('Failed to load sites list:', error);
                return [];
            });
    }
    return sitesPromise;
}

export function setupSiteAutocomplete({ inputEl, listEl, onSelect }) {
    let sites = [];
    loadSites().then(data => { sites = data; });

    function closeList() {
        listEl.innerHTML = '';
        listEl.style.display = 'none';
    }

    function renderMatches(matches) {
        if (!matches.length) {
            closeList();
            return;
        }
        listEl.innerHTML = matches.map(site => `
            <li class="site-autocomplete-item" data-code="${site.code}">
                <span class="site-autocomplete-name">${site.name}</span>
                <span class="site-autocomplete-code">${site.code}</span>
            </li>
        `).join('');
        listEl.style.display = '';
    }

    inputEl.addEventListener('input', () => {
        const query = inputEl.value.trim().toLowerCase();
        if (!query) {
            closeList();
            return;
        }
        const matches = sites
            .filter(site => site.name.toLowerCase().startsWith(query))
            .slice(0, 8);
        renderMatches(matches);
    });

    listEl.addEventListener('click', event => {
        const item = event.target.closest('.site-autocomplete-item');
        if (!item) return;
        const site = sites.find(s => s.code === item.dataset.code);
        if (!site) return;
        inputEl.value = site.name;
        closeList();
        if (onSelect) onSelect(site);
    });

    inputEl.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeList();
    });

    document.addEventListener('click', event => {
        if (!inputEl.contains(event.target) && !listEl.contains(event.target)) {
            closeList();
        }
    });
}