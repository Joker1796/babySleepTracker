<script setup>
import { computed } from 'vue'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import { poopVerb } from '../logic/gender'

const emit = defineEmits(['logged'])
const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

// «Покакал/Покакала» — по полу ребёнка из профиля
const poopWord = computed(() => poopVerb(children.activeChild?.gender))

const tummy = computed(() => events.openInterval('tummy'))
const bath = computed(() => events.openInterval('bath'))

function elapsed(ev) {
  return formatDurationMin((now.value - ev.startedAt) / 60000)
}

async function toggleInterval(type, active, startMsg, endMsg) {
  if (active.value) {
    await events.endInterval(active.value)
    emit('logged', endMsg)
  } else {
    await events.startInterval(type)
    emit('logged', startMsg)
  }
}

function toggleTummy() {
  toggleInterval('tummy', tummy, 'Выкладывание началось', 'Выкладывание завершено')
}
function toggleBath() {
  toggleInterval('bath', bath, 'Купание началось', 'Купание завершено')
}
async function logPoop() {
  await events.addPoint('poop')
  emit('logged', 'Отмечено 💩')
}
</script>

<template>
  <div class="event-btns">
    <button class="ev-btn tummy" :class="{ on: tummy }" @click="toggleTummy">
      <span class="ev-icon">👶</span>
      <span>{{ tummy ? `Живот ${elapsed(tummy)}` : 'Выкладывание' }}</span>
    </button>
    <button class="ev-btn bath" :class="{ on: bath }" @click="toggleBath">
      <span class="ev-icon">🛁</span>
      <span>{{ bath ? `Купаемся ${elapsed(bath)}` : 'Купание' }}</span>
    </button>
    <button class="ev-btn poop" @click="logPoop">
      <span class="ev-icon">💩</span>
      <span>{{ poopWord }}</span>
    </button>
  </div>
</template>

<style scoped>
.event-btns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.ev-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  min-height: 64px;
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  box-shadow: var(--shadow);
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
}

.ev-btn:active { opacity: 0.75; }

.ev-icon { font-size: 22px; }

.tummy { color: var(--c-primary); }
.tummy.on { background: var(--c-primary-soft); outline: 1.5px solid var(--c-primary); }
.bath { color: var(--c-bath); }
.bath.on { background: var(--c-bath-soft); outline: 1.5px solid var(--c-bath); }
.poop { color: var(--c-walk); }
</style>
