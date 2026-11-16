const GOOD_PERCENT = 400;
const WARN_PERCENT = 150;

export function minFlowStatus(flow, minFlow) {
    if (typeof flow !== 'number' || typeof minFlow !== 'number' || !(minFlow > 0)) return null;

    const percent = (flow / minFlow) * 100;
    const level = percent >= GOOD_PERCENT ? 'good' : percent >= WARN_PERCENT ? 'warn' : 'low';

    return {
        level,
        text: `${Math.round(percent)}%`
    };
}

export function minFlowNoteHtml(flowItem, meta) {
    const hasFlow = flowItem && typeof flowItem.ValueNumber === 'number';
    const status = hasFlow ? minFlowStatus(flowItem.ValueNumber, meta?.minFlow) : null;
    return status ? `<div class="min-flow-note min-flow-${status.level}">${status.text}</div>` : '';
}