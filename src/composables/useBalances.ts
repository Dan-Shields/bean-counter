import type { ExpenseWithDetails, Member, MemberBalance, Settlement } from '@/types';
import { calculateSettlements } from '@/utils/settlement';

export function useBalances() {
  /**
   * Calculate balances for all members based on expenses
   */
  function calculateBalances(
    members: Member[],
    expenses: ExpenseWithDetails[]
  ): MemberBalance[] {
    const balances: Record<string, number> = {};

    // Initialize balances to 0
    members.forEach(member => {
      balances[member.id] = 0;
    });

    // Calculate balances from expenses
    expenses.forEach(expense => {
      // Payer gets credited the full amount
      balances[expense.payer_id] += expense.base_currency_amount || expense.amount;

      // Calculate each member's share
      const splits = expense.splits;
      const exactSplits = splits.filter(s => s.exact_amount !== undefined && s.exact_amount !== null);
      const partsSplits = splits.filter(s => s.exact_amount === undefined || s.exact_amount === null);

      let totalExactAmount = 0;
      exactSplits.forEach(split => {
        const amount = split.exact_amount || 0;
        totalExactAmount += amount;
        balances[split.member_id] -= amount;
      });

      // Remaining amount is split by parts
      const remainingAmount = (expense.base_currency_amount || expense.amount) - totalExactAmount;
      const totalParts = partsSplits.reduce((sum, split) => sum + (split.parts || 1), 0);

      if (totalParts > 0) {
        const amountPerPart = remainingAmount / totalParts;
        partsSplits.forEach(split => {
          const parts = split.parts || 1;
          balances[split.member_id] -= amountPerPart * parts;
        });
      }
    });

    // Convert to array and round to 2 decimal places
    return members.map(member => ({
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
