<template>
    <div>
        <div class="toolbar">
            <ion-segment v-model="filter" class="filter-segment">
                <ion-segment-button value="all">
                    <ion-label>All</ion-label>
                </ion-segment-button>
                <ion-segment-button value="mine">
                    <ion-label>Mine</ion-label>
                </ion-segment-button>
            </ion-segment>
            <ion-button fill="clear" size="small" @click="toggleSort">
                <ion-icon
                    :icon="sortAsc ? arrowUpOutline : arrowDownOutline"
                    slot="icon-only"
                ></ion-icon>
            </ion-button>
        </div>

        <ion-list v-if="filteredTransactions.length > 0">
            <ion-item-sliding
                v-for="transaction in filteredTransactions"
                :key="transaction.id"
            >
                <ion-item button @click="$emit('edit', transaction.id)">
                    <ion-icon
                        v-if="transaction.type === 'repayment'"
                        :icon="swapHorizontalOutline"
                        slot="start"
                        color="success"
                        class="type-icon"
                    ></ion-icon>
                    <ion-icon
                        v-else-if="transaction.type === 'income'"
                        :icon="trendingUpOutline"
                        slot="start"
                        color="success"
                        class="type-icon"
                    ></ion-icon>
                    <ion-icon
                        v-else
                        :icon="cartOutline"
                        slot="start"
                        color="medium"
                        class="type-icon"
                    ></ion-icon>
                    <ion-label>
                        <h2>{{ transaction.title }}</h2>
                        <p>
                            {{ formatDate(transaction.date) }} &middot;
                            <template v-if="transaction.type === 'repayment'">
                                {{ transaction.payer.name
                                }}<span
                                    v-if="
                                        transaction.payer_id === currentMemberId
                                    "
                                    class="you-indicator"
                                >
                                    (You)</span
                                >
                                → {{ getRecipientName(transaction) }}
                            </template>
                            <template v-else-if="transaction.type === 'income'">
                                Received by {{ transaction.payer.name
                                }}<span
                                    v-if="
                                        transaction.payer_id === currentMemberId
                                    "
                                    class="you-indicator"
                                >
                                    (You)</span
                                >
                            </template>
                            <template v-else>
                                Paid by {{ transaction.payer.name
                                }}<span
                                    v-if="
                                        transaction.payer_id === currentMemberId
                                    "
                                    class="you-indicator"
                                >
                                    (You)</span
                                >
                            </template>
                        </p>
                    </ion-label>
                    <ion-note
                        slot="end"
                        class="amount"
                        :class="{ income: transaction.type === 'income' }"
                    >
                        {{ transaction.type === 'income' ? '+' : ''
                        }}{{
                            formatAmount(
                                transaction.amount,
                                transaction.currency,
                            )
                        }}
                    </ion-note>
                </ion-item>

                <ion-item-options side="end">
                    <ion-item-option
                        color="danger"
                        @click="$emit('delete', transaction.id)"
                    >
                        <ion-icon
                            :icon="trashOutline"
                            slot="icon-only"
                        ></ion-icon>
                    </ion-item-option>
                </ion-item-options>
            </ion-item-sliding>

            <ion-infinite-scroll
                v-if="hasMore"
                @ionInfinite="$emit('loadMore', $event)"
            >
                <ion-infinite-scroll-content
                    loading-spinner="crescent"
                ></ion-infinite-scroll-content>
            </ion-infinite-scroll>
        </ion-list>

        <div v-else-if="!isLoading" class="empty-state">
            <ion-icon :icon="receiptOutline" class="empty-icon"></ion-icon>
            <h2>No transactions yet</h2>
            <p>Tap the + button to add your first transaction</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    arrowDownOutline,
    arrowUpOutline,
    cartOutline,
    receiptOutline,
    swapHorizontalOutline,
    trashOutline,
    trendingUpOutline,
} from 'ionicons/icons';
import { computed, ref } from 'vue';
import type { Member, TransactionWithDetails } from '@/types';
import { formatCurrency } from '@/utils/currency';
import {
    IonButton,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonNote,
    IonSegment,
    IonSegmentButton,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent } from '@ionic/vue';

const props = defineProps<{
    transactions: TransactionWithDetails[];
    members: Member[];
    currentMemberId: string | null;
    groupCurrency: string;
    hasMore?: boolean;
    isLoading?: boolean;
}>();

defineEmits<{
    edit: [transactionId: string];
    delete: [transactionId: string];
    loadMore: [event: InfiniteScrollCustomEvent];
}>();

const filter = ref('all');
const sortAsc = ref(false);

const filteredTransactions = computed(() => {
    let result = props.transactions;

    if (filter.value === 'mine' && props.currentMemberId) {
        result = result.filter((transaction) => {
            // Include if user paid or is in splits
            if (transaction.payer_id === props.currentMemberId) return true;
            return transaction.splits.some(
                (s) => s.member_id === props.currentMemberId,
            );
        });
    }

    if (sortAsc.value) {
        return [...result].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
    }

    return result;
});

function toggleSort() {
    sortAsc.value = !sortAsc.value;
}

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

function getRecipientName(transaction: TransactionWithDetails): string {
    // For repayment, the recipient is the first (and only) split member
    if (transaction.splits.length > 0) {
        const recipient = transaction.splits[0].member;
        const isYou = transaction.splits[0].member_id === props.currentMemberId;
        return recipient.name + (isYou ? ' (You)' : '');
    }
    return 'Unknown';
}
</script>

<style scoped>
.toolbar {
    display: flex;
    align-items: center;
    padding: 0 8px 0 16px;
    gap: 8px;
}

.filter-segment {
    flex: 1;
}

.type-icon {
    font-size: 20px;
    margin-right: 8px;
}

.amount {
    font-weight: 600;
    font-size: 16px;
}

.amount.income {
    color: var(--ion-color-success);
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

.you-indicator {
    color: var(--ion-color-primary);
    font-weight: 600;
}
</style>
