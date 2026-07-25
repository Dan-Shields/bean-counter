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
                    <ion-button @click="openSettings">
                        <ion-icon
                            :icon="settingsOutline"
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
                    <ion-segment-button value="stats">
                        <ion-label>Stats</ion-label>
                    </ion-segment-button>
                </ion-segment>
            </ion-toolbar>
        </ion-header>

        <ion-content ref="contentRef" :fullscreen="true">
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
                    v-model:filter="filter"
                    :transactions="transactions"
                    :members="members"
                    :current-member-id="currentMemberId"
                    :group-currency="group?.default_currency || 'EUR'"
                    :has-more="hasMoreTransactions"
                    :is-loading="isLoading"
                    :sort-asc="sortAsc"
                    :refreshing="refreshing"
                    @edit="editTransaction"
                    @delete="deleteTransactionConfirm"
                    @load-more="loadMoreTransactions"
                    @sort-change="handleSortChange"
                    @filter-change="handleFilterChange"
                />

                <BalanceView
                    v-else-if="activeTab === 'balances'"
                    :balances="balances"
                    :settlements="settlements"
                    :group-currency="group?.default_currency || 'EUR'"
                    :group-id="groupId"
                    :current-member-id="currentMemberId ?? undefined"
                />

                <div v-else-if="statsLoading" class="loading-state">
                    <ion-spinner name="crescent"></ion-spinner>
                </div>

                <StatsView
                    v-else-if="stats"
                    :stats="stats"
                    :group-currency="group?.default_currency || 'EUR'"
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

        <ion-modal
            :is-open="showIdentityModal"
            :backdrop-dismiss="false"
            :can-dismiss="!!currentMemberId"
        >
            <ion-header>
                <ion-toolbar>
                    <ion-title>Who are you?</ion-title>
                </ion-toolbar>
            </ion-header>
            <ion-content class="ion-padding">
                <p class="identity-intro">
                    Select your name to track your expenses and balances.
                </p>
                <IdentityPicker
                    v-model="selectedMemberId"
                    v-model:new-member-name="newMemberName"
                    :members="members"
                />
                <ion-button
                    expand="block"
                    :disabled="!canConfirmIdentity"
                    :loading="isConfirmingIdentity"
                    @click="confirmIdentity"
                    class="confirm-button"
                >
                    Continue
                </ion-button>
            </ion-content>
        </ion-modal>
    </ion-page>
</template>

<script setup lang="ts">
import {
    addOutline,
    refreshOutline,
    settingsOutline,
    shareOutline,
} from 'ionicons/icons';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BalanceView from '@/components/BalanceView.vue';
import IdentityPicker from '@/components/IdentityPicker.vue';
import StatsView from '@/components/StatsView.vue';
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
import { calculateGroupStats, type GroupStats } from '@/utils/stats';
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
    IonModal,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonTitle,
    IonToolbar,
    onIonViewWillLeave,
    toastController,
} from '@ionic/vue';
import type {
    InfiniteScrollCustomEvent,
    RefresherCustomEvent,
} from '@ionic/vue';

const route = useRoute();
const router = useRouter();
const {
    getGroup,
    getGroupMembers,
    getUserMemberIdForGroup,
    saveGroupMembership,
    addMember,
} = useGroups();
const {
    getTransactions,
    getAllTransactions,
    deleteTransaction,
    subscribeToGroupTransactions,
} = useTransactions();
const { getBalances, getSettlements } = useBalances();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const transactions = ref<TransactionWithDetails[]>([]);
const balances = ref<MemberBalance[]>([]);
const stats = ref<GroupStats | null>(null);
const statsLoading = ref(false);
const activeTab = ref('expenses');
const isLoading = ref(true);
const hasUpdates = ref(false);
const hasMoreTransactions = ref(false);
const sortAsc = ref(false);
const filter = ref<'all' | 'mine'>('all');
const refreshing = ref(false);
const showIdentityModal = ref(false);
const selectedMemberId = ref<string>('');
const newMemberName = ref('');
const isConfirmingIdentity = ref(false);
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);
// Scroll position saved when leaving, restored when returning from the form
let savedScrollTop = 0;

let unsubscribe: (() => void) | null = null;

const canConfirmIdentity = computed(() => {
    if (selectedMemberId.value === 'new') {
        return newMemberName.value.trim() !== '';
    }
    return selectedMemberId.value !== '';
});

const currentMemberId = ref<string | null>(getUserMemberIdForGroup(groupId));

const settlements = computed<Settlement[]>(() => {
    return getSettlements(balances.value);
});

