/**
 * Centralized date formatter for the entire mobile app.
 * Output format: dd-MonthName-yyyy  e.g.  08-May-2026
 *
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Full date: 08-May-2026
 */
export function formatDate(dateInput) {
    if (!dateInput) return '-';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd}-${month}-${yyyy}`;
}

/**
 * Short date (day + short month): 08-May
 */
export function formatDateShort(dateInput) {
    if (!dateInput) return '-';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const month = MONTH_SHORT[d.getMonth()];
    return `${dd}-${month}`;
}

/**
 * Month + Year only: May-2026
 */
export function formatMonthYear(dateInput) {
    if (!dateInput) return '-';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const month = MONTH_NAMES[d.getMonth()];
    return `${month}-${d.getFullYear()}`;
}
