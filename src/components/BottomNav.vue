<script setup>
import { computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import Icon from './Icon.vue'
import { useIllnessStore } from '../stores/illness'

const children = useChildrenStore()
const illness = useIllnessStore()

const items = computed(() => {
  const base = [
    { to: '/', icon: 'home', label: 'Сегодня' },
    { to: '/history', icon: 'clock', label: 'История' },
    { to: '/calendar', icon: 'calendar', label: 'Календарь' }
  ]
  // Вкладка «Режим» — только когда включён настраиваемый режим
  if (children.activeChild?.regime?.mode === 'custom') {
    base.push({ to: '/regime', icon: 'sliders', label: 'Режим' })
  }
  // Вкладка «Болезнь» — только пока малыш болеет
  if (illness.hasActive) {
    base.push({ to: '/illness', icon: 'thermometer', label: 'Болезнь' })
  }
  base.push({ to: '/settings', icon: 'more', label: 'Ещё' })
  return base
})
</script>

<template>
  <nav class="bottom-nav">
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      active-class="active"
      :exact-active-class="item.to === '/' ? 'active' : undefined"
    >
      <Icon :name="item.icon" class="nav-icon" />
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  background: var(--c-bg);
  border-top: 1px solid var(--c-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 50;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 0 6px;
  min-height: 60px;
  text-decoration: none;
  color: var(--c-text-soft);
  font-size: 11px;
}

.nav-item.active {
  color: var(--c-text);
  font-weight: 600;
}

.nav-item.active .nav-icon {
  stroke-width: 1.9;
}
</style>
