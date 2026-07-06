<script setup>
import { computed } from 'vue'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'

const events = useEventsStore()
const children = useChildrenStore()

const sleeping = computed(() => events.currentSleep)

// Слово на кнопке — с учётом пола ребёнка из профиля.
// Если пол не выбран, показываем форму с обоими окончаниями.
const female = computed(() => children.activeChild?.gender === 'female')
const male = computed(() => children.activeChild?.gender === 'male')
const wakeWord = computed(() =>
  female.value ? 'Проснулась' : male.value ? 'Проснулся' : 'Проснулся(ась)'
)
const sleepWord = computed(() =>
  female.value ? 'Уснула' : male.value ? 'Уснул' : 'Уснул(а)'
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
