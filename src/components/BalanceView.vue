<template>
  <div class="balance-view">
    <ion-list-header>
      <ion-label>Balances</ion-label>
    </ion-list-header>

    <div class="balances-container">
      <div v-for="balance in balances" :key="balance.member_id" class="balance-row">
        <span class="member-name">
          {{ balance.member_name }}<span v-if="balance.member_id === currentMemberId" class="you-indicator"> (You)</span>
        </span>
        <div class="bar-container">
          <div class="bar-background">
            <div class="bar-center-line"></div>
            <div
              class="bar-fill"
              :class="balance.balance >= 0 ? 'positive' : 'negative'"
              :style="getBarStyle(balance.balance)"
            ></div>
          </div>
        </div>
        <span class="balance-amount" :class="balance.balance >= 0 ? 'positive' : 'negative'">
          {{ formatBalance(balance.balance) }}
        </span>
      </div>
    </div>

    <ion-list-header v-if="settlements.length > 0">
      <ion-label>Suggested Settlements</ion-label>
      <ion-button
        v-if="hasOtherSettlements"
        fill="clear"
        size="small"
        @click="showAllSettlements = !showAllSettlements"
      >
        {{ showAllSettlements ? 'Show mine' : 'Show all' }}
      </ion-button>
    </ion-list-header>

    <ion-list v-if="displayedSettlements.length > 0">
      <ion-item v-for="(settlement, index) in displayedSettlements" :key="index">
        <ion-icon :icon="arrowForwardOutline" slot="start" color="medium"></ion-icon>
        <ion-label>
          <h2>
            {{ settlement.from_member_name }}<span v-if="settlement.from_member_id === currentMemberId" class="you-indicator"> (You)</span>
            pays
            {{ settlement.to_member_name }}<span v-if="settlement.to_member_id === currentMemberId" class="you-indicator"> (You)</span>
          </h2>
          <p>{{ formatCurrency(settlement.amount, groupCurrency) }}</p>
        </ion-label>
        <ion-button
          slot="end"
          fill="clear"
          size="small"
          :router-link="getSettleLink(settlement)"
        >
          Settle
        </ion-button>
      </ion-item>
    </ion-list>

    <div v-else-if="settlements.length > 0" class="no-my-settlements">
      <p>No settlements involving you</p>
      <ion-button fill="clear" size="small" @click="showAllSettlements = true">
        Show all settlements
      </ion-button>
    </div>

    <div v-else class="settled-state">
      <ion-icon :icon="checkmarkCircleOutline" class="settled-icon"></ion-icon>
      <p>All settled up!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
} from '@ionic/vue';
import { arrowForwardOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { formatCurrency } from '@/utils/currency';
import type { MemberBalance, Settlement } from '@/types';

const props = defineProps<{
  balances: MemberBalance[];
  settlements: Settlement[];
  groupCurrency: string;
  groupId: string;
  currentMemberId?: string;
}>();

const showAllSettlements = ref(false);

const mySettlements = computed(() => {
  if (!props.currentMemberId) return props.settlements;
  return props.settlements.filter(
    (s) => s.from_member_id === props.currentMemberId || s.to_member_id === props.currentMemberId
  );
});

const displayedSettlements = computed(() => {
  return showAllSettlements.value ? props.settlements : mySettlements.value;
});

const hasOtherSettlements = computed(() => {
  return props.settlements.length > mySettlements.value.length;
});

const maxAbsBalance = computed(() => {
  return Math.max(...props.balances.map((b) => Math.abs(b.balance)), 1);
});

function getBarStyle(balance: number) {
  const percentage = Math.abs(balance) / maxAbsBalance.value * 50;

  if (balance >= 0) {
    return {
      left: '50%',
      width: `${percentage}%`,
    };
  } else {
    return {
      right: '50%',
      width: `${percentage}%`,
    };
  }
}

function formatBalance(balance: number): string {
  const prefix = balance > 0 ? '+' : '';
  return prefix + formatCurrency(balance, props.groupCurrency);
}

function getSettleLink(settlement: Settlement): string {
  const params = new URLSearchParams({
    type: 'repayment',
    from: settlement.from_member_id,
    to: settlement.to_member_id,
    amount: settlement.amount.toString(),
  });
  return `/group/${props.groupId}/transaction/new?${params.toString()}`;
}
</script>

<style scoped>
.balance-view {
  padding-bottom: 24px;
}

.balances-container {
  padding: 0 16px;
}

.balance-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  gap: 12px;
}

.member-name {
  width: 80px;
  font-size: 14px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-container {
  flex: 1;
}

.bar-background {
  position: relative;
  height: 24px;
  background: var(--ion-color-light);
  border-radius: 4px;
  overflow: hidden;
}

.bar-center-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--ion-color-medium);
}

.bar-fill {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.bar-fill.positive {
  background: var(--ion-color-success);
}

.bar-fill.negative {
  background: var(--ion-color-danger);
}

.balance-amount {
  width: 70px;
  text-align: right;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.balance-amount.positive {
  color: var(--ion-color-success);
}

.balance-amount.negative {
  color: var(--ion-color-danger);
}

.you-indicator {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.no-my-settlements {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 24px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-my-settlements p {
  margin: 0 0 8px;
  font-size: 14px;
}

.settled-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
  color: var(--ion-color-success);
}

.settled-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.settled-state p {
  margin: 0;
  font-size: 16px;
}
</style>
