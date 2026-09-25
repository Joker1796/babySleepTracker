<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { EVENT_TYPES, eventKind } from '../data/eventTypes'
import { formatDurationMin, plural } from '../logic/age'
import { poopVerb } from '../logic/gender'
import { analyzeDay } from '../logic/sleepAnalyzer'
import Icon from './Icon.vue'

const props = defineProps({
  dayTs: { type: Number, required: true },
  editable: { type: Boolean, default: true }
})
const emit = defineEmits(['edit'])

const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

// Порядковые номера ТОЛЬКО дневных снов (nap) за день — для подписи «Сон N».
// Дневные сны берём из analyzeDay; ночной сон остаётся без номера.
const napNo = computed(() => {
  const { naps } = analyzeDay(events.sorted, props.dayTs, now.value)
  const map = {}
  naps.forEach((s, i) => { map[s.id] = i + 1 })
  return map
})

// Название события; глаголы склоняем по полу ребёнка
function labelOf(e) {
  if (e.type === 'poop') return poopVerb(children.activeChild?.gender)
  if (e.type === 'sleep' && napNo.value[e.id]) return `Сон ${napNo.value[e.id]}`
  return typeOf(e).label
}

// Подпись для события «Зубы»: сколько зубов отмечено
function teethLabel(e) {
  if (e.type === 'teeth' && Array.isArray(e.teeth) && e.teeth.length) {
    const n = e.teeth.length
    return `${n} ${plural(n, 'зуб', 'зуба', 'зубов')}`
  }
  return ''
}

const dayEvents = computed(() => {
  const from = dayjs(props.dayTs).startOf('day').valueOf()
  const to = dayjs(props.dayTs).endOf('day').valueOf()
  // Хронологический порядок: раннее сверху, позднее снизу
  return events.sorted
    .filter(e => {
      if (e.planned) return false
      const end = e.endedAt ?? (eventKind(e) === 'interval' ? now.value : e.startedAt)
      return e.startedAt <= to && end >= from
    })
})

function typeOf(e) {
  return EVENT_TYPES[e.type] || { label: e.type, iconName: 'star', kind: 'point', color: 'var(--c-text-soft)', softColor: 'var(--c-surface-2)' }
}

function timeLabel(e) {
  const start = dayjs(e.startedAt).format('HH:mm')
  if (eventKind(e) !== 'interval') return start
  if (e.endedAt == null) return `${start} → сейчас`
  return `${start} – ${dayjs(e.endedAt).format('HH:mm')}`
}

function durLabel(e) {
  if (eventKind(e) !== 'interval') return ''
  const end = e.endedAt ?? now.value
  return formatDurationMin((end - e.startedAt) / 60000)
}

// Числовое значение события (мл, °C), если задано
function amountLabel(e) {
  const unit = EVENT_TYPES[e.type]?.amountUnit
  return unit != null && e.amount != null ? `${e.amount} ${unit}` : ''
}
</script>

<template>
  <div>
    <p v-if="dayEvents.length === 0" class="muted small empty">Событий пока нет</p>
    <button
      v-for="e in dayEvents"
      :key="e.id"
      class="tl-item"
      :disabled="!editable"
      @click="emit('edit', e)"
    >
      <span class="tl-icon" :style="{ color: typeOf(e).color }">
        <Icon :name="typeOf(e).iconName || 'star'" :size="20" />
      </span>
      <span class="grow tl-body">
        <span class="tl-title">
          {{ labelOf(e) }}
          <span v-if="e.endedAt == null && eventKind(e) === 'interval'" class="ongoing">идёт</span>
        </span>
        <span class="tl-time muted num">{{ timeLabel(e) }}<template v-if="durLabel(e)"> · {{ durLabel(e) }}</template><template v-if="amountLabel(e)"> · {{ amountLabel(e) }}</template><template v-if="teethLabel(e)"> · {{ teethLabel(e) }}</template></span>
        <span v-if="e.note" class="tl-note muted">{{ e.note }}</span>
      </span>
      <Icon v-if="editable" name="chevron-right" :size="18" class="tl-chevron" />
    </button>
  </div>
</template>

<style scoped>
.empty { padding: var(--sp-3) 0; border-top: 1px solid var(--c-border); margin: 0; }

.tl-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  text-align: left;
  padding: 10px 0;
  border-top: 1px solid var(--c-border);
  min-height: 56px;
}

.tl-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tl-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tl-title {
  font-weight: 500;
  font-size: var(--fs-base);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.ongoing {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-accent);
  border: 1px solid var(--c-accent);
  padding: 0 8px;
  border-radius: 999px;
}

.tl-time, .tl-note { font-size: var(--fs-sm); }

.tl-chevron { color: var(--c-text-soft); }
</style>
