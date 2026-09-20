export function todayIsoDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function formatDateForDisplay(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${monthNames[monthIndex]} ${year}`;
}

export function sanitizeForFilename(text) {
    return text.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
}

export async function renderElementToCanvas(reportElement) {
    if (typeof html2canvas !== 'function') {
        throw new Error('html2canvas is not available - check your internet connection.');
    }

    reportElement.style.position = 'absolute';
    reportElement.style.left = '-9999px';
    reportElement.style.top = '0';
    reportElement.style.width = '480px';
    document.body.appendChild(reportElement);

    try {
        return await html2canvas(reportElement, { backgroundColor: '#F5F8F7', scale: 2 });
    } finally {
        reportElement.remove();
    }
}

async function saveCanvasAsPng(canvas, filename) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    if (navigator.canShare && navigator.share) {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file] });
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Share failed, falling back to direct download:', error);
            }
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadElementAsPng(reportElement, filename) {
    try {
        const canvas = await renderElementToCanvas(reportElement);
        await saveCanvasAsPng(canvas, filename);
    } catch (error) {
        console.error('Failed to generate image:', error);
        alert('Something went wrong generating the image. Please try again.');
    }
}

export async function downloadElementsSideBySide(reportElements, filename, gap = 32) {
    try {
        const canvases = [];
        for (const element of reportElements) {
            canvases.push(await renderElementToCanvas(element));
        }

        const totalWidth = canvases.reduce((sum, c) => sum + c.width, 0) + gap * (canvases.length - 1);
        const maxHeight = Math.max(...canvases.map(c => c.height));

        const combined = document.createElement('canvas');
        combined.width = totalWidth;
        combined.height = maxHeight;
        const ctx = combined.getContext('2d');
        ctx.fillStyle = '#F5F8F7';
        ctx.fillRect(0, 0, totalWidth, maxHeight);

        let x = 0;
        canvases.forEach(canvas => {
            ctx.drawImage(canvas, x, 0);
            x += canvas.width + gap;
        });

        await saveCanvasAsPng(combined, filename);
    } catch (error) {
        console.error('Failed to generate combined image:', error);
        alert('Something went wrong generating the image. Please try again.');
    }
}

function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export async function encodeStateToCode(state) {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);

    if (typeof CompressionStream === 'function') {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
        return 'g' + bytesToBase64Url(compressed);
    }

    return 'u' + bytesToBase64Url(bytes);
}

export async function decodeCodeToState(code) {
    const flag = code.charAt(0);
    const bytes = base64UrlToBytes(code.slice(1));

    let finalBytes = bytes;
    if (flag === 'g') {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('This link needs a browser that supports decompression.');
        }
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(bytes);
        writer.close();
        finalBytes = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    }

    const json = new TextDecoder().decode(finalBytes);
    return JSON.parse(json);
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Clipboard copy failed:', error);
        return false;
    }
}

const DRAFT_PREFIX = 'shag-draft:';

export function saveDraft(key, state) {
    try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(state));
    } catch (error) {
        console.error('Failed to save draft:', error);
    }
}

export function loadDraft(key) {
    try {
        const raw = localStorage.getItem(DRAFT_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Failed to load draft:', error);
        return null;
    }
}

export function clearDraft(key) {
    try {
        localStorage.removeItem(DRAFT_PREFIX + key);
    } catch (error) {
        console.error('Failed to clear draft:', error);
    }
}

export function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

export const FLOW_DIFF_GOOD_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
export const FLOW_DIFF_WARNING_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>';

export function computeFlowDifferencePercent(ratedValue, measuredValue) {
    const rated = parseFloat(ratedValue);
    const measured = parseFloat(measuredValue);
    if (isNaN(rated) || isNaN(measured) || rated === 0) return null;
    const raw = Math.abs((measured - rated) / rated) * 100;
    return Math.round(raw * 10) / 10;
}

export function flowDifferenceDirectionWord(ratedValue, measuredValue) {
    const rated = parseFloat(ratedValue);
    const measured = parseFloat(measuredValue);
    if (measured > rated) return 'above';
    if (measured < rated) return 'below';
    return 'equal to';
}

export function updateFlowDifferenceDisplay(displayEl, ratedValue, measuredValue, goodThreshold = 8.0) {
    const pct = computeFlowDifferencePercent(ratedValue, measuredValue);
    if (pct === null) {
        displayEl.style.display = 'none';
        return;
    }
    const isGood = pct <= goodThreshold;
    const direction = flowDifferenceDirectionWord(ratedValue, measuredValue);
    displayEl.innerHTML = `${isGood ? FLOW_DIFF_GOOD_ICON : FLOW_DIFF_WARNING_ICON}<span>Unprocessed gauging is ${pct.toFixed(1)}% ${direction} the rated flow</span>`;
    displayEl.classList.toggle('flow-diff-good', isGood);
    displayEl.classList.toggle('flow-diff-warning', !isGood);
    displayEl.style.display = '';
}

export function buildFlowDifferenceHtml(ratedValue, measuredValue, goodThreshold = 8.0) {
    const pct = computeFlowDifferencePercent(ratedValue, measuredValue);
    if (pct === null) return '';
    const isGood = pct <= goodThreshold;
    const stateClass = isGood ? 'flow-diff-good' : 'flow-diff-warning';
    const icon = isGood ? FLOW_DIFF_GOOD_ICON : FLOW_DIFF_WARNING_ICON;
    const direction = flowDifferenceDirectionWord(ratedValue, measuredValue);
    return `<div class="flow-diff ${stateClass}">${icon}<span>Unprocessed gauging is ${pct.toFixed(1)}% ${direction} the rated flow</span></div>`;
}

export function nzUtcOffset() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        timeZoneName: 'short'
    }).formatToParts(new Date());
    const tz = parts.find(p => p.type === 'timeZoneName')?.value;
    return tz === 'NZDT' ? '+13:00' : '+12:00';
}

export function todayIsoNz() {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    return `${partMap.year}-${partMap.month}-${partMap.day}`;
}

export function formatNzTime(date) {
    const parts = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });
    let hours = parseInt(partMap.hour, 10);
    if (hours === 24) hours = 0;
    return `${String(hours).padStart(2, '0')}:${partMap.minute}`;
}

export function parseApiTimeAsNzLocal(rawTimeString) {
    if (!rawTimeString) return null;
    const stripped = String(rawTimeString).replace(/Z$/, '');
    const date = new Date(`${stripped}${nzUtcOffset()}`);
    return isNaN(date.getTime()) ? null : date;
}

export function roundToNearestFiveMinutes(hours, minutes) {
    let roundedHours = ((hours % 24) + 24) % 24;
    let roundedMinutes = Math.round(minutes / 5) * 5;
    if (roundedMinutes === 60) {
        roundedMinutes = 0;
        roundedHours = (roundedHours + 1) % 24;
    }
    return `${String(roundedHours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`;
}

export function subtractMinutesFromTimeString(timeStr, minutesToSubtract) {
    const [h, m] = timeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m - minutesToSubtract;
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}