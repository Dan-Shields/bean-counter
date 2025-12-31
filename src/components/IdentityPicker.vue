<template>
    <div>
        <ion-list>
            <ion-radio-group :value="modelValue" @ionChange="handleChange">
                <ion-item v-for="member in members" :key="member.id">
                    <ion-radio
                        :value="member.id"
                        justify="start"
                        label-placement="end"
                    >
                        {{ member.name }}
                    </ion-radio>
                </ion-item>
                <ion-item>
                    <ion-radio
                        value="new"
                        justify="start"
                        label-placement="end"
                    >
                        I'm someone new
                    </ion-radio>
                </ion-item>
            </ion-radio-group>
        </ion-list>
        <ion-list v-if="modelValue === 'new'">
            <ion-item>
                <ion-input
                    :value="newMemberName"
                    @ionInput="
                        $emit('update:newMemberName', $event.detail.value ?? '')
                    "
                    label="Your Name"
                    label-placement="stacked"
                    placeholder="Enter your name"
                    :clear-input="true"
                ></ion-input>
            </ion-item>
        </ion-list>
    </div>
</template>

<script setup lang="ts">
import type { Member } from '@/types';
import {
    IonInput,
    IonItem,
    IonList,
    IonRadio,
    IonRadioGroup,
} from '@ionic/vue';

defineProps<{
    members: Member[];
    modelValue: string | null;
    newMemberName: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string | null];
    'update:newMemberName': [value: string];
}>();

function handleChange(event: CustomEvent) {
    emit('update:modelValue', event.detail.value);
}
</script>
