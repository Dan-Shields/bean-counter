import { ref } from 'vue';
import type {
    Transaction,
    TransactionFormData,
    TransactionSplit,
    TransactionWithDetails,
} from '@/types';
import { convertCurrency } from '@/utils/currency';

import { useSupabase } from './useSupabase';

export function useTransactions() {
    const { supabase } = useSupabase();

    const PAGE_SIZE = 20;

    /**
     * Get transactions for a group with pagination
     */
    async function getTransactions(
        groupId: string,
        options?: {
            limit?: number;
            offset?: number;
            sortAsc?: boolean;
            memberId?: string;
        },
    ): Promise<{ transactions: TransactionWithDetails[]; hasMore: boolean }> {
        try {
            const limit = options?.limit ?? PAGE_SIZE;
            const offset = options?.offset ?? 0;
            const ascending = options?.sortAsc ?? false;
            const memberId = options?.memberId;

            let query = supabase
                .from('transactions')
                .select(
                    `
          *,
          payer:members!expenses_payer_id_fkey(*),
          splits:transaction_splits(
            *,
            member:members(*)
          )
        `,
                )
                .eq('group_id', groupId)
                .is('deleted_at', null);

            // Filter by member: payer OR in splits
            if (memberId) {
                const { data: splitData } = await supabase
                    .from('transaction_splits')
                    .select('transaction_id')
                    .eq('member_id', memberId);

                const splitTransactionIds =
                    splitData?.map((s) => s.transaction_id) || [];

                if (splitTransactionIds.length > 0) {
                    query = query.or(
                        `payer_id.eq.${memberId},id.in.(${splitTransactionIds.join(',')})`,
                    );
                } else {
                    query = query.eq('payer_id', memberId);
                }
            }

            const { data, error } = await query
                .order('date', { ascending })
                .order('created_at', { ascending })
                .range(offset, offset + limit);

            if (error) {
                console.error('Error fetching transactions:', error);
                return { transactions: [], hasMore: false };
            }

            const transactions = data || [];
            // If we got more than limit, there are more to load
            const hasMore = transactions.length > limit;

            return {
                transactions: hasMore
                    ? transactions.slice(0, limit)
                    : transactions,
                hasMore,
            };
        } catch (error) {
            console.error('Error in getTransactions:', error);
            return { transactions: [], hasMore: false };
        }
    }

    /**
     * Get all transactions for a group (no pagination, for export)
     */
    async function getAllTransactions(
        groupId: string,
        options?: { sortAsc?: boolean },
    ): Promise<TransactionWithDetails[]> {
        try {
            const ascending = options?.sortAsc ?? false;

            const { data, error } = await supabase
                .from('transactions')
                .select(
                    `
          *,
          payer:members!expenses_payer_id_fkey(*),
          splits:transaction_splits(
            *,
            member:members(*)
          )
        `,
                )
                .eq('group_id', groupId)
                .is('deleted_at', null)
                .order('date', { ascending })
                .order('created_at', { ascending });

            if (error) {
                console.error('Error fetching all transactions:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getAllTransactions:', error);
            return [];
        }
    }

    /**
     * Get a single transaction by ID
     */
    async function getTransaction(
        transactionId: string,
    ): Promise<TransactionWithDetails | null> {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select(
                    `
          *,
          payer:members!expenses_payer_id_fkey(*),
          splits:transaction_splits(
            *,
            member:members(*)
          )
        `,
                )
                .eq('id', transactionId)
                .single();

            if (error) {
                console.error('Error fetching transaction:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getTransaction:', error);
            return null;
        }
    }

    /**
     * Create a new transaction
     */
    async function createTransaction(
        groupId: string,
        formData: TransactionFormData,
        baseCurrency: string,
    ): Promise<Transaction | null> {
        try {
            // Convert to base currency if needed
            let baseCurrencyAmount = formData.amount;
            if (formData.currency !== baseCurrency) {
                baseCurrencyAmount = await convertCurrency(
                    formData.amount,
                    formData.currency,
                    baseCurrency,
                );
            }

            // Create transaction
            const { data: transaction, error: transactionError } =
                await supabase
                    .from('transactions')
                    .insert({
                        group_id: groupId,
                        type: formData.type,
                        title: formData.title,
                        date: formData.date,
                        category: formData.category,
                        amount: formData.amount,
                        currency: formData.currency,
                        base_currency_amount: baseCurrencyAmount,
                        payer_id: formData.payer_id,
                    })
                    .select()
                    .single();

            if (transactionError || !transaction) {
                console.error('Error creating transaction:', transactionError);
                return null;
            }

            // Create splits
            const splitsToInsert = formData.splits
                .filter((s) => s.enabled)
                .map((s) => ({
                    transaction_id: transaction.id,
                    member_id: s.member_id,
                    parts: s.exact_amount === undefined ? s.parts : undefined,
                    exact_amount: s.exact_amount,
                }));

            const { error: splitsError } = await supabase
                .from('transaction_splits')
                .insert(splitsToInsert);

            if (splitsError) {
                console.error('Error creating splits:', splitsError);
                return null;
            }

            // Add to changelog
            await supabase.from('transaction_changelog').insert({
                transaction_id: transaction.id,
                action: 'created',
            });

            return transaction;
        } catch (error) {
            console.error('Error in createTransaction:', error);
            return null;
        }
    }

    /**
     * Update an existing transaction
     */
    async function updateTransaction(
        transactionId: string,
        formData: TransactionFormData,
        baseCurrency: string,
    ): Promise<Transaction | null> {
        try {
            // Check if transaction is deleted
            const existing = await getTransaction(transactionId);
            if (!existing || existing.deleted_at) {
                console.error('Cannot update deleted transaction');
                return null;
            }

            // Convert to base currency if needed
            let baseCurrencyAmount = formData.amount;
            if (formData.currency !== baseCurrency) {
                baseCurrencyAmount = await convertCurrency(
                    formData.amount,
                    formData.currency,
                    baseCurrency,
                );
            }

            // Update transaction
            const { data: transaction, error: transactionError } =
                await supabase
                    .from('transactions')
                    .update({
                        type: formData.type,
                        title: formData.title,
                        date: formData.date,
                        category: formData.category,
                        amount: formData.amount,
                        currency: formData.currency,
                        base_currency_amount: baseCurrencyAmount,
                        payer_id: formData.payer_id,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', transactionId)
                    .select()
                    .single();

            if (transactionError || !transaction) {
                console.error('Error updating transaction:', transactionError);
                return null;
            }

            // Delete old splits
            await supabase
                .from('transaction_splits')
                .delete()
                .eq('transaction_id', transactionId);

            // Create new splits
            const splitsToInsert = formData.splits
                .filter((s) => s.enabled)
                .map((s) => ({
                    transaction_id: transaction.id,
                    member_id: s.member_id,
                    parts: s.exact_amount === undefined ? s.parts : undefined,
                    exact_amount: s.exact_amount,
                }));

            const { error: splitsError } = await supabase
                .from('transaction_splits')
                .insert(splitsToInsert);

            if (splitsError) {
                console.error('Error creating splits:', splitsError);
                return null;
            }

            // Add to changelog
            await supabase.from('transaction_changelog').insert({
                transaction_id: transaction.id,
                action: 'updated',
            });

            return transaction;
        } catch (error) {
            console.error('Error in updateTransaction:', error);
            return null;
        }
    }

    /**
     * Delete a transaction (soft delete)
     */
    async function deleteTransaction(transactionId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('transactions')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', transactionId);

            if (error) {
                console.error('Error deleting transaction:', error);
                return false;
            }

            // Add to changelog
            await supabase.from('transaction_changelog').insert({
                transaction_id: transactionId,
                action: 'deleted',
            });

            return true;
        } catch (error) {
            console.error('Error in deleteTransaction:', error);
            return false;
        }
    }

    /**
     * Subscribe to deleted_at changes for a transaction
     */
    function subscribeToTransactionDeletes(
        transactionId: string,
        onDelete: () => void,
    ) {
        const channel = supabase
            .channel(`transaction_${transactionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'transactions',
                    filter: `id=eq.${transactionId}`,
                },
                (payload) => {
                    if (
                        payload.new &&
                        (payload.new as Transaction).deleted_at
                    ) {
                        onDelete();
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    /**
     * Subscribe to all transaction changes for a group
     * Calls onChange when any transaction in the group is inserted, updated, or deleted
     */
    function subscribeToGroupTransactions(
        groupId: string,
        onChange: () => void,
    ) {
        const channel = supabase
            .channel(`group_transactions_${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                    filter: `group_id=eq.${groupId}`,
                },
                () => {
                    onChange();
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }

    return {
        getTransactions,
        getAllTransactions,
        getTransaction,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        subscribeToTransactionDeletes,
        subscribeToGroupTransactions,
    };
}
