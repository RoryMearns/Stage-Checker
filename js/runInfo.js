const RUN_INFO_URL = new URL('../data/run-info.json', import.meta.url);

export async function loadRunInfo() {
    const res = await fetch(RUN_INFO_URL, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to load run-info.json (${res.status})`);
    }
    return res.json();
}