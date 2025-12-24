<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Bean Counter</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Bean Counter</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-list v-if="groups.length > 0">
        <ion-list-header>
          <ion-label>Your Groups</ion-label>
        </ion-list-header>
        <ion-item
          v-for="group in groups"
          :key="group.id"
          button
          :router-link="`/group/${group.id}`"
        >
          <ion-label>
            <h2>{{ group.name }}</h2>
            <p>{{ group.default_currency }}</p>
          </ion-label>
          <ion-icon :icon="chevronForward" slot="end"></ion-icon>
        </ion-item>
      </ion-list>

      <div v-else class="empty-state">
        <ion-icon :icon="walletOutline" class="empty-icon"></ion-icon>
        <h2>No groups yet</h2>
        <p>Create a new group or join an existing one to start tracking shared expenses.</p>
      </div>

      <div class="action-buttons">
        <ion-button expand="block" router-link="/create-group">
          <ion-icon :icon="addOutline" slot="start"></ion-icon>
          Create New Group
        </ion-button>
        <ion-button expand="block" fill="outline" @click="showJoinPrompt">
          <ion-icon :icon="enterOutline" slot="start"></ion-icon>
          Join Group via Link
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  alertController,
} from '@ionic/vue';
import { chevronForward, addOutline, enterOutline, walletOutline } from 'ionicons/icons';
import { useGroups } from '@/composables/useGroups';
import type { Group } from '@/types';

const router = useRouter();
const { getUserGroups, getGroup } = useGroups();

const groups = ref<Group[]>([]);

onMounted(async () => {
  await loadGroups();
});

async function loadGroups() {
  const memberships = getUserGroups();
  const loadedGroups: Group[] = [];

  for (const membership of memberships) {
    const group = await getGroup(membership.group_id);
    if (group) {
      loadedGroups.push(group);
    }
  }

  groups.value = loadedGroups;
}

async function showJoinPrompt() {
  const alert = await alertController.create({
    header: 'Join Group',
    message: 'Paste the group invite link or ID',
    inputs: [
      {
        name: 'link',
        type: 'text',
        placeholder: 'Link or Group ID',
      },
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Join',
        handler: (data) => {
          if (data.link) {
            // Extract group ID from link or use as-is
            let groupId = data.link.trim();

            // Handle full URLs
            if (groupId.includes('/join/')) {
              groupId = groupId.split('/join/').pop() || '';
            } else if (groupId.includes('/group/')) {
              groupId = groupId.split('/group/').pop() || '';
            }

            if (groupId) {
              router.push(`/join/${groupId}`);
            }
          }
        },
      },
    ],
  });

  await alert.present();
}
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 48px 24px;
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

.action-buttons {
  padding: 16px;
}

.action-buttons ion-button {
  margin-bottom: 8px;
}
</style>
