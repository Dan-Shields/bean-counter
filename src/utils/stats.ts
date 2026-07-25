import type { TransactionWithDetails } from '@/types';

/**
 * Rounds a monetary value to 2 decimal places.
 */
function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Calculates the split amount for each member in a transaction.
 * Returns a map of member_id -> amount in the base (group) currency.
 *
 * The amount represents each member's share of the transaction, regardless
 * of transaction type (expense/income). Callers apply sign based on type.
 */
export function calculateSplitAmounts(
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
            amounts.set(split.member_id, round2(exactAmount * conversionRate));
        }
    } else {
        // Parts mode - calculate proportional amounts from base currency
        const totalParts = transaction.splits.reduce(
            (sum, s) => sum + (s.parts ?? 1),
            0,
        );

        for (const split of transaction.splits) {
            const parts = split.parts ?? 1;
            const amount =
                totalParts > 0 ? (baseAmount * parts) / totalParts : 0;
            amounts.set(split.member_id, round2(amount));
        }
    }

    return amounts;
}

/**
 * Expense statistics for a single member, in the group's base currency.
 */
export interface MemberStats {
    member_id: string;
    member_name: string;
    /**
     * The member's share of the group's net expenses - i.e. how much of the
     * shared spending they are responsible for (their split of expenses minus
     * their split of any refunds/income). Reimbursements are ignored.
     */
    share: number;
    /**
     * How much the member has physically paid out toward group expenses -
     * what should be reflected on their bank/card statement. This is the
     * amount they fronted as payer of expenses, minus any income they
     * received on the group's behalf. Reimbursements are ignored.
     */
    paid: number;
}

/**
 * Aggregate expense statistics for a group, in the group's base currency.
 *
 * These are computed server-side by database triggers (see the
 * `member_stats` / `group_stats` tables) and fetched via `useStats`. Only
 * `expense` and `income` transactions contribute; intra-group `repayment`
 * transactions are ignored, since they just move money between members
 * without changing what the group spent.
 */
export interface GroupStats {
    /** Sum of all expenses (before refunds). */
    totalExpenses: number;
    /** Sum of all income/refunds received by the group. */
    totalRefunds: number;
    /** Net expenses: total expenses minus refunds. */
    netExpenses: number;
    /** Number of expense transactions counted. */
    expenseCount: number;
    /** Per-member breakdown. */
    members: MemberStats[];
}
