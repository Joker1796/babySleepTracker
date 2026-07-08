<script setup>
import { computed } from 'vue'
import { useChildrenStore } from '../stores/children'

const children = useChildrenStore()

const items = computed(() => {
  const base = [
    { to: '/', icon: '🏠', label: 'Сегодня' },
    { to: '/history', icon: '📅', label: 'История' },
    { to: '/calendar', icon: '🗓️', label: 'Календарь' }
  ]
  // Вкладка «Режим» — только когда включён настраиваемый режим
  if (children.activeChild?.regime?.mode === 'custom') {
    base.push({ to: '/regime', icon: '🎛️', label: 'Режим' })
  }
  base.push({ to: '/settings', icon: '⚙️', label: 'Ещё' })
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
      <span class="nav-icon">{{ item.icon }}</span>
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
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 50;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 6px;
  min-height: 56px;
  text-decoration: none;
  color: var(--c-text-soft);
  font-size: 11px;
}

.nav-item.active {
  color: var(--c-primary);
  font-weight: 600;
}

.nav-icon {
  font-size: 20px;
  line-height: 1;
}
</style>
