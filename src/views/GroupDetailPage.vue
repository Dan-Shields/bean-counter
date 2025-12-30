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
                        <ion-icon
                            :icon="shareOutline"
                            slot="icon-only"
                        ></ion-icon>
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
            <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
                <ion-refresher-content></ion-refresher-content>
            </ion-refresher>

            <div v-if="hasUpdates" class="updates-banner" @click="refreshData">
                <ion-icon :icon="refreshOutline"></ion-icon>
                <span>Changes available - tap to refresh</span>
            </div>

            <div v-if="isLoading" class="loading-state">
                <ion-spinner name="crescent"></ion-spinner>
            </div>

            <template v-else>
                <TransactionList
                    v-if="activeTab === 'expenses'"
                    :transactions="transactions"
                    :members="members"
                    :current-member-id="currentMemberId"
                    :group-currency="group?.default_currency || 'EUR'"
                    :has-more="hasMoreTransactions"
                    :is-loading="isLoading"
                    @edit="editTransaction"
                    @delete="deleteTransactionConfirm"
                    @load-more="loadMoreTransactions"
                />

                <BalanceView
                    v-else
                    :balances="balances"
                    :settlements="settlements"
                    :group-currency="group?.default_currency || 'EUR'"
                    :group-id="groupId"
                    :current-member-id="currentMemberId ?? undefined"
                />
            </template>

            <ion-fab
                v-if="activeTab === 'expenses'"
                vertical="bottom"
                horizontal="end"
                slot="fixed"
            >
                <ion-fab-button
                    :router-link="`/group/${groupId}/transaction/new`"
                >
                    <ion-icon :icon="addOutline"></ion-icon>
                </ion-fab-button>
            </ion-fab>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { addOutline, refreshOutline, shareOutline } from 'ionicons/icons';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BalanceView from '@/components/BalanceView.vue';
import TransactionList from '@/components/TransactionList.vue';
import { useBalances } from '@/composables/useBalances';
import { useGroups } from '@/composables/useGroups';
import { useTransactions } from '@/composables/useTransactions';
import type {
    Group,
    Member,
    MemberBalance,
    Settlement,
    TransactionWithDetails,
} from '@/types';
import {
    alertController,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonLabel,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
    toastController,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';

const route = useRoute();
const router = useRouter();
const { getGroup, getGroupMembers, getUserMemberIdForGroup } = useGroups();
const {
    getTransactions,
    deleteTransaction,
    subscribeToGroupTransactions,
} = useTransactions();
const { getBalances, getSettlements } = useBalances();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const transactions = ref<TransactionWithDetails[]>([]);
const balances = ref<MemberBalance[]>([]);
const activeTab = ref('expenses');
const isLoading = ref(true);
const hasUpdates = ref(false);
const hasMoreTransactions = ref(false);

let unsubscribe: (() => void) | null = null;

const currentMemberId = computed(() => getUserMemberIdForGroup(groupId));

const settlements = computed<Settlement[]>(() => {
    return getSettlements(balances.value);
});

onMounted(async () => {
    await loadData();

    // Subscribe to transaction changes
    unsubscribe = subscribeToGroupTransactions(groupId, () => {
        hasUpdates.value = true;
    });
});

onUnmounted(() => {
    if (unsubscribe) {
        unsubscribe();
    }
});

// Reload data when route becomes active (returning from expense form)
watch(
    () => route.path,
    async (newPath) => {
        if (newPath === `/group/${groupId}`) {
            hasUpdates.value = false;
            await loadData();
        }
    },
);

async function loadData() {
    isLoading.value = true;
    try {
        group.value = await getGroup(groupId);
        members.value = await getGroupMembers(groupId);
        const result = await getTransactions(groupId);
        transactions.value = result.transactions;
        hasMoreTransactions.value = result.hasMore;
        balances.value = await getBalances(groupId);
    } catch (error) {
        console.error('Error loading group data:', error);
    } finally {
        isLoading.value = false;
    }
}

async function loadMoreTransactions(event: InfiniteScrollCustomEvent) {
    try {
        const result = await getTransactions(groupId, {
            offset: transactions.value.length,
        });
        transactions.value = [...transactions.value, ...result.transactions];
        hasMoreTransactions.value = result.hasMore;
    } catch (error) {
        console.error('Error loading more transactions:', error);
    } finally {
        event.target.complete();
    }
}

async function refreshData() {
    hasUpdates.value = false;
    await loadData();
}

async function handleRefresh(event: RefresherCustomEvent) {
    hasUpdates.value = false;
    await loadData();
    event.target.complete();
}

function editTransaction(transactionId: string) {
    router.push(`/group/${groupId}/transaction/${transactionId}`);
}

async function deleteTransactionConfirm(transactionId: string) {
    const alert = await alertController.create({
        header: 'Delete Transaction',
        message: 'Are you sure you want to delete this transaction?',
        buttons: [
            {
                text: 'Cancel',
                role: 'cancel',
            },
            {
                text: 'Delete',
                role: 'destructive',
                handler: async () => {
                    const success = await deleteTransaction(transactionId);
                    if (success) {
                        transactions.value = transactions.value.filter(
                            (t) => t.id !== transactionId,
                        );
                        const toast = await toastController.create({
                            message: 'Transaction deleted',
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

.updates-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--ion-color-primary);
    color: var(--ion-color-primary-contrast);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}

.updates-banner:active {
    opacity: 0.8;
}

.updates-banner ion-icon {
    font-size: 18px;
}
</style>
