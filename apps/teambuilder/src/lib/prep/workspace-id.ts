const KEY = "pokemcp-prep-workspace-id";

export function getWorkspaceId() {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
}
