import type { Member, TransactionWithDetails } from '@/types';
import { calculateSplitAmounts } from '@/utils/stats';

/**
 * Escapes a value for CSV format.
 * Wraps in quotes if contains comma, quote, or newline.
 */
function escapeCSV(value: string | number): string {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Generates a CSV string from transactions with dynamic member columns.
 */
export function generateTransactionCSV(
    transactions: TransactionWithDetails[],
    members: Member[],
    groupCurrency: string,
): string {
    // Fixed columns
    const fixedHeaders = [
        'Date',
        'Type',
        'Title',
        'Amount',
        'Currency',
        `Amount (${groupCurrency})`,
        'Payer',
    ];

    // Dynamic member columns - sorted by name for consistency
    const sortedMembers = [...members].sort((a, b) =>
        a.name.localeCompare(b.name),
    );
    const memberHeaders = sortedMembers.map((m) => m.name);

    // Build header row
    const headers = [...fixedHeaders, ...memberHeaders];
    const rows: string[] = [headers.map(escapeCSV).join(',')];

    // Build data rows
    for (const transaction of transactions) {
        const splitAmounts = calculateSplitAmounts(transaction);

        const baseCurrencyAmount =
            transaction.base_currency_amount ?? transaction.amount;

        const fixedValues = [
            transaction.date,
            transaction.type,
            transaction.title,
            transaction.amount.toFixed(2),
            transaction.currency,
            baseCurrencyAmount.toFixed(2),
            transaction.payer.name,
        ];

        // Member split amounts (0 if not involved)
        const memberValues = sortedMembers.map((member) => {
            const amount = splitAmounts.get(member.id) ?? 0;
            return amount.toFixed(2);
        });

        const row = [...fixedValues, ...memberValues];
        rows.push(row.map(escapeCSV).join(','));
    }

    return rows.join('\n');
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
