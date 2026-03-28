/** Matches web: product `id` is stored as e.g. fk73; display as FK73 (no AB prefix). */
export function formatProductId(id) {
    if (id == null || id === '') return '';
    return String(id).toUpperCase();
}
