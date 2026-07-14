<script setup>
import { onMounted, watch, defineAsyncComponent } from 'vue'
import { useChildrenStore } from './stores/children'
import { useEventsStore } from './stores/events'
import { useIllnessStore } from './stores/illness'
import { useSettingsStore } from './stores/settings'
import AppHeader from './components/AppHeader.vue'
import BottomNav from './components/BottomNav.vue'
import OnboardingView from './views/OnboardingView.vue'

const children = useChildrenStore()
const events = useEventsStore()
const illness = useIllnessStore()
const settings = useSettingsStore()

// Панель управления временем — только в dev. Условный динамический импорт
// позволяет Rollup исключить её из продакшен-сборки целиком.
const DevTimePanel = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./components/DevTimePanel.vue'))
  : null

onMounted(async () => {
  settings.init()
  await children.load()
})

watch(
  () => children.activeChild?.id,
  id => { if (id) { events.load(id); illness.load(id) } },
  { immediate: true }
)
</script>

<template>
  <div class="app">
    <OnboardingView v-if="children.loaded && children.children.length === 0" />
    <template v-else-if="children.loaded">
      <AppHeader />
      <router-view />
      <BottomNav />
    </template>
    <component :is="DevTimePanel" v-if="DevTimePanel" />
  </div>
</template>
