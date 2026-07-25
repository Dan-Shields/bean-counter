<template>
    <div class="stats-view">
        <div class="summary-card">
            <span class="summary-label">Total group spending</span>
            <span class="summary-amount">
                {{ formatCurrency(stats.netExpenses, groupCurrency) }}
            </span>
            <div class="summary-breakdown">
                <div class="breakdown-row">
                    <span>Expenses</span>
                    <span>{{
                        formatCurrency(stats.totalExpenses, groupCurrency)
                    }}</span>
                </div>
                <div v-if="stats.totalRefunds > 0" class="breakdown-row">
                    <span>Refunds &amp; income</span>
                    <span class="refund"
                        >−{{
                            formatCurrency(stats.totalRefunds, groupCurrency)
                        }}</span
                    >
                </div>
                <div class="breakdown-row muted">
                    <span
                        >{{ stats.expenseCount }}
                        {{
                            stats.expenseCount === 1 ? 'expense' : 'expenses'
                        }}</span
                    >
                    <span></span>
                </div>
            </div>
        </div>

        <ion-list-header>
            <ion-label>Per member</ion-label>
        </ion-list-header>

        <p class="section-hint">
            <strong>Paid</strong> is what each member fronted (their bank/card
            statement). <strong>Share</strong> is their portion of the group's
            spending. Reimbursements are ignored.
        </p>

        <ion-list>
            <ion-item v-for="member in stats.members" :key="member.member_id">
                <ion-label>
                    <h2>
                        {{ member.member_name
                        }}<span
                            v-if="member.member_id === currentMemberId"
                            class="you-indicator"
                        >
                            (You)</span
                        >
                    </h2>
                    <p>
                        Share: {{ formatCurrency(member.share, groupCurrency) }}
                    </p>
                </ion-label>
                <div class="member-paid" slot="end">
                    <span class="paid-amount">{{
                        formatCurrency(member.paid, groupCurrency)
                    }}</span>
                    <span class="paid-label">paid</span>
                </div>
            </ion-item>
        </ion-list>

        <div v-if="stats.expenseCount === 0" class="empty-state">
            <ion-icon :icon="statsChartOutline" class="empty-icon"></ion-icon>
            <p>No expenses yet</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { statsChartOutline } from 'ionicons/icons';
import { formatCurrency } from '@/utils/currency';
import type { GroupStats } from '@/utils/stats';
import { IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/vue';

defineProps<{
    stats: GroupStats;
    groupCurrency: string;
    currentMemberId?: string;
}>();
</script>

<style scoped>
.stats-view {
    padding-bottom: 24px;
}

.summary-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 16px;
    padding: 20px 16px;
    background: var(--ion-color-light);
    border-radius: 12px;
}

.summary-label {
    font-size: 14px;
    color: var(--ion-color-medium);
}

.summary-amount {
    font-size: 32px;
    font-weight: 700;
    margin: 4px 0 12px;
}

.summary-breakdown {
    width: 100%;
    max-width: 320px;
}

.breakdown-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    padding: 4px 0;
}

.breakdown-row.muted {
    color: var(--ion-color-medium);
}

.breakdown-row .refund {
    color: var(--ion-color-success);
}

.section-hint {
    margin: 0 16px 8px;
    font-size: 13px;
    color: var(--ion-color-medium);
}

.member-paid {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.paid-amount {
    font-size: 16px;
    font-weight: 600;
}

.paid-label {
    font-size: 12px;
    color: var(--ion-color-medium);
}

.you-indicator {
    color: var(--ion-color-primary);
    font-weight: 600;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px;
    text-align: center;
    color: var(--ion-color-medium);
}

.empty-icon {
    font-size: 48px;
    margin-bottom: 8px;
}

.empty-state p {
    margin: 0;
    font-size: 16px;
}
</style>
