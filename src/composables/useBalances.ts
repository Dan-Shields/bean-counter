import type {
    Member,
    MemberBalance,
    Settlement,
    TransactionWithDetails,
} from '@/types';
import { calculateSettlements } from '@/utils/settlement';

export function useBalances() {
    /**
     * Calculate balances for all members based on transactions
     */
    function calculateBalances(
        members: Member[],
        transactions: TransactionWithDetails[],
    ): MemberBalance[] {
        const balances: Record<string, number> = {};

        // Initialize balances to 0
        members.forEach((member) => {
            balances[member.id] = 0;
        });

        // Calculate balances from transactions
        transactions.forEach((transaction) => {
            const amount =
                transaction.base_currency_amount || transaction.amount;
            const type = transaction.type || 'expense'; // Default for legacy data

            // For expense/repayment: payer gets credited (+)
            // For income: receiver gets debited (-) - they received money and owe it to the group
            const payerMultiplier = type === 'income' ? -1 : 1;
            balances[transaction.payer_id] += amount * payerMultiplier;

            // Calculate each member's share
            const splits = transaction.splits;
            const exactSplits = splits.filter(
                (s) => s.exact_amount !== undefined && s.exact_amount !== null,
            );
            const partsSplits = splits.filter(
                (s) => s.exact_amount === undefined || s.exact_amount === null,
            );

            // For expense/repayment: split members get debited (-)
            // For income: split members get credited (+) - they're owed their share of the refund
            const splitMultiplier = type === 'income' ? 1 : -1;

            let totalExactAmount = 0;
            exactSplits.forEach((split) => {
                const splitAmount = split.exact_amount || 0;
                totalExactAmount += splitAmount;
                balances[split.member_id] += splitAmount * splitMultiplier;
            });

            // Remaining amount is split by parts
            const remainingAmount = amount - totalExactAmount;
            const totalParts = partsSplits.reduce(
                (sum, split) => sum + (split.parts || 1),
                0,
            );

            if (totalParts > 0) {
                const amountPerPart = remainingAmount / totalParts;
                partsSplits.forEach((split) => {
                    const parts = split.parts || 1;
                    balances[split.member_id] +=
                        amountPerPart * parts * splitMultiplier;
                });
            }
        });

        // Convert to array and round to 2 decimal places
        return members.map((member) => ({
            member_id: member.id,
            member_name: member.name,
            balance: Math.round(balances[member.id] * 100) / 100,
        }));
    }

    /**
     * Get optimal settlements to balance all debts
     */
    function getSettlements(balances: MemberBalance[]): Settlement[] {
        return calculateSettlements(balances);
    }

    /**
     * Get balance percentage for visualization (-100 to 100)
     * Scaled relative to the max absolute balance in the group
     */
    function getBalancePercentage(balance: number, maxBalance: number): number {
        if (maxBalance === 0) return 0;
        return Math.round((balance / maxBalance) * 100);
    }

    return {
        calculateBalances,
        getSettlements,
        getBalancePercentage,
    };
}
