import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/HomePage.vue')
  },
  {
    path: '/create-group',
    name: 'CreateGroup',
    component: () => import('@/views/CreateGroupPage.vue')
  },
  {
    path: '/join/:groupId',
    name: 'JoinGroup',
    component: () => import('@/views/JoinGroupPage.vue')
  },
  {
    path: '/group/:groupId',
    name: 'GroupDetail',
    component: () => import('@/views/GroupDetailPage.vue')
  },
  {
    path: '/group/:groupId/expense/new',
    name: 'NewExpense',
    component: () => import('@/views/ExpenseFormPage.vue')
  },
  {
    path: '/group/:groupId/expense/:expenseId',
    name: 'EditExpense',
    component: () => import('@/views/ExpenseFormPage.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
