<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/group/${groupId}`"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="isEditing" color="danger" @click="confirmDelete">
            <ion-icon :icon="trashOutline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button :disabled="!isValid || isSaving" @click="saveExpense">
            <span v-if="isSaving">Saving...</span>
            <span v-else>Save</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isDeleted" class="deleted-notice">
        <ion-icon :icon="alertCircleOutline"></ion-icon>
        <p>This expense was deleted by someone else.</p>
        <ion-button :router-link="`/group/${groupId}`">Go Back</ion-button>
      </div>

      <div v-else-if="isLoading" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <ion-list v-else>
        <ion-segment v-model="form.type" class="type-segment">
          <ion-segment-button value="expense">
            <ion-label>Expense</ion-label>
          </ion-segment-button>
          <ion-segment-button value="repayment">
            <ion-label>Repayment</ion-label>
          </ion-segment-button>
          <ion-segment-button value="income">
            <ion-label>Income</ion-label>
          </ion-segment-button>
        </ion-segment>

        <ion-item>
          <ion-input
            v-model="form.title"
            :label="form.type === 'repayment' ? 'Note (optional)' : 'Title'"
            label-placement="stacked"
            :placeholder="titlePlaceholder"
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-input
            :value="getAmountDisplay()"
            @ionFocus="() => setEditingAmount(true)"
            @ionBlur="() => setEditingAmount(false)"
            @ionInput="(e: CustomEvent) => updateAmount(e.detail.value)"
            :label="form.type === 'repayment' ? 'Amount' : 'Amount (optional)'"
            label-placement="stacked"
            type="text"
            inputmode="decimal"
            :placeholder="totalExactAmount > 0 ? formatCurrency(totalExactAmount, form.currency) : formatCurrency(0, form.currency)"
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-select
            v-model="form.currency"
            label="Currency"
            label-placement="stacked"
            interface="action-sheet"
          >
            <ion-select-option value="EUR">EUR</ion-select-option>
            <ion-select-option value="USD">USD</ion-select-option>
            <ion-select-option value="GBP">GBP</ion-select-option>
            <ion-select-option value="DKK">DKK</ion-select-option>
            <ion-select-option value="SEK">SEK</ion-select-option>
            <ion-select-option value="NOK">NOK</ion-select-option>
            <ion-select-option value="CHF">CHF</ion-select-option>
            <ion-select-option value="JPY">JPY</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item button @click="openDatePicker">
          <ion-label>
            <p>Date</p>
            <h2>{{ formatDate(form.date) }}</h2>
          </ion-label>
        </ion-item>

        <ion-item>
          <ion-input
            v-model="form.category"
            label="Category (optional)"
            label-placement="stacked"
            placeholder="e.g., Food, Transport, Accommodation"
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-select
            v-model="form.payer_id"
            :label="payerLabel"
            label-placement="stacked"
            interface="action-sheet"
          >
            <ion-select-option
              v-for="member in members"
              :key="member.id"
              :value="member.id"
            >
              {{ member.name }}{{ member.id === currentMemberId ? ' (You)' : '' }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <!-- Recipient for repayment -->
        <ion-item v-if="form.type === 'repayment'">
          <ion-select
            v-model="repaymentRecipientId"
            label="To"
            label-placement="stacked"
            interface="action-sheet"
          >
            <ion-select-option
              v-for="member in members"
              :key="member.id"
              :value="member.id"
              :disabled="member.id === form.payer_id"
            >
              {{ member.name }}{{ member.id === currentMemberId ? ' (You)' : '' }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-list-header v-if="form.type !== 'repayment'">
          <ion-label>{{ form.type === 'income' ? 'Split income between' : 'Split between' }}</ion-label>
          <ion-button v-if="hasManualAmount" fill="clear" size="small" @click="toggleSplitMode">
            {{ splitMode === 'parts' ? 'Use exact amounts' : 'Use parts' }}
          </ion-button>
        </ion-list-header>

        <ion-item v-for="split in form.splits" :key="split.member_id" v-show="form.type !== 'repayment'">
          <ion-checkbox
            slot="start"
            :checked="split.enabled"
            @ionChange="(e: CustomEvent) => split.enabled = e.detail.checked"
          ></ion-checkbox>
          <ion-label>
            {{ getMemberName(split.member_id) }}<span v-if="split.member_id === currentMemberId" class="you-indicator"> (You)</span>
          </ion-label>
          <div v-if="split.enabled" class="split-inputs">
            <ion-input
              v-if="hasManualAmount"
              v-model.number="split.parts"
              type="number"
              inputmode="numeric"
              min="1"
              class="split-input parts-input"
              :class="{ hidden: splitMode === 'exact' }"
              placeholder="1"
            ></ion-input>
            <ion-input
              v-if="hasManualAmount && splitMode === 'parts'"
              :value="formatCurrency(getSplitAmount(split), form.currency)"
              readonly
              class="split-input amount-input"
            ></ion-input>
            <ion-input
              v-else
              :value="getExactAmountDisplay(split)"
              @ionFocus="() => setEditingSplit(split.member_id)"
              @ionBlur="() => clearEditingSplit()"
              @ionInput="(e: CustomEvent) => updateExactAmount(split, e.detail.value)"
              type="text"
              inputmode="decimal"
              class="split-input amount-input"
              :placeholder="hasManualAmount ? formatCurrency(remainderPerPerson, form.currency) : formatCurrency(0, form.currency)"
            ></ion-input>
          </div>
        </ion-item>

        <div v-if="form.type !== 'repayment'" class="split-summary">
          <p v-if="hasManualAmount && splitMode === 'parts'">
            Total parts: {{ totalParts }} &middot;
            Each part: {{ formatCurrency(amountPerPart, form.currency) }}
          </p>
          <p v-else-if="hasManualAmount">
            Assigned: {{ formatCurrency(totalExactAmount, form.currency) }} of {{ formatCurrency(form.amount, form.currency) }}
          </p>
          <p v-else>
            Total: {{ formatCurrency(totalExactAmount, form.currency) }}
          </p>
        </div>
      </ion-list>

      <ion-modal :is-open="showDatePicker" @didDismiss="showDatePicker = false">
        <ion-datetime
          presentation="date"
          :value="form.date"
          @ionChange="(e: CustomEvent) => { form.date = e.detail.value; showDatePicker = false; }"
        >
          <ion-buttons slot="buttons">
            <ion-button color="primary" @click="showDatePicker = false">Done</ion-button>
          </ion-buttons>
        </ion-datetime>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonButton,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonIcon,
  IonSpinner,
  IonModal,
  IonDatetime,
  IonSegment,
  IonSegmentButton,
  toastController,
  alertController,
} from '@ionic/vue';
import { alertCircleOutline, trashOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';
import { useExpenses } from '@/composables/useExpenses';
import { formatCurrency } from '@/utils/currency';
import type { Group, Member, ExpenseFormData, TransactionType } from '@/types';

const route = useRoute();
const router = useRouter();
const { getGroup, getGroupMembers, getUserMemberIdForGroup } = useGroups();
const { getExpense, createExpense, updateExpense, deleteExpense, subscribeToExpenseDeletes } = useExpenses();

const groupId = route.params.groupId as string;
const expenseId = route.params.expenseId as string | undefined;
const isEditing = computed(() => !!expenseId);

const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isDeleted = ref(false);
const showDatePicker = ref(false);
const splitMode = ref<'parts' | 'exact'>('parts');
const editingAmount = ref(false);
const editingSplitId = ref<string | null>(null);
const currentMemberId = ref<string | null>(null);
const repaymentRecipientId = ref<string>('');

let unsubscribe: (() => void) | null = null;

const form = ref<ExpenseFormData>({
  type: 'expense',
  title: '',
  date: new Date().toISOString().split('T')[0],
  category: '',
  amount: 0,
  currency: 'EUR',
  payer_id: '',
  splits: [],
});

const pageTitle = computed(() => {
  if (isEditing.value) {
    switch (form.value.type) {
      case 'repayment': return 'Edit Repayment';
      case 'income': return 'Edit Income';
      default: return 'Edit Expense';
    }
  }
  switch (form.value.type) {
    case 'repayment': return 'New Repayment';
    case 'income': return 'New Income';
    default: return 'New Expense';
  }
});

const payerLabel = computed(() => {
  switch (form.value.type) {
    case 'repayment': return 'From';
    case 'income': return 'Received by';
    default: return 'Paid by';
  }
});

const titlePlaceholder = computed(() => {
  switch (form.value.type) {
    case 'repayment': return 'e.g., Settling up';
    case 'income': return 'e.g., Refund, Deposit return';
    default: return 'e.g., Dinner, Groceries, Taxi';
  }
});

const hasManualAmount = computed(() => form.value.amount > 0);

const enabledSplits = computed(() => form.value.splits.filter((s) => s.enabled));

const totalExactAmount = computed(() => {
  return enabledSplits.value
    .filter((s) => s.exact_amount !== undefined && s.exact_amount !== null)
    .reduce((sum, s) => sum + (s.exact_amount || 0), 0);
});

const effectiveAmount = computed(() => {
  return hasManualAmount.value ? form.value.amount : totalExactAmount.value;
});

const isValid = computed(() => {
  const hasTitle = form.value.type === 'repayment' || form.value.title.trim() !== '';
  const hasAmount = form.value.type === 'repayment' ? form.value.amount > 0 : effectiveAmount.value > 0;
  const hasPayer = form.value.payer_id !== '';

  if (form.value.type === 'repayment') {
    // For repayment: need payer, recipient, and amount
    return hasTitle && hasAmount && hasPayer && repaymentRecipientId.value !== '' && repaymentRecipientId.value !== form.value.payer_id;
  }
  // For expense/income: need title, amount, payer, and at least one split
  return hasTitle && hasAmount && hasPayer && form.value.splits.some((s) => s.enabled);
});

const totalParts = computed(() => {
  return enabledSplits.value.reduce((sum, s) => sum + (s.parts || 1), 0);
});

const amountPerPart = computed(() => {
  if (totalParts.value === 0) return 0;
  return form.value.amount / totalParts.value;
});

const remainingAmount = computed(() => {
  return Math.max(0, form.value.amount - totalExactAmount.value);
});

const unassignedCount = computed(() => {
  return enabledSplits.value.filter(
    (s) => s.exact_amount === undefined || s.exact_amount === null
  ).length;
});

const remainderPerPerson = computed(() => {
  if (unassignedCount.value === 0) return 0;
  return remainingAmount.value / unassignedCount.value;
});

onMounted(async () => {
  try {
    group.value = await getGroup(groupId);
    members.value = await getGroupMembers(groupId);

    // Set default currency from group
    if (group.value) {
      form.value.currency = group.value.default_currency;
    }

    // Initialize splits for all members
    form.value.splits = members.value.map((m) => ({
      member_id: m.id,
      parts: 1,
      exact_amount: undefined,
      enabled: true,
    }));

    // Set default payer to current user
    currentMemberId.value = getUserMemberIdForGroup(groupId);
    if (currentMemberId.value) {
      form.value.payer_id = currentMemberId.value;
    } else if (members.value.length > 0) {
      form.value.payer_id = members.value[0].id;
    }

    // Load existing expense if editing
    if (expenseId) {
      const expense = await getExpense(expenseId);
      if (expense) {
        if (expense.deleted_at) {
          isDeleted.value = true;
        } else {
          form.value.type = expense.type || 'expense';
          form.value.title = expense.title;
          form.value.date = expense.date;
          form.value.category = expense.category || '';
          form.value.amount = expense.amount;
          form.value.currency = expense.currency;
          form.value.payer_id = expense.payer_id;

          // For repayment, extract the recipient from the single split
          if (form.value.type === 'repayment' && expense.splits.length > 0) {
            repaymentRecipientId.value = expense.splits[0].member_id;
          }

          // Set splits from expense
          form.value.splits = members.value.map((m) => {
            const split = expense.splits.find((s) => s.member_id === m.id);
            if (split) {
              return {
                member_id: m.id,
                parts: split.parts || 1,
                exact_amount: split.exact_amount ?? undefined,
                enabled: true,
              };
            }
            return {
              member_id: m.id,
              parts: 1,
              exact_amount: undefined,
              enabled: false,
            };
          });

          // Detect split mode
          if (expense.splits.some((s) => s.exact_amount !== null)) {
            splitMode.value = 'exact';
          }

          // Subscribe to delete events
          unsubscribe = subscribeToExpenseDeletes(expenseId, () => {
            isDeleted.value = true;
          });
        }
      }
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

function getMemberName(memberId: string): string {
  return members.value.find((m) => m.id === memberId)?.name || 'Unknown';
}

function getAmountDisplay(): string {
  if (editingAmount.value) {
    return form.value.amount > 0 ? form.value.amount.toString() : '';
  }
  if (form.value.amount > 0) {
    return formatCurrency(form.value.amount, form.value.currency);
  }
  return '';
}

function setEditingAmount(editing: boolean): void {
  editingAmount.value = editing;
}

function updateAmount(value: string | null): void {
  if (!value) {
    form.value.amount = 0;
    return;
  }
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  form.value.amount = isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function getSplitAmount(split: { parts?: number; enabled: boolean }): number {
  if (!split.enabled || totalParts.value === 0) return 0;
  const parts = split.parts || 1;
  return (parts / totalParts.value) * form.value.amount;
}

function getExactAmountDisplay(split: { member_id: string; exact_amount?: number }): string {
  // While editing, show raw number; otherwise show formatted currency
  if (editingSplitId.value === split.member_id) {
    if (split.exact_amount === undefined || split.exact_amount === null) return '';
    return split.exact_amount.toString();
  }
  if (split.exact_amount === undefined || split.exact_amount === null) return '';
  return formatCurrency(split.exact_amount, form.value.currency);
}

function setEditingSplit(memberId: string): void {
  editingSplitId.value = memberId;
}

function clearEditingSplit(): void {
  editingSplitId.value = null;
}

function updateExactAmount(split: { exact_amount?: number }, value: string | null): void {
  if (!value) {
    split.exact_amount = undefined;
    return;
  }
  // Remove currency symbols and whitespace, keep numbers and decimal
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  split.exact_amount = isNaN(parsed) ? undefined : Math.max(0, parsed);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function openDatePicker() {
  showDatePicker.value = true;
}

function toggleSplitMode() {
  splitMode.value = splitMode.value === 'parts' ? 'exact' : 'parts';

  // Reset values when switching modes
  form.value.splits.forEach((split) => {
    if (splitMode.value === 'parts') {
      split.exact_amount = undefined;
      split.parts = 1;
    } else {
      split.exact_amount = undefined;
      split.parts = undefined;
    }
  });
}

async function saveExpense() {
  if (!isValid.value || !group.value) return;

  isSaving.value = true;

  try {
    let formData: ExpenseFormData;

    if (form.value.type === 'repayment') {
      // For repayment: create a single split for the recipient
      formData = {
        ...form.value,
        title: form.value.title || 'Repayment',
        amount: form.value.amount,
        splits: [{
          member_id: repaymentRecipientId.value,
          exact_amount: form.value.amount,
          enabled: true,
        }],
      };
    } else {
      // For expense/income: use normal split logic
      formData = {
        ...form.value,
        amount: effectiveAmount.value,
        splits: form.value.splits.map((split) => {
          if (!split.enabled) {
            return { ...split };
          }

          if (hasManualAmount.value && splitMode.value === 'parts') {
            return {
              ...split,
              parts: split.parts || 1,
              exact_amount: undefined,
            };
          } else {
            return {
              ...split,
              parts: undefined,
              exact_amount: split.exact_amount,
            };
          }
        }),
      };
    }

    let success: boolean;
    if (isEditing.value && expenseId) {
      const result = await updateExpense(expenseId, formData, group.value.default_currency);
      success = result !== null;
    } else {
      const result = await createExpense(groupId, formData, group.value.default_currency);
      success = result !== null;
    }

    const typeLabel = form.value.type === 'repayment' ? 'Repayment' : form.value.type === 'income' ? 'Income' : 'Expense';
    if (success) {
      const toast = await toastController.create({
        message: isEditing.value ? `${typeLabel} updated` : `${typeLabel} created`,
        duration: 2000,
        color: 'success',
      });
      await toast.present();
      router.back();
    } else {
      throw new Error('Failed to save expense');
    }
  } catch (error) {
    console.error('Error saving expense:', error);
    const toast = await toastController.create({
      message: 'Failed to save expense. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isSaving.value = false;
  }
}

async function confirmDelete() {
  if (!expenseId) return;

  const alert = await alertController.create({
    header: 'Delete Expense',
    message: 'Are you sure you want to delete this expense? This cannot be undone.',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          const success = await deleteExpense(expenseId);
          if (success) {
            const toast = await toastController.create({
              message: 'Expense deleted',
              duration: 2000,
            });
            await toast.present();
            router.replace(`/group/${groupId}`);
          } else {
            const toast = await toastController.create({
              message: 'Failed to delete expense',
              duration: 3000,
              color: 'danger',
            });
            await toast.present();
          }
        },
      },
    ],
  });

  await alert.present();
}
</script>

<style scoped>
.type-segment {
  margin: 8px 16px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.deleted-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--ion-color-danger);
}

.deleted-notice ion-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.deleted-notice p {
  margin: 0 0 24px;
  font-size: 16px;
}

.split-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.split-input {
  max-width: 80px;
  text-align: right;
}

.parts-input {
  max-width: 50px;
}

.parts-input.hidden {
  visibility: hidden;
}

.amount-input {
  max-width: 100px;
}

.you-indicator {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.split-summary {
  padding: 12px 16px;
  background: var(--ion-color-light);
  font-size: 14px;
  color: var(--ion-color-medium);
}

.split-summary p {
  margin: 0;
}
</style>
