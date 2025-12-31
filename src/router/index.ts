import { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHistory } from '@ionic/vue-router';

const routes: Array<RouteRecordRaw> = [
    {
        path: '/',
        redirect: '/home',
    },
    {
        path: '/home',
        name: 'Home',
        component: () => import('@/views/HomePage.vue'),
    },
    {
        path: '/create-group',
        name: 'CreateGroup',
        component: () => import('@/views/CreateGroupPage.vue'),
    },
    {
        path: '/join/:groupId',
        name: 'JoinGroup',
        component: () => import('@/views/JoinGroupPage.vue'),
    },
    {
        path: '/group/:groupId',
        name: 'GroupDetail',
        component: () => import('@/views/GroupDetailPage.vue'),
    },
    {
        path: '/group/:groupId/settings',
        name: 'GroupSettings',
        component: () => import('@/views/GroupSettingsPage.vue'),
    },
    {
        path: '/group/:groupId/transaction/new',
        name: 'NewTransaction',
        component: () => import('@/views/TransactionFormPage.vue'),
    },
    {
        path: '/group/:groupId/transaction/:transactionId',
        name: 'EditTransaction',
        component: () => import('@/views/TransactionFormPage.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

export default router;
