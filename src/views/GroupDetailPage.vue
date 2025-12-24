<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ group?.name || 'Group' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="shareGroup">
            <ion-icon :icon="shareOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment v-model="activeTab">
          <ion-segment-button value="expenses">
            <ion-label>Expenses</ion-label>
          </ion-segment-button>
          <ion-segment-button value="balances">
            <ion-label>Balances</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="isLoading" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <template v-else>
        <ExpenseList
          v-if="activeTab === 'expenses'"
          :expenses="expenses"
          :members="members"
          :current-member-id="currentMemberId"
          :group-currency="group?.default_currency || 'EUR'"
          @edit="editExpense"
          @delete="deleteExpenseConfirm"
        />

        <BalanceView
          v-else
          :balances="balances"
          :settlements="settlements"
          :group-currency="group?.default_currency || 'EUR'"
        />
      </template>

      <ion-fab v-if="activeTab === 'expenses'" vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button :router-link="`/group/${groupId}/expense/new`">
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonFab,
  IonFabButton,
  IonSpinner,
  alertController,
  toastController,
} from '@ionic/vue';
import { addOutline, shareOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';
import { useExpenses } from '@/composables/useExpenses';
import { useBalances } from '@/composables/useBalances';
import ExpenseList from '@/components/ExpenseList.vue';
import BalanceView from '@/components/BalanceView.vue';
import type { Group, Member, ExpenseWithDetails, MemberBalance, Settlement } from '@/types';

const route = useRoute();
const router = useRouter();
const { getGroup, getGroupMembers, getUserMemberIdForGroup } = useGroups();
const { getExpenses, deleteExpense } = useExpenses();
const { calculateBalances, getSettlements } = useBalances();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const expenses = ref<ExpenseWithDetails[]>([]);
const activeTab = ref('expenses');
const isLoading = ref(true);

const currentMemberId = computed(() => getUserMemberIdForGroup(groupId));

const balances = computed<MemberBalance[]>(() => {
  return calculateBalances(members.value, expenses.value);
});

const settlements = computed<Settlement[]>(() => {
  return getSettlements(balances.value);
});

onMounted(async () => {
  await loadData();
});

// Reload data when route becomes active (returning from expense form)
watch(
  () => route.path,
  async (newPath) => {
    if (newPath === `/group/${groupId}`) {
      await loadData();
    }
  }
);

async function loadData() {
  isLoading.value = true;
  try {
    group.value = await getGroup(groupId);
    members.value = await getGroupMembers(groupId);
    expenses.value = await getExpenses(groupId);
  } catch (error) {
    console.error('Error loading group data:', error);
  } finally {
    isLoading.value = false;
  }
}

function editExpense(expenseId: string) {
  router.push(`/group/${groupId}/expense/${expenseId}`);
}

async function deleteExpenseConfirm(expenseId: string) {
  const alert = await alertController.create({
    header: 'Delete Expense',
    message: 'Are you sure you want to delete this expense?',
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
            expenses.value = expenses.value.filter((e) => e.id !== expenseId);
            const toast = await toastController.create({
              message: 'Expense deleted',
              duration: 2000,
            });
            await toast.present();
          }
        },
      },
    ],
  });

  await alert.present();
}

async function shareGroup() {
  const url = `${window.location.origin}/join/${groupId}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Join ${group.value?.name} on Bean Counter`,
        text: 'Track shared expenses with Bean Counter',
        url,
      });
    } catch (error) {
      // User cancelled or share failed
      copyToClipboard(url);
    }
  } else {
    copyToClipboard(url);
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    const toast = await toastController.create({
      message: 'Link copied to clipboard',
      duration: 2000,
    });
    await toast.present();
  } catch (error) {
    console.error('Failed to copy:', error);
  }
}
</script>

<style scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px;
}
</style>
