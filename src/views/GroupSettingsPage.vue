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
                <ion-buttons slot="end">
                    <ion-button
                        :disabled="!hasChanges || isSaving"
                        @click="saveChanges"
                    >
                        <span v-if="isSaving">Saving...</span>
                        <span v-else>Save</span>
                    </ion-button>
                </ion-buttons>
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
                <IdentityPicker
                    v-model="selectedMemberId"
                    v-model:new-member-name="newMemberName"
                    :members="members"
                />

                <ion-list-header>
                    <ion-label>Group</ion-label>
                </ion-list-header>
                <ion-list>
                    <ion-item>
                        <ion-input
                            v-model="groupName"
                            label="Group name"
                            label-placement="stacked"
                        ></ion-input>
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

                <ion-list-header>
                    <ion-label>Export</ion-label>
                </ion-list-header>
                <ion-list>
                    <ion-item
                        button
                        :disabled="isExporting"
                        @click="exportTransactions"
                    >
                        <ion-icon
                            :icon="downloadOutline"
                            slot="start"
                        ></ion-icon>
                        <ion-label>
                            <span v-if="isExporting">Exporting...</span>
                            <span v-else>Export transactions as CSV</span>
                        </ion-label>
                    </ion-item>
                </ion-list>
            </template>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import { downloadOutline, shareOutline } from 'ionicons/icons';
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import IdentityPicker from '@/components/IdentityPicker.vue';
import { useGroups } from '@/composables/useGroups';
import { useTransactions } from '@/composables/useTransactions';
import type { Group, Member } from '@/types';
import { downloadCSV, generateTransactionCSV } from '@/utils/csvExport';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonPage,
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
    addMember,
    updateGroup,
} = useGroups();
const { getAllTransactions } = useTransactions();

const groupId = route.params.groupId as string;
const group = ref<Group | null>(null);
const members = ref<Member[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isExporting = ref(false);

// Form state
const groupName = ref('');
const selectedMemberId = ref<string | null>(null);
const newMemberName = ref('');

// Original values to detect changes
const originalName = ref('');
const originalMemberId = ref<string | null>(null);

const hasChanges = computed(() => {
    const nameChanged = groupName.value.trim() !== originalName.value;
    const identityChanged = selectedMemberId.value !== originalMemberId.value;
    const isValidNewMember =
        selectedMemberId.value === 'new' && newMemberName.value.trim() !== '';
    return (
        nameChanged ||
        (identityChanged &&
            (selectedMemberId.value !== 'new' || isValidNewMember))
    );
});

onMounted(async () => {
    try {
        group.value = await getGroup(groupId);
        members.value = await getGroupMembers(groupId);

        const memberId = getUserMemberIdForGroup(groupId);
        selectedMemberId.value = memberId;
        originalMemberId.value = memberId;

        groupName.value = group.value?.name || '';
        originalName.value = group.value?.name || '';
    } catch (error) {
        console.error('Error loading settings:', error);
    } finally {
        isLoading.value = false;
    }
});

async function saveChanges() {
    if (!hasChanges.value) return;

    isSaving.value = true;
    try {
        // Handle identity change
        if (
            selectedMemberId.value &&
            selectedMemberId.value !== originalMemberId.value
        ) {
            let memberId = selectedMemberId.value;

            // Create new member if needed
            if (memberId === 'new') {
                const newMember = await addMember(
                    groupId,
                    newMemberName.value.trim(),
                );
                if (!newMember) {
                    const toast = await toastController.create({
                        message: 'Failed to create member',
                        duration: 2000,
                        color: 'danger',
                    });
                    await toast.present();
                    return;
                }
                memberId = newMember.id;
                members.value = [...members.value, newMember];
                selectedMemberId.value = memberId;
                newMemberName.value = '';
            }

            saveGroupMembership(groupId, memberId);
            originalMemberId.value = memberId;
        }

        // Save group name if changed
        const newName = groupName.value.trim();
        if (newName !== originalName.value) {
            const updated = await updateGroup(groupId, { name: newName });
            if (updated) {
                group.value = updated;
                originalName.value = newName;
            } else {
                const toast = await toastController.create({
                    message: 'Failed to save settings',
                    duration: 2000,
                    color: 'danger',
                });
                await toast.present();
                return;
            }
        }

        const toast = await toastController.create({
            message: 'Settings saved',
            duration: 2000,
        });
        await toast.present();
    } finally {
        isSaving.value = false;
    }
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

async function exportTransactions() {
    isExporting.value = true;
    try {
        const transactions = await getAllTransactions(groupId);

        if (transactions.length === 0) {
            const toast = await toastController.create({
                message: 'No transactions to export',
                duration: 2000,
            });
            await toast.present();
            return;
        }

        const csv = generateTransactionCSV(
            transactions,
            members.value,
            group.value?.default_currency || 'EUR',
        );
        const date = new Date().toISOString().split('T')[0];
        const safeName = (group.value?.name || 'group')
            .replace(/[^a-z0-9]/gi, '-')
            .toLowerCase();
        const filename = `${safeName}-transactions-${date}.csv`;

        downloadCSV(csv, filename);

        const toast = await toastController.create({
            message: `Exported ${transactions.length} transactions`,
            duration: 2000,
        });
        await toast.present();
    } catch (error) {
        console.error('Export failed:', error);
        const toast = await toastController.create({
            message: 'Failed to export transactions',
            duration: 2000,
            color: 'danger',
        });
        await toast.present();
    } finally {
        isExporting.value = false;
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
