import type { MemberBalance, Settlement } from '@/types';
import { calculateSettlements } from '@/utils/settlement';

import { useSupabase } from './useSupabase';

export function useBalances() {
    const { supabase } = useSupabase();

    /**
     * Fetch balances from the database for a group
     */
    async function getBalances(groupId: string): Promise<MemberBalance[]> {
        try {
            const { data, error } = await supabase
                .from('member_balances')
                .select(
                    `
                    balance,
                    member:members!inner(id, name)
                `,
                )
                .eq('group_id', groupId);

            if (error) {
                console.error('Error fetching balances:', error);
                return [];
            }

            return (data || []).map((row) => {
                const member = row.member as unknown as {
                    id: string;
                    name: string;
                };
                return {
                    member_id: member.id,
                    member_name: member.name,
                    balance: Number(row.balance),
                };
            });
        } catch (error) {
            console.error('Error in getBalances:', error);
            return [];
        }
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
        getBalances,
        getSettlements,
        getBalancePercentage,
    };
}
