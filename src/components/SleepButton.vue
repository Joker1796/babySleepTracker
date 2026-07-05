<script setup>
import { computed } from 'vue'
import { useEventsStore } from '../stores/events'
import { useNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import dayjs from 'dayjs'

const events = useEventsStore()
const now = useNow()

const sleeping = computed(() => events.currentSleep)
const sleepingFor = computed(() =>
  sleeping.value ? formatDurationMin((now.value - sleeping.value.startedAt) / 60000) : null
)

async function toggle() {
  if (sleeping.value) {
    await events.endInterval(sleeping.value)
  } else {
    await events.startInterval('sleep')
  }
}
</script>

<template>
  <button class="sleep-btn" :class="{ sleeping }" @click="toggle">
    <span class="icon">{{ sleeping ? '☀️' : '😴' }}</span>
    <span class="text">
      <span class="main">{{ sleeping ? 'Проснулся(ась)' : 'Уснул(а)' }}</span>
      <span v-if="sleeping" class="sub">спит {{ sleepingFor }} · с {{ dayjs(sleeping.startedAt).format('HH:mm') }}</span>
      <span v-else class="sub">отметить засыпание сейчас</span>
    </span>
  </button>
</template>

<style scoped>
.sleep-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  min-height: 72px;
  border-radius: var(--radius);
  background: var(--c-sleep);
  color: #fff;
  box-shadow: var(--shadow);
  margin-bottom: 12px;
  transition: transform 0.1s;
}

.sleep-btn:active { transform: scale(0.98); }

.sleep-btn.sleeping {
  background: var(--c-surface);
  color: var(--c-text);
  border: 2px solid var(--c-sleep);
}

.icon { font-size: 30px; }

.text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.main {
  font-size: 17px;
  font-weight: 700;
}

.sub {
  font-size: 13px;
  opacity: 0.85;
}
</style>
