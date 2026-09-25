import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'today', component: () => import('../views/TodayView.vue') },
  { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
  { path: '/advice', name: 'advice', component: () => import('../views/AdviceView.vue') },
  { path: '/stats', name: 'stats', component: () => import('../views/StatsView.vue') },
  { path: '/regime', name: 'regime', component: () => import('../views/RegimeView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// После деплоя новый service worker удаляет старые чанки, а открытая вкладка
// ещё ссылается на них — раздел не грузится. Перезагружаем страницу на нужный
// маршрут (один раз, чтобы не зациклиться, если ошибка не из-за обновления).
const RELOAD_KEY = 'chunk-reload-at'
router.onError((err, to) => {
  const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err?.message || '')
  if (!isChunkError) return
  let last = 0
  try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0 } catch {}
  if (Date.now() - last < 10000) return
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch {}
  window.location.hash = to?.fullPath || '/'
  window.location.reload()
})

export default router
