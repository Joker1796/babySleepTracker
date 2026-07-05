<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
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
        <span class="tag">DEV · время</span>
        <button class="x" @click="open = false" aria-label="Закрыть">×</button>
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

    <button class="fab" :class="{ active: simulated }" @click="open = !open">
      🕐 {{ label }}
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
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--c-text);
  color: var(--c-bg);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  opacity: 0.85;
}

.fab.active {
  background: var(--c-warn);
  color: #fff;
  opacity: 1;
}

.panel {
  width: 260px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  padding: 12px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--c-warn);
}

.x {
  font-size: 20px;
  line-height: 1;
  color: var(--c-text-soft);
  width: 28px;
  height: 28px;
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
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  font-size: 13px;
  font-weight: 600;
}

.q:active { opacity: 0.7; }

.reset {
  width: 100%;
  padding: 9px;
  border-radius: var(--radius-sm);
  background: var(--c-warn-soft);
  color: var(--c-warn);
  font-weight: 600;
  font-size: 13px;
}

.reset:disabled {
  opacity: 0.4;
  color: var(--c-text-soft);
  background: var(--c-surface-2);
}

.hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--c-text-soft);
  line-height: 1.35;
}
</style>
