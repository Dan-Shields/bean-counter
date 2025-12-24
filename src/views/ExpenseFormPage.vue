<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/group/${groupId}`"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ isEditing ? 'Edit Expense' : 'New Expense' }}</ion-title>
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
        <ion-item>
          <ion-input
            v-model="form.title"
            label="Title"
            label-placement="stacked"
            placeholder="e.g., Dinner, Groceries, Taxi"
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-input
            v-model.number="form.amount"
            label="Amount"
            label-placement="stacked"
            type="number"
            inputmode="decimal"
            step="0.01"
            placeholder="0.00"
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
            label="Paid by"
            label-placement="stacked"
            interface="action-sheet"
          >
            <ion-select-option
              v-for="member in members"
              :key="member.id"
              :value="member.id"
            >
              {{ member.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-list-header>
          <ion-label>Split between</ion-label>
          <ion-button fill="clear" size="small" @click="toggleSplitMode">
            {{ splitMode === 'parts' ? 'Use exact amounts' : 'Use parts' }}
          </ion-button>
        </ion-list-header>

        <ion-item v-for="split in form.splits" :key="split.member_id">
          <ion-checkbox
            slot="start"
            :checked="split.enabled"
            @ionChange="(e: CustomEvent) => split.enabled = e.detail.checked"
          ></ion-checkbox>
          <ion-label>{{ getMemberName(split.member_id) }}</ion-label>
          <ion-input
            v-if="split.enabled && splitMode === 'parts'"
            v-model.number="split.parts"
            type="number"
            inputmode="numeric"
            min="1"
            class="split-input"
            placeholder="1"
          ></ion-input>
          <ion-input
            v-if="split.enabled && splitMode === 'exact'"
            v-model.number="split.exact_amount"
            type="number"
            inputmode="decimal"
            step="0.01"
            class="split-input"
            placeholder="0.00"
          ></ion-input>
        </ion-item>

        <div class="split-summary">
          <p v-if="splitMode === 'parts'">
            Total parts: {{ totalParts }} &middot;
            Each part: {{ formatCurrency(amountPerPart, form.currency) }}
          </p>
          <p v-else>
            Assigned: {{ formatCurrency(totalExactAmount, form.currency) }} &middot;
            Remaining: {{ formatCurrency(remainingAmount, form.currency) }}
            <span v-if="unassignedCount > 0">
              (split among {{ unassignedCount }})
            </span>
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
  toastController,
  alertController,
} from '@ionic/vue';
import { alertCircleOutline, trashOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';
import { useExpenses } from '@/composables/useExpenses';
import { formatCurrency } from '@/utils/currency';
import type { Group, Member, ExpenseFormData } from '@/types';

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

let unsubscribe: (() => void) | null = null;

const form = ref<ExpenseFormData>({
  title: '',
  date: new Date().toISOString().split('T')[0],
  category: '',
  amount: 0,
  currency: 'EUR',
  payer_id: '',
  splits: [],
});

const isValid = computed(() => {
  return (
    form.value.title.trim() !== '' &&
    form.value.amount > 0 &&
    form.value.payer_id !== '' &&
    form.value.splits.some((s) => s.enabled)
  );
});

const enabledSplits = computed(() => form.value.splits.filter((s) => s.enabled));

const totalParts = computed(() => {
  return enabledSplits.value.reduce((sum, s) => sum + (s.parts || 1), 0);
});

const amountPerPart = computed(() => {
  if (totalParts.value === 0) return 0;
  return form.value.amount / totalParts.value;
});

const totalExactAmount = computed(() => {
  return enabledSplits.value
    .filter((s) => s.exact_amount !== undefined && s.exact_amount !== null)
    .reduce((sum, s) => sum + (s.exact_amount || 0), 0);
});

const remainingAmount = computed(() => {
  return Math.max(0, form.value.amount - totalExactAmount.value);
});

const unassignedCount = computed(() => {
  return enabledSplits.value.filter(
    (s) => s.exact_amount === undefined || s.exact_amount === null
  ).length;
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
    const currentMemberId = getUserMemberIdForGroup(groupId);
    if (currentMemberId) {
      form.value.payer_id = currentMemberId;
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
          form.value.title = expense.title;
          form.value.date = expense.date;
          form.value.category = expense.category || '';
          form.value.amount = expense.amount;
          form.value.currency = expense.currency;
          form.value.payer_id = expense.payer_id;

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
    // Prepare form data based on split mode
    const formData: ExpenseFormData = {
      ...form.value,
      splits: form.value.splits.map((split) => {
        if (!split.enabled) {
          return { ...split };
        }

        if (splitMode.value === 'parts') {
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

    let success: boolean;
    if (isEditing.value && expenseId) {
      const result = await updateExpense(expenseId, formData, group.value.default_currency);
      success = result !== null;
    } else {
      const result = await createExpense(groupId, formData, group.value.default_currency);
      success = result !== null;
    }

    if (success) {
      const toast = await toastController.create({
        message: isEditing.value ? 'Expense updated' : 'Expense created',
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

.split-input {
  max-width: 80px;
  text-align: right;
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
