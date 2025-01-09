/**
 * Formats a number or string number to a human-readable format
 */
export function formatNumber(value: string | number): string {
    const num = typeof value === 'string' ? Number(value) : value;
    return new Intl.NumberFormat('en-US').format(num);
} 