onMounted(async () => {
    await loadData();

    // Check if user needs to select their identity
    if (!currentMemberId.value && members.value.length > 0) {
        showIdentityModal.value = true;
    }

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

// Save the current scroll position before navigating away (e.g. to the form)
onIonViewWillLeave(async () => {
    const scrollEl = await contentRef.value?.$el.getScrollElement();
    if (scrollEl) {
        savedScrollTop = scrollEl.scrollTop;
    }
});

// Reload data when route becomes active (returning from expense form)
watch(
    () => route.path,
    async (newPath) => {
        if (newPath === `/group/${groupId}`) {
            hasUpdates.value = false;
            // Silently reload so the list doesn't flash a spinner, keep the
            // items already loaded via infinite scroll, then restore scroll.
            await loadData({ silent: true, preserveCount: true });
            await restoreScrollPosition();
        }
    },
);

async function restoreScrollPosition() {
    if (savedScrollTop <= 0) return;
    // Wait for the reloaded list to render before scrolling.
    await nextTick();
    await contentRef.value?.$el.scrollToPoint(0, savedScrollTop, 0);
}

async function loadData(options?: {
    silent?: boolean;
    preserveCount?: boolean;
}) {
    if (!options?.silent) {
        isLoading.value = true;
    }
    try {
        group.value = await getGroup(groupId);
        members.value = await getGroupMembers(groupId);
        // When returning to the page, refetch as many items as were already
        // loaded via infinite scroll so scroll position can be restored.
        const limit =
            options?.preserveCount && transactions.value.length > 0
                ? transactions.value.length
                : undefined;
        const result = await getTransactions(groupId, {
            limit,
            sortAsc: sortAsc.value,
            memberId:
                filter.value === 'mine'
                    ? (currentMemberId.value ?? undefined)
                    : undefined,
        });
        transactions.value = result.transactions;
        hasMoreTransactions.value = result.hasMore;
        balances.value = await getBalances(groupId);

        // Invalidate stats; reload eagerly if the stats tab is showing.
        stats.value = null;
        if (activeTab.value === 'stats') {
            await loadStats();
        }
    } catch (error) {
        console.error('Error loading group data:', error);
    } finally {
        if (!options?.silent) {
            isLoading.value = false;
        }
    }
}

async function loadStats() {
    statsLoading.value = true;
    try {
        const allTransactions = await getAllTransactions(groupId);
        stats.value = calculateGroupStats(allTransactions, members.value);
    } catch (error) {
        console.error('Error loading stats:', error);
    } finally {
        statsLoading.value = false;
    }
}

// Lazily compute stats the first time the Stats tab is opened.
watch(activeTab, (tab) => {
    if (tab === 'stats' && !stats.value && !statsLoading.value) {
        loadStats();
    }
});

async function loadMoreTransactions(event: InfiniteScrollCustomEvent) {
    try {
        const result = await getTransactions(groupId, {
            offset: transactions.value.length,
            sortAsc: sortAsc.value,
            memberId:
                filter.value === 'mine'
                    ? (currentMemberId.value ?? undefined)
                    : undefined,
        });
        transactions.value = [...transactions.value, ...result.transactions];
        hasMoreTransactions.value = result.hasMore;
    } catch (error) {
        console.error('Error loading more transactions:', error);
    } finally {
        event.target.complete();
    }
}

async function handleSortChange(newSortAsc: boolean) {
    sortAsc.value = newSortAsc;
    refreshing.value = true;
    try {
        const result = await getTransactions(groupId, {
            sortAsc: newSortAsc,
            memberId:
                filter.value === 'mine'
                    ? (currentMemberId.value ?? undefined)
                    : undefined,
        });
        transactions.value = result.transactions;
        hasMoreTransactions.value = result.hasMore;
    } finally {
        refreshing.value = false;
    }
}

async function handleFilterChange(newFilter: 'all' | 'mine') {
    filter.value = newFilter;
    refreshing.value = true;
    try {
        const result = await getTransactions(groupId, {
            sortAsc: sortAsc.value,
            memberId:
                newFilter === 'mine'
                    ? (currentMemberId.value ?? undefined)
                    : undefined,
        });
        transactions.value = result.transactions;
        hasMoreTransactions.value = result.hasMore;
    } finally {
        refreshing.value = false;
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

async function confirmIdentity() {
    if (!canConfirmIdentity.value) return;

    isConfirmingIdentity.value = true;
    try {
        let memberId = selectedMemberId.value;

        if (memberId === 'new') {
            const newMember = await addMember(
                groupId,
                newMemberName.value.trim(),
            );
            if (!newMember) {
                const toast = await toastController.create({
                    message: 'Failed to create member. Please try again.',
                    duration: 3000,
                    color: 'danger',
                });
                await toast.present();
                return;
            }
            memberId = newMember.id;
            members.value = [...members.value, newMember];
        }

        saveGroupMembership(groupId, memberId);
        currentMemberId.value = memberId;
        showIdentityModal.value = false;
        newMemberName.value = '';
        selectedMemberId.value = '';
    } finally {
        isConfirmingIdentity.value = false;
    }
}

function openSettings() {
    router.push(`/group/${groupId}/settings`);
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

.identity-intro {
    text-align: center;
    color: var(--ion-color-medium);
    margin-bottom: 16px;
}

.confirm-button {
    margin-top: 24px;
}
</style>
