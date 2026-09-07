const IMAGES_BASE_URL = new URL('../images/', import.meta.url);

export const FLOW_ICON_LABELS = {
    flowtracker: 'Flow below FT limit',
    microboard: 'Flow at or above FT limit, below SXS limit',
    'moving-boat': 'Flow at or above SXS limit',
    'no-data': 'No flow limit data available'
};

export function flowIconName(flowItem, meta) {
    const ft = meta?.ftUpperLimit;
    const sxs = meta?.sxsUpperLimit;
    const value = (flowItem && typeof flowItem.ValueNumber === 'number') ? flowItem.ValueNumber : null;

    if (value === null || typeof ft !== 'number' || typeof sxs !== 'number') {
        return 'no-data';
    }
    if (value < ft) return 'flowtracker';
    if (value < sxs) return 'microboard';
    return 'moving-boat';
}

export function flowIconUrl(iconName) {
    return new URL(`${iconName}.svg`, IMAGES_BASE_URL).href;
}