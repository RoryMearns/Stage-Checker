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

function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

export async function downloadElementAsPng(reportElement, filename) {
    try {
        const canvas = await renderElementToCanvas(reportElement);
        downloadCanvas(canvas, filename);
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

        downloadCanvas(combined, filename);
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

// Encodes a plain object into a compact, URL-safe code: JSON -> gzip (if supported) -> base64url.
// A leading 'g' or 'u' flag records whether gzip was actually used, so decoding always works
// even if the browser that generated the link supported compression and the one opening it doesn't.
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