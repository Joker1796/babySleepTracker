<script setup>
import { computed, ref } from 'vue'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import { poopVerb } from '../logic/gender'
import Icon from './Icon.vue'

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

// Пока запрос по типу не завершён, повторный тап игнорируем — иначе
// быстрый второй тап после старта сразу бы закрыл только что начатый интервал.
const busy = ref({})

async function toggleInterval(type, active, startMsg, endMsg) {
  if (busy.value[type]) return
  busy.value[type] = true
  try {
    if (active.value) {
      await events.endInterval(active.value)
      emit('logged', endMsg)
    } else {
      await events.startInterval(type)
      emit('logged', startMsg)
    }
  } finally {
    busy.value[type] = false
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
  emit('logged', 'Отмечено')
}
</script>

<template>
  <div class="event-btns">
    <button class="ev-btn tummy" :class="{ on: tummy }" @click="toggleTummy">
      <Icon name="tummy" />
      <span>{{ tummy ? `Живот ${elapsed(tummy)}` : 'Выкладывание' }}</span>
    </button>
    <button class="ev-btn bath" :class="{ on: bath }" @click="toggleBath">
      <Icon name="bath" />
      <span>{{ bath ? `Купаемся ${elapsed(bath)}` : 'Купание' }}</span>
    </button>
    <button class="ev-btn poop" @click="logPoop">
      <Icon name="diaper" />
      <span>{{ poopWord }}</span>
    </button>
  </div>
</template>

<style scoped>
.event-btns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: var(--sp-5);
}

.ev-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  min-height: 64px;
  border-radius: var(--radius);
  border: 1px solid var(--c-border);
  background: transparent;
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: 500;
  text-align: center;
}

.ev-btn:active { opacity: 0.75; }

.ev-btn.on {
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-text);
}

.ev-btn.on .icon { color: var(--c-accent); }
</style>
