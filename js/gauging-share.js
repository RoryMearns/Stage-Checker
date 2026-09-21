import { encodeStateToCode, decodeCodeToState, copyToClipboard, downloadElementsSideBySide, sanitizeForFilename } from './form-utils.js';
import { collectQualityState, applyQualityState, buildQualityReport, restoreQualityDraft, clearQualityDraft, resetQuality } from './gauging-quality.js';
import { collectNotesState, applyNotesState, buildNotesReport, restoreNotesDraft, clearNotesDraft, resetFieldNotes } from './gauging-notes.js';

const shareButton = document.getElementById('share-link-button');
const downloadAllButton = document.getElementById('download-everything-button');
const shareLinkEl = document.getElementById('share-link-display');

const shareButtonDefaultLabel = shareButton.textContent;
let shareResetTimer = null;

function flashButtonLabel(text, duration) {
    clearTimeout(shareResetTimer);
    shareButton.textContent = text;
    shareResetTimer = setTimeout(() => {
        shareButton.textContent = shareButtonDefaultLabel;
    }, duration);
}

function showCopyFeedback(url, copied) {
    if (copied) {
        shareLinkEl.style.display = 'none';
        flashButtonLabel('Copied!', 5000);
    } else {
        shareLinkEl.dataset.url = url;
        shareLinkEl.textContent = url;
        shareLinkEl.style.display = '';
    }
}

shareButton.addEventListener('click', async () => {
    const combined = {
        n: collectNotesState(),
        q: collectQualityState()
    };
    const code = await encodeStateToCode(combined);
    const url = `${window.location.origin}${window.location.pathname}?d=${code}`;
    const copied = await copyToClipboard(url);
    showCopyFeedback(url, copied);
});

shareLinkEl.addEventListener('click', async () => {
    const url = shareLinkEl.dataset.url;
    if (!url) return;
    const copied = await copyToClipboard(url);
    showCopyFeedback(url, copied);
});

downloadAllButton.addEventListener('click', () => {
    const notesReport = buildNotesReport();
    const qualityReport = buildQualityReport();

    const siteSource = document.getElementById('fn-site-name').value.trim()
        || document.getElementById('fn-location').value.trim();
    const siteValue = sanitizeForFilename(siteSource);
    const dateValue = document.getElementById('fn-date').value || '';
    const nameParts = ['ADCP Gauging Results', siteValue, dateValue].filter(Boolean);

    downloadElementsSideBySide([notesReport, qualityReport], `${nameParts.join(' - ')}.png`);
});

async function loadFromUrlIfPresent() {
    const code = new URLSearchParams(window.location.search).get('d');
    if (!code) return false;

    try {
        const state = await decodeCodeToState(code);
        applyNotesState(state.n);
        applyQualityState(state.q);
    } catch (error) {
        console.error('Failed to load shared link:', error);
    } finally {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
    return true;
}

const draftNotice = document.getElementById('draft-restored-notice');
const dismissDraftNoticeButton = document.getElementById('dismiss-draft-notice');
const clearAllButton = document.getElementById('clear-all-button');

dismissDraftNoticeButton.addEventListener('click', () => {
    draftNotice.style.display = 'none';
});

clearAllButton.addEventListener('click', () => {
    if (!confirm('Clear all data from both forms on this device? This cannot be undone.')) return;
    resetFieldNotes();
    resetQuality();
    draftNotice.style.display = 'none';
});

async function init() {
    const loadedFromLink = await loadFromUrlIfPresent();
    if (loadedFromLink) return;

    const notesRestored = restoreNotesDraft();
    const qualityRestored = restoreQualityDraft();
    if (notesRestored || qualityRestored) {
        draftNotice.style.display = '';
    }
}

init();