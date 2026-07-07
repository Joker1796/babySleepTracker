<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import { poopVerb } from '../logic/gender'
import { dayCount } from '../logic/eventStats'
import { EVENT_TYPES, MAIN_BUTTON_TYPE_LIST, FEEDING_TYPE_IDS, getMainButtons } from '../data/eventTypes'

const emit = defineEmits(['logged', 'edit'])
const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

// Кнопки главного экрана — только выбранные в настройках (фильтр отсекает
// снятые с главного/удалённые типы у ранее сохранённых профилей).
// Кормление (если выбрано) всегда идёт первым, в порядке Левая/Правая/Смесь.
const mainIds = new Set(MAIN_BUTTON_TYPE_LIST.map(t => t.id))
const feedingSet = new Set(FEEDING_TYPE_IDS)
const mainButtons = computed(() => {
  const list = getMainButtons(children.activeChild).filter(b => mainIds.has(b.type))
  const feeds = FEEDING_TYPE_IDS.map(id => list.find(b => b.type === id)).filter(Boolean)
  const rest = list.filter(b => !feedingSet.has(b.type))
  return [...feeds, ...rest]
})

function typeOf(type) {
  return EVENT_TYPES[type] || { label: type, icon: '❓', color: 'var(--c-text-soft)', softColor: 'var(--c-surface-2)' }
}

// Открытый (идущий) интервал этого типа, если кнопка в режиме времени
function openOf(b) {
  return b.mode === 'time' ? events.openInterval(b.type) : null
}

function elapsed(ev) {
  return formatDurationMin((now.value - ev.startedAt) / 60000)
}

// Сколько раз тип отмечен сегодня (для кнопок в режиме «количество»)
function countToday(type) {
  return dayCount(events.sorted, type, dayjs(now.value).startOf('day').valueOf())
}

function labelOf(b) {
  const def = typeOf(b.type)
  if (b.mode === 'time') {
    const open = openOf(b)
    if (open) return `${def.activeLabel || def.btnLabel || def.label} ${elapsed(open)}`
    return def.btnLabel || def.label
  }
  // Режим «количество»: показываем счётчик за сегодня в скобках, напр. «Покакал (1)»
  const base = b.type === 'poop' ? poopVerb(children.activeChild?.gender) : (def.btnLabel || def.label)
  const n = countToday(b.type)
  return n > 0 ? `${base} (${n})` : base
}

function btnStyle(b) {
  const def = typeOf(b.type)
  const on = !!openOf(b)
  return {
    color: def.color,
    background: on ? def.softColor : undefined,
    outline: on ? `1.5px solid ${def.color}` : undefined
  }
}

async function onClick(b) {
  const def = typeOf(b.type)
  // Типы с числовым значением (смесь мл, температура °C) вводятся через форму события
  if (def.amountUnit) {
    emit('edit', { isNew: true, type: b.type, startedAt: simNow() })
    return
  }
  if (b.mode === 'time') {
    const open = events.openInterval(b.type)
    if (open) {
      await events.endInterval(open)
      emit('logged', `Закончили: ${def.btnLabel || def.label}`)
    } else {
      await events.startInterval(b.type)
      emit('logged', `Начали: ${def.btnLabel || def.label}`)
    }
  } else {
    await events.addPoint(b.type)
    emit('logged', `Отмечено ${def.icon}`)
  }
}
</script>

<template>
  <div class="event-btns">
    <button
      v-for="b in mainButtons"
      :key="b.type"
      class="ev-btn"
      :class="{ on: !!openOf(b) }"
      :style="btnStyle(b)"
      @click="onClick(b)"
    >
      <span class="ev-icon">{{ typeOf(b.type).icon }}</span>
      <span>{{ labelOf(b) }}</span>
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
</style>
