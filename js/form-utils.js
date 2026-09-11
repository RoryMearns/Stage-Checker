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

export async function downloadElementAsPng(reportElement, filename) {
    if (typeof html2canvas !== 'function') {
        alert('Could not generate the image - please check your internet connection and try again.');
        return;
    }

    reportElement.style.position = 'absolute';
    reportElement.style.left = '-9999px';
    reportElement.style.top = '0';
    reportElement.style.width = '480px';
    document.body.appendChild(reportElement);

    try {
        const canvas = await html2canvas(reportElement, { backgroundColor: '#F5F8F7', scale: 2 });
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Failed to generate image:', error);
        alert('Something went wrong generating the image. Please try again.');
    } finally {
        reportElement.remove();
    }
}