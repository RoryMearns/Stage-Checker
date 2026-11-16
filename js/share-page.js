import { encodeStateToCode, decodeCodeToState, copyToClipboard, downloadElementsSideBySide, sanitizeForFilename } from './form-utils.js';

function byId(id) {
    return document.getElementById(id);
}

function setupShareLink({ collect, apply }) {
    const shareButton = byId('share-link-button');
    const shareLinkEl = byId('share-link-display');
    const defaultLabel = shareButton.textContent;
    let resetTimer = null;

    function flashLabel(text, duration) {
        clearTimeout(resetTimer);
        shareButton.textContent = text;
        resetTimer = setTimeout(() => {
            shareButton.textContent = defaultLabel;
        }, duration);
    }

    function showCopyFeedback(url, copied) {
        if (copied) {
            shareLinkEl.style.display = 'none';
            flashLabel('Copied!', 5000);
            return;
        }
        shareLinkEl.dataset.url = url;
        shareLinkEl.textContent = url;
        shareLinkEl.style.display = '';
    }

    async function copyShareUrl(url) {
        showCopyFeedback(url, await copyToClipboard(url));
    }

    shareButton.addEventListener('click', async () => {
        const code = await encodeStateToCode(collect());
        await copyShareUrl(`${window.location.origin}${window.location.pathname}?d=${code}`);
    });

    shareLinkEl.addEventListener('click', () => {
        if (shareLinkEl.dataset.url) copyShareUrl(shareLinkEl.dataset.url);
    });

    return async function loadFromUrlIfPresent() {
        const code = new URLSearchParams(window.location.search).get('d');
        if (!code) return false;

        try {
            apply(await decodeCodeToState(code));
        } catch (error) {
            console.error('Failed to load shared link:', error);
        } finally {
            window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        }
        return true;
    };
}

function setupDownloadAll({ buildReports, filePrefix }) {
    byId('download-everything-button').addEventListener('click', () => {
        const siteSource = byId('fn-site-name').value.trim() || byId('fn-location').value.trim();
        const nameParts = [filePrefix, sanitizeForFilename(siteSource), byId('fn-date').value || ''].filter(Boolean);
        downloadElementsSideBySide(buildReports(), `${nameParts.join(' - ')}.png`);
    });
}

function setupClearAll({ resets }) {
    const draftNotice = byId('draft-restored-notice');

    byId('dismiss-draft-notice').addEventListener('click', () => {
        draftNotice.style.display = 'none';
    });

    byId('clear-all-button').addEventListener('click', () => {
        if (!confirm('Clear all data from both forms on this device? This cannot be undone.')) return;
        resets.forEach(reset => reset());
        draftNotice.style.display = 'none';
    });

    return draftNotice;
}

export function setupSharePage({ notes, quality, filePrefix }) {
    const loadFromUrlIfPresent = setupShareLink({
        collect: () => ({ n: notes.collect(), q: quality.collect() }),
        apply: state => {
            notes.apply(state.n);
            quality.apply(state.q);
        }
    });

    setupDownloadAll({
        buildReports: () => [notes.build(), quality.build()],
        filePrefix
    });

    const draftNotice = setupClearAll({ resets: [notes.reset, quality.reset] });

    async function init() {
        if (await loadFromUrlIfPresent()) return;
        const notesRestored = notes.restoreDraft();
        const qualityRestored = quality.restoreDraft();
        if (notesRestored || qualityRestored) draftNotice.style.display = '';
    }

    init();
}
