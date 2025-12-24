<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Create Group</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <ion-list>
        <ion-item>
          <ion-input
            v-model="groupName"
            label="Group Name"
            label-placement="stacked"
            placeholder="e.g., Holiday 2024, Flatmates"
            :clear-input="true"
          ></ion-input>
        </ion-item>

        <ion-item>
          <ion-select
            v-model="defaultCurrency"
            label="Default Currency"
            label-placement="stacked"
            interface="action-sheet"
          >
            <ion-select-option value="EUR">EUR - Euro</ion-select-option>
            <ion-select-option value="USD">USD - US Dollar</ion-select-option>
            <ion-select-option value="GBP">GBP - British Pound</ion-select-option>
            <ion-select-option value="DKK">DKK - Danish Krone</ion-select-option>
            <ion-select-option value="SEK">SEK - Swedish Krona</ion-select-option>
            <ion-select-option value="NOK">NOK - Norwegian Krone</ion-select-option>
            <ion-select-option value="CHF">CHF - Swiss Franc</ion-select-option>
            <ion-select-option value="JPY">JPY - Japanese Yen</ion-select-option>
          </ion-select>
        </ion-item>
      </ion-list>

      <ion-list-header>
        <ion-label>Members</ion-label>
      </ion-list-header>
      <ion-list>
        <ion-item v-for="(member, index) in members" :key="index">
          <ion-input
            v-model="members[index]"
            placeholder="Member name"
            :clear-input="true"
          ></ion-input>
          <ion-button
            v-if="members.length > 1"
            fill="clear"
            slot="end"
            @click="removeMember(index)"
          >
            <ion-icon :icon="closeOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-item>
        <ion-item button @click="addMember">
          <ion-icon :icon="addOutline" slot="start" color="primary"></ion-icon>
          <ion-label color="primary">Add Member</ion-label>
        </ion-item>
      </ion-list>

      <div class="ion-padding">
        <ion-button
          expand="block"
          :disabled="!isValid || isLoading"
          @click="createGroup"
        >
          <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
          <span v-else>Create Group</span>
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
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
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonSpinner,
  toastController,
} from '@ionic/vue';
import { addOutline, closeOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';

const router = useRouter();
const { createGroup: createGroupApi, saveGroupMembership } = useGroups();

const groupName = ref('');
const defaultCurrency = ref('EUR');
const members = ref(['']);
const isLoading = ref(false);

const isValid = computed(() => {
  return (
    groupName.value.trim() !== '' &&
    members.value.some((m) => m.trim() !== '')
  );
});

function addMember() {
  members.value.push('');
}

function removeMember(index: number) {
  members.value.splice(index, 1);
}

async function createGroup() {
  if (!isValid.value) return;

  isLoading.value = true;

  try {
    const memberNames = members.value
      .map((m) => m.trim())
      .filter((m) => m !== '');

    const result = await createGroupApi(
      groupName.value.trim(),
      defaultCurrency.value,
      memberNames
    );

    if (result) {
      // Ask user which member they are
      router.push(`/join/${result.group.id}`);
    } else {
      const toast = await toastController.create({
        message: 'Failed to create group. Please try again.',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
  } catch (error) {
    console.error('Error creating group:', error);
    const toast = await toastController.create({
      message: 'An error occurred. Please try again.',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isLoading.value = false;
  }
}
</script>
