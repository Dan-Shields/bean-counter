<template>
    <ion-page>
        <ion-header :translucent="true">
            <ion-toolbar>
                <ion-buttons slot="start">
                    <ion-back-button
                        :default-href="`/group/${groupId}`"
                    ></ion-back-button>
                </ion-buttons>
                <ion-title>Settings</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content :fullscreen="true">
            <div v-if="isLoading" class="loading-state">
                <ion-spinner name="crescent"></ion-spinner>
            </div>

            <template v-else>
                <ion-list-header>
                    <ion-label>Your Identity</ion-label>
                </ion-list-header>
                <ion-list>
                    <ion-radio-group
                        :value="currentMemberId"
                        @ionChange="changeIdentity($event.detail.value)"
                    >
                        <ion-item v-for="member in members" :key="member.id">
                            <ion-radio
                                :value="member.id"
                                justify="start"
                                label-placement="end"
                            >
                                {{ member.name }}
                            </ion-radio>
                        </ion-item>
                    </ion-radio-group>
                </ion-list>

                <ion-list-header>
                    <ion-label>Group</ion-label>
                </ion-list-header>
                <ion-list>
                    <ion-item>
                        <ion-label>
                            <h2>{{ group?.name }}</h2>
                            <p>Group name</p>
                        </ion-label>
                    </ion-item>
                    <ion-item>
                        <ion-label>
                            <h2>{{ group?.default_currency }}</h2>
                            <p>Default currency</p>
                        </ion-label>
                    </ion-item>
                    <ion-item>
                        <ion-label>
                            <h2>{{ members.length }}</h2>
                            <p>Members</p>
                        </ion-label>
                    </ion-item>
                </ion-list>

                <ion-list-header>
                    <ion-label>Share</ion-label>
                </ion-list-header>
                <ion-list>
                    <ion-item button @click="shareGroup">
                        <ion-icon :icon="shareOutline" slot="start"></ion-icon>
                        <ion-label>Invite others to this group</ion-label>
                    </ion-item>
                </ion-list>
            </template>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { shareOutline } from 'ionicons/icons';
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useGroups } from '@/composables/useGroups';
import type { Group, Member } from '@/types';
import {
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonPage,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    IonTitle,
    IonToolbar,
    toastController,
} from '@ionic/vue';

const route = useRoute();
const {
    getGroup,
    getGroupMembers,
    getUserMemberIdForGroup,
    saveGroupMembership,
} = useGroups();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const currentMemberId = ref<string | null>(null);
const isLoading = ref(true);

onMounted(async () => {
    try {
        group.value = await getGroup(groupId);
        members.value = await getGroupMembers(groupId);
        currentMemberId.value = getUserMemberIdForGroup(groupId);
    } catch (error) {
        console.error('Error loading settings:', error);
    } finally {
        isLoading.value = false;
    }
});

async function changeIdentity(memberId: string) {
    saveGroupMembership(groupId, memberId);
    currentMemberId.value = memberId;

    const member = members.value.find((m) => m.id === memberId);
    const toast = await toastController.create({
        message: `You are now ${member?.name}`,
        duration: 2000,
    });
    await toast.present();
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
        } catch {
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
