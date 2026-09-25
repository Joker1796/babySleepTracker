<script setup>
import Icon from './Icon.vue'

defineProps({
  advice: { type: Object, required: true }
})
defineEmits(['close'])

// Красный фон — только для безопасности (priority 3). Остальные подсказки —
// строки дневника с маленькой меткой слева, без цветных плашек.
const classes = { 3: 'urgent', 2: 'warn', 1: 'info' }
</script>

<template>
  <div class="advice" :class="classes[advice.priority]">
    <Icon v-if="advice.priority === 3" name="alert" :size="18" class="advice-mark" />
    <span v-else class="advice-dot" aria-hidden="true"></span>
    <p class="advice-text grow">{{ advice.text }}</p>
    <button
      class="advice-close"
      aria-label="Закрыть"
      @click="$emit('close')"
    ><Icon name="close" :size="16" /></button>
  </div>
</template>

<style scoped>
.advice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--c-border);
  font-size: var(--fs-base);
  line-height: 1.5;
}

.advice.urgent {
  padding: 14px;
  margin: 4px 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--c-urgent-soft);
}

.advice-mark {
  margin-top: 2px;
  color: var(--c-urgent);
}

.advice-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  margin: 8px 2px 0;
  border-radius: 50%;
  background: var(--c-text);
}

.advice.warn .advice-dot { background: var(--c-accent); }

.advice-text { margin: 0; }

.advice-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -12px -12px -12px 0;
  flex-shrink: 0;
  color: var(--c-text-soft);
}
</style>
