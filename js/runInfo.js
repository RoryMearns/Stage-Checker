const RUN_INFO_DIR = new URL('../data/', import.meta.url);

export async function loadRunInfo(fileName = 'run-info.json') {
    const url = new URL(fileName, RUN_INFO_DIR);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to load ${fileName} (${res.status})`);
    }
    return res.json();
}