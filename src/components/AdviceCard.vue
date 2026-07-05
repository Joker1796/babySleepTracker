<script setup>
defineProps({
  advice: { type: Object, required: true }
})

const classes = { 3: 'urgent', 2: 'warn', 1: 'info' }
const icons = { 3: '⚠️', 2: '💛', 1: '💡' }
</script>

<template>
  <div class="advice" :class="classes[advice.priority]">
    <span class="advice-icon">{{ icons[advice.priority] }}</span>
    <div class="grow">
      <p class="advice-text">{{ advice.text }}</p>
    </div>
  </div>
</template>

<style scoped>
.advice {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  font-size: 14px;
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
