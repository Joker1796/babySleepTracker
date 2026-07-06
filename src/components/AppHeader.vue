<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const NAV_ITEMS = [
  { to: '/', icon: '🏠', label: 'Сегодня' },
  { to: '/history', icon: '📅', label: 'История' },
  { to: '/advice', icon: '💡', label: 'Советы' },
  { to: '/stats', icon: '📊', label: 'Статистика' },
  { to: '/settings', icon: '⚙️', label: 'Настройки' }
]

const menuOpen = ref(false)
function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }

// Установка PWA: показываем кнопку только если браузер предложил установку
// (событие beforeinstallprompt) и приложение ещё не установлено.
const deferredPrompt = ref(null)
const installed = ref(false)

const isStandalone =
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone)) || false

const canInstall = computed(() => !!deferredPrompt.value && !installed.value && !isStandalone)

function onBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt.value = e
}
function onInstalled() {
  installed.value = true
  deferredPrompt.value = null
}

async function install() {
  const e = deferredPrompt.value
  if (!e) return
  e.prompt()
  await e.userChoice
  deferredPrompt.value = null
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.addEventListener('appinstalled', onInstalled)
})
onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  window.removeEventListener('appinstalled', onInstalled)
})
</script>

<template>
  <header class="app-header">
    <button class="burger" @click="toggleMenu" aria-label="Меню">
      <span></span><span></span><span></span>
    </button>
    <span class="app-title">Режим малыша</span>
    <button v-if="canInstall" class="install-btn" @click="install">
      ⬇️ Скачать приложение
    </button>
  </header>

  <!-- Боковое меню -->
  <Transition name="fade">
    <div v-if="menuOpen" class="drawer-overlay" @click="closeMenu"></div>
  </Transition>
  <Transition name="slide">
    <nav v-if="menuOpen" class="drawer">
      <div class="drawer-head">
        <span class="app-title">Режим малыша</span>
        <button class="drawer-close" @click="closeMenu" aria-label="Закрыть">×</button>
      </div>
      <router-link
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="drawer-item"
        active-class="active"
        :exact-active-class="item.to === '/' ? 'active' : undefined"
        @click="closeMenu"
      >
        <span class="drawer-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </Transition>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 14px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
}

.burger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 40px;
  height: 40px;
  padding: 0 8px;
}

.burger span {
  display: block;
  height: 2px;
  border-radius: 2px;
  background: var(--c-text);
}

.app-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);
}

.install-btn {
  margin-left: auto;
  padding: 8px 12px;
  min-height: 36px;
  border-radius: 999px;
  background: var(--c-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 70;
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 78%;
  max-width: 300px;
  z-index: 80;
  background: var(--c-surface);
  border-right: 1px solid var(--c-border);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: calc(8px + env(safe-area-inset-top, 0px));
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 12px;
}

.drawer-close {
  width: 34px;
  height: 34px;
  font-size: 24px;
  line-height: 1;
  color: var(--c-text-soft);
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  min-height: 48px;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--c-text);
  font-size: 15px;
  font-weight: 500;
}

.drawer-item.active {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 700;
}

.drawer-icon { font-size: 20px; }

.slide-enter-active, .slide-leave-active { transition: transform 0.22s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
