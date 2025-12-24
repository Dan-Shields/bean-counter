<template>
  <div>
    <ion-segment v-model="filter" class="filter-segment">
      <ion-segment-button value="all">
        <ion-label>All</ion-label>
      </ion-segment-button>
      <ion-segment-button value="mine">
        <ion-label>Mine</ion-label>
      </ion-segment-button>
    </ion-segment>

    <ion-list v-if="filteredExpenses.length > 0">
      <ion-item-sliding v-for="expense in filteredExpenses" :key="expense.id">
        <ion-item button @click="$emit('edit', expense.id)">
          <ion-label>
            <h2>{{ expense.title }}</h2>
            <p>
              {{ formatDate(expense.date) }} &middot;
              Paid by {{ expense.payer.name }}
            </p>
          </ion-label>
          <ion-note slot="end" class="amount">
            {{ formatAmount(expense.amount, expense.currency) }}
          </ion-note>
        </ion-item>

        <ion-item-options side="end">
          <ion-item-option color="danger" @click="$emit('delete', expense.id)">
            <ion-icon :icon="trashOutline" slot="icon-only"></ion-icon>
          </ion-item-option>
        </ion-item-options>
      </ion-item-sliding>
    </ion-list>

    <div v-else class="empty-state">
      <ion-icon :icon="receiptOutline" class="empty-icon"></ion-icon>
      <h2>No expenses yet</h2>
      <p>Tap the + button to add your first expense</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonNote,
  IonIcon,
  IonSegment,
  IonSegmentButton,
} from '@ionic/vue';
import { trashOutline, receiptOutline } from 'ionicons/icons';
import { formatCurrency } from '@/utils/currency';
import type { ExpenseWithDetails, Member } from '@/types';

const props = defineProps<{
  expenses: ExpenseWithDetails[];
  members: Member[];
  currentMemberId: string | null;
  groupCurrency: string;
}>();

defineEmits<{
  edit: [expenseId: string];
  delete: [expenseId: string];
}>();

const filter = ref('all');

const filteredExpenses = computed(() => {
  if (filter.value === 'mine' && props.currentMemberId) {
    return props.expenses.filter((expense) => {
      // Include if user paid or is in splits
      if (expense.payer_id === props.currentMemberId) return true;
      return expense.splits.some((s) => s.member_id === props.currentMemberId);
    });
  }
  return props.expenses;
});

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatAmount(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}
</script>

<style scoped>
.filter-segment {
  margin: 8px 16px;
}

.amount {
  font-weight: 600;
  font-size: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--ion-text-color);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
