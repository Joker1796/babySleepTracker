<script setup>
import { useChildrenStore } from '../stores/children'
import { formatChildAge } from '../logic/age'
import { useNow } from '../composables/useNow'

const store = useChildrenStore()
const now = useNow()
</script>

<template>
  <div class="switcher">
    <button
      v-for="child in store.children"
      :key="child.id"
      class="chip child-chip"
      :class="{ active: store.activeChild?.id === child.id }"
      @click="store.setActive(child.id)"
    >
      <span class="dot" :style="{ background: child.color }"></span>
      <span>{{ child.name }}</span>
      <span class="age">{{ formatChildAge(child, now) }}</span>
    </button>
  </div>
</template>

<style scoped>
.switcher {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 10px;
  scrollbar-width: none;
}
.switcher::-webkit-scrollbar { display: none; }

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.age {
  color: var(--c-text-soft);
  font-size: 12px;
}

/* Активный ребёнок — обводка чернилами, без заливки: заливку оставляем кнопкам */
.chip.child-chip.active {
  background: transparent;
  border-color: var(--c-text);
  color: var(--c-text);
}
</style>
