<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Join Group</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div v-if="isLoading" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading group...</p>
      </div>

      <div v-else-if="!group" class="error-state">
        <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
        <h2>Group not found</h2>
        <p>This group doesn't exist or the link is invalid.</p>
        <ion-button router-link="/home">Go Home</ion-button>
      </div>

      <div v-else>
        <div class="group-info">
          <h1>{{ group.name }}</h1>
          <p>Currency: {{ group.default_currency }}</p>
        </div>

        <ion-list-header>
          <ion-label>Who are you?</ion-label>
        </ion-list-header>

        <ion-list>
          <ion-radio-group v-model="selectedMemberId">
            <ion-item v-for="member in members" :key="member.id">
              <ion-radio :value="member.id" justify="start" label-placement="end">
                {{ member.name }}
              </ion-radio>
            </ion-item>
            <ion-item>
              <ion-radio value="new" justify="start" label-placement="end">
                I'm someone new
              </ion-radio>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <ion-list v-if="selectedMemberId === 'new'">
          <ion-item>
            <ion-input
              v-model="newMemberName"
              label="Your Name"
              label-placement="stacked"
              placeholder="Enter your name"
              :clear-input="true"
            ></ion-input>
          </ion-item>
        </ion-list>

        <div class="ion-padding">
          <ion-button
            expand="block"
            :disabled="!canJoin || isJoining"
            @click="joinGroup"
          >
            <ion-spinner v-if="isJoining" name="crescent"></ion-spinner>
            <span v-else>Join Group</span>
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonInput,
  IonRadio,
  IonRadioGroup,
  IonButton,
  IonIcon,
  IonSpinner,
  toastController,
} from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';
import type { Group, Member } from '@/types';

const route = useRoute();
const router = useRouter();
const { getGroup, getGroupMembers, addMember, saveGroupMembership } = useGroups();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const selectedMemberId = ref<string>('');
const newMemberName = ref('');
const isLoading = ref(true);
const isJoining = ref(false);

const canJoin = computed(() => {
  if (selectedMemberId.value === 'new') {
    return newMemberName.value.trim() !== '';
  }
  return selectedMemberId.value !== '';
});

onMounted(async () => {
  try {
    group.value = await getGroup(groupId);
    if (group.value) {
      members.value = await getGroupMembers(groupId);
    }
  } catch (error) {
    console.error('Error loading group:', error);
  } finally {
    isLoading.value = false;
  }
});

async function joinGroup() {
  if (!canJoin.value || !group.value) return;

  isJoining.value = true;

  try {
    let memberId = selectedMemberId.value;

    // Create new member if needed
    if (memberId === 'new') {
      const newMember = await addMember(groupId, newMemberName.value.trim());
      if (!newMember) {
        throw new Error('Failed to create member');
      }
      memberId = newMember.id;
    }

    // Save membership to local storage
    saveGroupMembership(groupId, memberId);

    const toast = await toastController.create({
      message: `You've joined ${group.value.name}!`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    // Navigate to group
    router.replace(`/group/${groupId}`);
  } catch (error) {
    console.error('Error joining group:', error);
    const toast = await toastController.create({
      message: 'Failed to join group. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isJoining.value = false;
  }
}
</script>

<style scoped>
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.error-icon {
  font-size: 64px;
  color: var(--ion-color-danger);
  margin-bottom: 16px;
}

.error-state h2 {
  margin: 0 0 8px;
}

.error-state p {
  margin: 0 0 24px;
  color: var(--ion-color-medium);
}

.group-info {
  text-align: center;
  padding: 24px;
}

.group-info h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.group-info p {
  margin: 0;
  color: var(--ion-color-medium);
}
</style>
