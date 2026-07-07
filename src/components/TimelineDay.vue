<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { EVENT_TYPES, eventKind } from '../data/eventTypes'
import { formatDurationMin } from '../logic/age'
import { poopVerb } from '../logic/gender'

const props = defineProps({
  dayTs: { type: Number, required: true },
  editable: { type: Boolean, default: true }
})
const emit = defineEmits(['edit'])

const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

// Название события; глаголы склоняем по полу ребёнка
function labelOf(e) {
  if (e.type === 'poop') return poopVerb(children.activeChild?.gender)
  return typeOf(e).label
}

const dayEvents = computed(() => {
  const from = dayjs(props.dayTs).startOf('day').valueOf()
  const to = dayjs(props.dayTs).endOf('day').valueOf()
  return events.sorted
    .filter(e => {
      if (e.planned) return false
      const end = e.endedAt ?? (eventKind(e) === 'interval' ? now.value : e.startedAt)
      return e.startedAt <= to && end >= from
    })
    .reverse()
})

function typeOf(e) {
  return EVENT_TYPES[e.type] || { label: e.type, icon: '❓', kind: 'point', color: 'var(--c-text-soft)', softColor: 'var(--c-surface-2)' }
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
      <span class="tl-icon" :style="{ background: typeOf(e).softColor }">{{ typeOf(e).icon }}</span>
      <span class="grow tl-body">
        <span class="tl-title">
          {{ labelOf(e) }}
          <span v-if="e.endedAt == null && eventKind(e) === 'interval'" class="ongoing">идёт</span>
        </span>
        <span class="tl-time muted">{{ timeLabel(e) }}<template v-if="durLabel(e)"> · {{ durLabel(e) }}</template><template v-if="amountLabel(e)"> · {{ amountLabel(e) }}</template></span>
        <span v-if="e.note" class="tl-note muted">{{ e.note }}</span>
      </span>
      <span v-if="editable" class="tl-chevron muted">›</span>
    </button>
  </div>
</template>

<style scoped>
.empty { padding: 8px 2px; }

.tl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 4px;
  border-bottom: 1px solid var(--c-border);
  min-height: 56px;
}

.tl-item:last-child { border-bottom: none; }

.tl-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  flex-shrink: 0;
}

.tl-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tl-title {
  font-weight: 600;
  font-size: 14.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ongoing {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-walk);
  background: var(--c-walk-soft);
  padding: 1px 8px;
  border-radius: 999px;
}

.tl-time, .tl-note { font-size: 13px; }

.tl-chevron { font-size: 20px; }
</style>
