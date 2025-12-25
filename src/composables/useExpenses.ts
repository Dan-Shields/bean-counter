import { ref } from 'vue';
import { useSupabase } from './useSupabase';
import { convertCurrency } from '@/utils/currency';
import type { Expense, ExpenseSplit, ExpenseWithDetails, ExpenseFormData } from '@/types';

export function useExpenses() {
  const { supabase } = useSupabase();

  /**
   * Get all expenses for a group
   */
  async function getExpenses(groupId: string): Promise<ExpenseWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          payer:members!expenses_payer_id_fkey(*),
          splits:expense_splits(
            *,
            member:members(*)
          )
        `)
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching expenses:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getExpenses:', error);
      return [];
    }
  }

  /**
   * Get a single expense by ID
   */
  async function getExpense(expenseId: string): Promise<ExpenseWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          payer:members!expenses_payer_id_fkey(*),
          splits:expense_splits(
            *,
            member:members(*)
          )
        `)
        .eq('id', expenseId)
        .single();

      if (error) {
        console.error('Error fetching expense:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getExpense:', error);
      return null;
    }
  }

  /**
   * Create a new expense
   */
  async function createExpense(
    groupId: string,
    formData: ExpenseFormData,
    baseCurrency: string
  ): Promise<Expense | null> {
    try {
      // Convert to base currency if needed
      let baseCurrencyAmount = formData.amount;
      if (formData.currency !== baseCurrency) {
        baseCurrencyAmount = await convertCurrency(
          formData.amount,
          formData.currency,
          baseCurrency
        );
      }

      // Create expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
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

      if (expenseError || !expense) {
        console.error('Error creating expense:', expenseError);
        return null;
      }

      // Create splits
      const splitsToInsert = formData.splits
        .filter(s => s.enabled)
        .map(s => ({
          expense_id: expense.id,
          member_id: s.member_id,
          parts: s.exact_amount === undefined ? s.parts : undefined,
          exact_amount: s.exact_amount,
        }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) {
        console.error('Error creating splits:', splitsError);
        return null;
      }

      // Add to changelog
      await supabase.from('expense_changelog').insert({
        expense_id: expense.id,
        action: 'created',
      });

      return expense;
    } catch (error) {
      console.error('Error in createExpense:', error);
      return null;
    }
  }

  /**
   * Update an existing expense
   */
  async function updateExpense(
    expenseId: string,
    formData: ExpenseFormData,
    baseCurrency: string
  ): Promise<Expense | null> {
    try {
      // Check if expense is deleted
      const existing = await getExpense(expenseId);
      if (!existing || existing.deleted_at) {
        console.error('Cannot update deleted expense');
        return null;
      }

      // Convert to base currency if needed
      let baseCurrencyAmount = formData.amount;
      if (formData.currency !== baseCurrency) {
        baseCurrencyAmount = await convertCurrency(
          formData.amount,
          formData.currency,
          baseCurrency
        );
      }

      // Update expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
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
        .eq('id', expenseId)
        .select()
        .single();

      if (expenseError || !expense) {
        console.error('Error updating expense:', expenseError);
        return null;
      }

      // Delete old splits
      await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      // Create new splits
      const splitsToInsert = formData.splits
        .filter(s => s.enabled)
        .map(s => ({
          expense_id: expense.id,
          member_id: s.member_id,
          parts: s.exact_amount === undefined ? s.parts : undefined,
          exact_amount: s.exact_amount,
        }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsToInsert);

      if (splitsError) {
        console.error('Error creating splits:', splitsError);
        return null;
      }

      // Add to changelog
      await supabase.from('expense_changelog').insert({
        expense_id: expense.id,
        action: 'updated',
      });

      return expense;
    } catch (error) {
      console.error('Error in updateExpense:', error);
      return null;
    }
  }

  /**
   * Delete an expense (soft delete)
   */
  async function deleteExpense(expenseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', expenseId);

      if (error) {
        console.error('Error deleting expense:', error);
        return false;
      }

      // Add to changelog
      await supabase.from('expense_changelog').insert({
        expense_id: expenseId,
        action: 'deleted',
      });

      return true;
    } catch (error) {
      console.error('Error in deleteExpense:', error);
      return false;
    }
  }

  /**
   * Subscribe to deleted_at changes for an expense
   */
  function subscribeToExpenseDeletes(expenseId: string, onDelete: () => void) {
    const channel = supabase
      .channel(`expense_${expenseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'expenses',
          filter: `id=eq.${expenseId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as Expense).deleted_at) {
            onDelete();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  return {
    getExpenses,
    getExpense,
    createExpense,
    updateExpense,
    deleteExpense,
    subscribeToExpenseDeletes,
  };
}
