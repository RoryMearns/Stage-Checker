const state = {
    collapsed: new Set()
};

const listeners = new Set();

function notify() {
    listeners.forEach(listener => listener(state));
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function isCollapsed(id) {
    return state.collapsed.has(id);
}

export function toggleCollapsed(id) {
    if (state.collapsed.has(id)) {
        state.collapsed.delete(id);
    } else {
        state.collapsed.add(id);
    }
    notify();
}

export function collapseAll(ids) {
    ids.forEach(id => state.collapsed.add(id));
    notify();
}

export function expandAll(ids) {
    ids.forEach(id => state.collapsed.delete(id));
    notify();
}

export function areAllCollapsed(ids) {
    return ids.length > 0 && ids.every(id => state.collapsed.has(id));
}
