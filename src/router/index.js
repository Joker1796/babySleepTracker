import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'today', component: () => import('../views/TodayView.vue') },
  { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
  { path: '/calendar', name: 'calendar', component: () => import('../views/CalendarView.vue') },
  { path: '/advice', name: 'advice', component: () => import('../views/AdviceView.vue') },
  { path: '/regime', name: 'regime', component: () => import('../views/RegimeView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
