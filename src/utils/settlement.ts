import type { MemberBalance, Settlement } from '@/types';

/**
 * Calculate optimal settlements to balance all debts
 * Uses a greedy algorithm to minimize the number of transactions
 */
export function calculateSettlements(balances: MemberBalance[]): Settlement[] {
    const settlements: Settlement[] = [];

    // Separate creditors (positive balance) and debtors (negative balance)
    const creditors = balances
        .filter((b) => b.balance > 0.01) // Use small threshold for floating point
        .map((b) => ({ ...b }))
        .sort((a, b) => b.balance - a.balance); // Sort descending

    const debtors = balances
        .filter((b) => b.balance < -0.01)
        .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
        .sort((a, b) => b.balance - a.balance); // Sort descending

    let i = 0; // creditor index
    let j = 0; // debtor index

    // Greedy algorithm: match largest creditor with largest debtor
    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        const amount = Math.min(creditor.balance, debtor.balance);

        if (amount > 0.01) {
            // Only create settlement if amount is significant
            settlements.push({
                from_member_id: debtor.member_id,
                from_member_name: debtor.member_name,
                to_member_id: creditor.member_id,
                to_member_name: creditor.member_name,
                amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
            });
        }

        creditor.balance -= amount;
        debtor.balance -= amount;

        // Move to next creditor/debtor if balance is settled
        if (creditor.balance < 0.01) i++;
        if (debtor.balance < 0.01) j++;
    }

    return settlements;
}
