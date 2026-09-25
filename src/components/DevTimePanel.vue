<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import Icon from './Icon.vue'
import { useNow, simNow, setSimulatedNow, resetSimulatedNow, isTimeSimulated } from '../composables/useNow'

// Панель управления временем — только для локальной разработки/тестирования.
const now = useNow()
const open = ref(false)

const simulated = computed(() => isTimeSimulated())

const label = computed(() => dayjs(now.value).format('DD.MM HH:mm'))

const inputValue = computed(() => dayjs(now.value).format('YYYY-MM-DDTHH:mm'))

function onInput(e) {
  const v = e.target.value
  if (v) setSimulatedNow(dayjs(v).valueOf())
}

function shift(minutes) {
  setSimulatedNow(simNow() + minutes * 60000)
}

function reset() {
  resetSimulatedNow()
}
</script>

<template>
  <div class="dev-time">
    <div v-if="open" class="panel">
      <div class="panel-head">
        <span class="tag">DEV · {{ label }}</span>
        <button class="x" @click="open = false" aria-label="Закрыть"><Icon name="close" :size="18" /></button>
      </div>
      <input type="datetime-local" :value="inputValue" @input="onInput" />
      <div class="quick">
        <button class="q" @click="shift(-60)">−1 ч</button>
        <button class="q" @click="shift(15)">+15 м</button>
        <button class="q" @click="shift(60)">+1 ч</button>
        <button class="q" @click="shift(180)">+3 ч</button>
      </div>
      <button class="reset" :disabled="!simulated" @click="reset">
        Сброс к реальному времени
      </button>
      <p class="hint">Симулированное «сейчас» влияет на подсказки и новые события. Сохраняется до сброса.</p>
    </div>

    <button class="fab" :class="{ active: simulated }" :title="label" aria-label="DEV: управление временем" @click="open = !open">
      <Icon name="clock" :size="20" />
    </button>
  </div>
</template>

<style scoped>
.dev-time {
  position: fixed;
  right: 10px;
  bottom: calc(var(--nav-height) + 10px);
  z-index: 120;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.dev-time > * { pointer-events: auto; }

.fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--c-text);
  color: var(--c-bg);
  opacity: 0.85;
}

.fab.active {
  background: var(--c-warn);
  color: var(--c-bg);
  opacity: 1;
}

.panel {
  width: 260px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tag {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-warn);
}

.x {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-soft);
  width: 36px;
  height: 36px;
  margin: -6px -6px -6px 0;
}

.quick {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin: 8px 0;
}

.q {
  padding: 8px 0;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid var(--c-border);
  font-size: var(--fs-sm);
  font-weight: 500;
}

.q:active { opacity: 0.7; }

.reset {
  width: 100%;
  padding: 9px;
  border-radius: var(--radius-sm);
  background: var(--c-warn-soft);
  color: var(--c-warn);
  font-weight: 500;
  font-size: var(--fs-sm);
}

.reset:disabled {
  opacity: 0.4;
  color: var(--c-text-soft);
  background: var(--c-surface-2);
}

.hint {
  margin: 8px 0 0;
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
  line-height: 1.35;
}
</style>
