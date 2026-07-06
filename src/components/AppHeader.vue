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

// ── Установка приложения (PWA) ──
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
// iPhone/iPad (в т.ч. iPadOS, который представляется как Mac с тач-экраном)
const isIOS =
  /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)

const isStandalone =
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone)) || false

// Android/Chrome: перехватываем системное предложение установки
const deferredPrompt = ref(null)
const installed = ref(false)
const iosHelpOpen = ref(false)

const canPrompt = computed(() => !!deferredPrompt.value && !installed.value && !isStandalone)
// Кнопку показываем, если можно установить через промпт ИЛИ это iOS (там установка вручную)
const showInstall = computed(() => canPrompt.value || (isIOS && !isStandalone && !installed.value))

function onBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt.value = e
}
function onInstalled() {
  installed.value = true
  deferredPrompt.value = null
  iosHelpOpen.value = false
}

async function onInstallClick() {
  if (deferredPrompt.value) {
    const e = deferredPrompt.value
    e.prompt()
    await e.userChoice
    deferredPrompt.value = null
  } else {
    // iOS: показываем инструкцию «На экран „Домой“»
    iosHelpOpen.value = true
  }
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
    <div class="header-row">
      <button class="burger" @click="toggleMenu" aria-label="Меню">
        <span></span><span></span><span></span>
      </button>
      <span class="app-title">Режим малыша</span>
      <button v-if="showInstall" class="install-btn" @click="onInstallClick">⬇️ Установить</button>
    </div>
  </header>

  <!-- Боковое меню -->
  <Transition name="fade">
    <div v-if="menuOpen" class="drawer-overlay" @click="closeMenu"></div>
  </Transition>
  <Transition name="slide">
    <nav v-if="menuOpen" class="drawer">
      <div class="drawer-head">
        <span class="drawer-title">Режим малыша</span>
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

  <!-- Инструкция по установке на iOS -->
  <Transition name="fade">
    <div v-if="iosHelpOpen" class="modal-overlay" @click.self="iosHelpOpen = false">
      <div class="modal">
        <div class="modal-head">
          <h2>Установка на iPhone</h2>
          <button class="drawer-close" @click="iosHelpOpen = false" aria-label="Закрыть">×</button>
        </div>
        <ol class="ios-steps">
          <li>Откройте меню <b>«Поделиться»</b> <span class="share-icon">⬆️</span> внизу Safari.</li>
          <li>Выберите <b>«На экран „Домой“»</b>.</li>
          <li>Нажмите <b>«Добавить»</b> — значок появится на экране.</li>
        </ol>
        <p class="muted small">Устанавливайте из Safari: в других браузерах на iPhone добавить на экран нельзя.</p>
        <button class="btn block" @click="iosHelpOpen = false">Понятно</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 60;
  background: var(--c-header);
  color: var(--c-header-text);
  /* Безопасная зона под системными часами/чёлкой на iOS */
  padding-top: env(safe-area-inset-top, 0px);
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 12px;
}

.burger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 40px;
  height: 40px;
  padding: 0 8px;
  flex-shrink: 0;
}

.burger span {
  display: block;
  height: 2px;
  border-radius: 2px;
  background: var(--c-header-text);
}

.app-title {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-header-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.install-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  min-height: 34px;
  border-radius: 999px;
  background: #fff;
  color: var(--c-primary);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.drawer-overlay, .modal-overlay {
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

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);
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

/* Модалка установки на iOS */
.modal-overlay {
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 360px;
  background: var(--c-surface);
  border-radius: var(--radius);
  padding: 16px 18px calc(16px + env(safe-area-inset-bottom, 0px));
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-head h2 { margin: 0; }

.ios-steps {
  margin: 8px 0 12px;
  padding-left: 22px;
  font-size: 14px;
}

.ios-steps li { margin-bottom: 8px; }

.share-icon {
  display: inline-block;
  padding: 0 4px;
}

.slide-enter-active, .slide-leave-active { transition: transform 0.22s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(-100%); }
</style>
