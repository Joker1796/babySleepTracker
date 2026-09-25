<script setup>
import { computed, ref } from 'vue'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { sleepVerb, wakeVerb } from '../logic/gender'
import Icon from './Icon.vue'

// stale: открытый сон идёт больше 16 ч — пробуждение, видимо, забыли отметить.
// Тогда кнопка не закрывает сон текущим временем, а просит указать время в редакторе.
const props = defineProps({ stale: { type: Boolean, default: false } })
const emit = defineEmits(['fix'])

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
  if (props.stale) { emit('fix'); return }
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
    <Icon :name="stale ? 'clock' : sleeping ? 'sun' : 'moon'" :size="24" />
    <span class="text">
      <span class="main">{{ stale ? 'Указать время пробуждения' : sleeping ? wakeWord : sleepWord }}</span>
    </span>
  </button>
</template>

<style scoped>
.sleep-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 18px;
  min-height: 64px;
  border-radius: var(--radius);
  background: var(--c-primary);
  color: var(--c-on-primary);
  margin-bottom: 10px;
  transition: transform 0.1s;
}

.sleep-btn:active { transform: scale(0.98); }

.sleep-btn.sleeping {
  background: transparent;
  color: var(--c-text);
  border: 1.5px solid var(--c-primary);
}

.text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.main {
  font-size: var(--fs-md);
  font-weight: 600;
}
</style>
