import type { GroupStats, MemberStats } from '@/utils/stats';

import { useSupabase } from './useSupabase';

const EMPTY_STATS: GroupStats = {
    totalExpenses: 0,
    totalRefunds: 0,
    netExpenses: 0,
    expenseCount: 0,
    members: [],
};

export function useStats() {
    const { supabase } = useSupabase();

    /**
     * Fetch pre-computed expense stats for a group.
     * Stats are maintained server-side by database triggers.
     */
    async function getStats(groupId: string): Promise<GroupStats> {
        try {
            const [memberRes, groupRes] = await Promise.all([
                supabase
                    .from('member_stats')
                    .select('paid, share, member:members!inner(id, name)')
                    .eq('group_id', groupId),
                supabase
                    .from('group_stats')
                    .select('total_expenses, total_refunds, expense_count')
                    .eq('group_id', groupId)
                    .maybeSingle(),
            ]);

            if (memberRes.error) {
                console.error('Error fetching member stats:', memberRes.error);
                return { ...EMPTY_STATS };
            }
            if (groupRes.error) {
                console.error('Error fetching group stats:', groupRes.error);
            }

            const members: MemberStats[] = (memberRes.data || [])
                .map((row) => {
                    const member = row.member as unknown as {
                        id: string;
                        name: string;
                    };
                    return {
                        member_id: member.id,
                        member_name: member.name,
                        paid: Number(row.paid),
                        share: Number(row.share),
                    };
                })
                .sort((a, b) => b.paid - a.paid);

            const totals = groupRes.data;
            const totalExpenses = totals ? Number(totals.total_expenses) : 0;
            const totalRefunds = totals ? Number(totals.total_refunds) : 0;

            return {
                totalExpenses,
                totalRefunds,
                netExpenses:
                    Math.round((totalExpenses - totalRefunds) * 100) / 100,
                expenseCount: totals ? Number(totals.expense_count) : 0,
                members,
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            return { ...EMPTY_STATS };
        }
    }

    return {
        getStats,
    };
}
