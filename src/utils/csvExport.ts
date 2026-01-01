import type { Member, TransactionWithDetails } from '@/types';

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
 * Calculates the split amount for each member in a transaction.
 * Returns a map of member_id -> amount in the base currency.
 */
function calculateSplitAmounts(
    transaction: TransactionWithDetails,
): Map<string, number> {
    const amounts = new Map<string, number>();
    const baseAmount = transaction.base_currency_amount ?? transaction.amount;

    // Check if using exact amounts or parts
    const hasExactAmounts = transaction.splits.some(
        (s) => s.exact_amount != null,
    );

    if (hasExactAmounts) {
        // Exact amount mode - convert to base currency proportionally
        const totalExact = transaction.splits.reduce(
            (sum, s) => sum + (s.exact_amount ?? 0),
            0,
        );
        const conversionRate = totalExact > 0 ? baseAmount / totalExact : 1;

        for (const split of transaction.splits) {
            const exactAmount = split.exact_amount ?? 0;
            const convertedAmount = exactAmount * conversionRate;
            amounts.set(
                split.member_id,
                Math.round(convertedAmount * 100) / 100,
            );
        }
    } else {
        // Parts mode - calculate proportional amounts from base currency
        const totalParts = transaction.splits.reduce(
            (sum, s) => sum + (s.parts ?? 1),
            0,
        );

        for (const split of transaction.splits) {
            const parts = split.parts ?? 1;
            const amount = (baseAmount * parts) / totalParts;
            // Round to 2 decimal places
            amounts.set(split.member_id, Math.round(amount * 100) / 100);
        }
    }

    return amounts;
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
