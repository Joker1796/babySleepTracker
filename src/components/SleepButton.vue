<script setup>
import { computed, ref } from 'vue'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { sleepVerb, wakeVerb } from '../logic/gender'

const events = useEventsStore()
const children = useChildrenStore()

const sleeping = computed(() => events.currentSleep)
const busy = ref(false)

// Слово на кнопке — с учётом пола ребёнка из профиля.
const wakeWord = computed(() => wakeVerb(children.activeChild?.gender))
const sleepWord = computed(() => sleepVerb(children.activeChild?.gender))

async function toggle() {
  // Защита от двойного тапа: блокируем на время запроса
  if (busy.value) return
  busy.value = true
  try {
    if (sleeping.value) {
      await events.endInterval(sleeping.value)
    } else {
      await events.startInterval('sleep')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button class="sleep-btn" :class="{ sleeping }" :disabled="busy" @click="toggle">
    <span class="icon">{{ sleeping ? '☀️' : '😴' }}</span>
    <span class="text">
      <span class="main">{{ sleeping ? wakeWord : sleepWord }}</span>
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
</style>
