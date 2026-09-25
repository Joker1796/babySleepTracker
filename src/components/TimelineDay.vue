<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { EVENT_TYPES } from '../data/eventTypes'
import { formatDurationMin } from '../logic/age'
import { poopVerb } from '../logic/gender'
import Icon from './Icon.vue'

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
      const end = e.endedAt ?? (EVENT_TYPES[e.type]?.kind === 'interval' ? now.value : e.startedAt)
      return e.startedAt <= to && end >= from
    })
    .reverse()
})

function typeOf(e) {
  return EVENT_TYPES[e.type] || { label: e.type, iconName: 'star', kind: 'point', color: 'var(--c-text-soft)', softColor: 'var(--c-surface-2)' }
}

function timeLabel(e) {
  const start = dayjs(e.startedAt).format('HH:mm')
  if (typeOf(e).kind !== 'interval') return start
  if (e.endedAt == null) return `${start} → сейчас`
  return `${start} – ${dayjs(e.endedAt).format('HH:mm')}`
}

function durLabel(e) {
  if (typeOf(e).kind !== 'interval') return ''
  const end = e.endedAt ?? now.value
  return formatDurationMin((end - e.startedAt) / 60000)
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
          <span v-if="e.endedAt == null && typeOf(e).kind === 'interval'" class="ongoing">идёт</span>
        </span>
        <span class="tl-time muted num">{{ timeLabel(e) }}<template v-if="durLabel(e)"> · {{ durLabel(e) }}</template></span>
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
