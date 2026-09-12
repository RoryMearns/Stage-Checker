import { encodeStateToCode, decodeCodeToState, copyToClipboard, downloadElementsSideBySide, sanitizeForFilename } from './form-utils.js';
import { collectQualityState, applyQualityState, buildQualityReport } from './gauging-quality.js';
import { collectNotesState, applyNotesState, buildNotesReport } from './gauging-notes.js';

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
        // Clipboard write failed - fall back to showing the link so it can be copied manually
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
    if (!code) return;

    try {
        const state = await decodeCodeToState(code);
        applyNotesState(state.n);
        applyQualityState(state.q);
    } catch (error) {
        console.error('Failed to load shared link:', error);
    } finally {
        // Remove the code from the URL bar so refreshing the page doesn't re-apply it
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

loadFromUrlIfPresent();