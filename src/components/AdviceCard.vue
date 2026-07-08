<script setup>
defineProps({
  advice: { type: Object, required: true }
})
defineEmits(['close'])

const classes = { 3: 'urgent', 2: 'warn', 1: 'info' }
const icons = { 3: '⚠️', 2: '💛', 1: '💡' }
</script>

<template>
  <div class="advice" :class="classes[advice.priority]">
    <button class="advice-close" aria-label="Закрыть" @click="$emit('close')">×</button>
    <span class="advice-icon">{{ icons[advice.priority] }}</span>
    <div class="grow">
      <p class="advice-text">{{ advice.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.advice {
  position: relative;
  display: flex;
  gap: 10px;
  padding: 12px 30px 12px 14px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  font-size: 14px;
}

.advice-close {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  font-size: 20px;
  line-height: 1;
  color: var(--c-text-soft);
}

.advice.urgent { background: var(--c-urgent-soft); }
.advice.warn { background: var(--c-warn-soft); }
.advice.info { background: var(--c-info-soft); }

.advice-icon {
  font-size: 18px;
  line-height: 1.3;
}

.advice-text { margin: 0; }
</style>
