<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { formatDurationMin, ageInMonths } from '../logic/age'
import { poopVerb } from '../logic/gender'
import { dayCount } from '../logic/eventStats'
import { EVENT_TYPES, MAIN_BUTTON_TYPE_LIST, FEEDING_TYPE_IDS, getMainButtons } from '../data/eventTypes'
import Icon from './Icon.vue'

const emit = defineEmits(['logged', 'edit'])
const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

// Кнопки главного экрана — только выбранные в настройках (фильтр отсекает
// снятые с главного/удалённые типы у ранее сохранённых профилей).
// Кормление (если выбрано) всегда идёт первым, в порядке Левая/Правая/Смесь.
const mainIds = new Set(MAIN_BUTTON_TYPE_LIST.map(t => t.id))
const feedingSet = new Set(FEEDING_TYPE_IDS)
const ageM = computed(() => {
  const bd = children.activeChild?.birthDate
  return bd ? ageInMonths(bd, now.value) : null
})
const mainButtons = computed(() => {
  const age = ageM.value
  const list = getMainButtons(children.activeChild).filter(b =>
    mainIds.has(b.type) &&
    (age == null || EVENT_TYPES[b.type]?.minAgeM == null || age >= EVENT_TYPES[b.type].minAgeM)
  )
  const feeds = FEEDING_TYPE_IDS.map(id => list.find(b => b.type === id)).filter(Boolean)
  const rest = list.filter(b => !feedingSet.has(b.type))
  return [...feeds, ...rest]
})

function typeOf(type) {
  return EVENT_TYPES[type] || { label: type, iconName: 'more' }
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

// Пока запрос по типу не завершён, повторный тап игнорируем — иначе
// быстрый второй тап после старта сразу бы закрыл только что начатый интервал.
const busy = ref({})

async function onClick(b) {
  const def = typeOf(b.type)
  // Типы с числовым значением (смесь мл) или комментарием (еда) вводятся через форму
  if (def.amountUnit || def.hasNote) {
    emit('edit', { isNew: true, type: b.type, startedAt: simNow() })
    return
  }
  if (busy.value[b.type]) return
  busy.value[b.type] = true
  try {
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
      emit('logged', 'Отмечено')
    }
  } finally {
    busy.value[b.type] = false
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
      :aria-pressed="b.mode === 'time' ? !!openOf(b) : undefined"
      @click="onClick(b)"
    >
      <Icon :name="typeOf(b.type).iconName || 'more'" />
      <span>{{ labelOf(b) }}</span>
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
