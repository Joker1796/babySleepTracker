<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useNow } from '../composables/useNow'
import { EVENT_TYPES } from '../data/eventTypes'

const props = defineProps({
  items: { type: Array, required: true },
  // Начало текущего бодрствования — для пунктов со scope 'wake'
  wakeSince: { type: Number, default: null }
})

const events = useEventsStore()
const now = useNow()

// Отметки события за сегодня / за текущее бодрствование
function eventsFor(item) {
  return events.sorted.filter(e => {
    if (e.type !== item.type || e.planned) return false
    if (item.scope === 'wake' && props.wakeSince != null) return e.startedAt >= props.wakeSince
    return dayjs(e.startedAt).isSame(dayjs(now.value), 'day')
  })
}

const rows = computed(() =>
  props.items.map(item => {
    const matched = eventsFor(item)
    return {
      ...item,
      icon: EVENT_TYPES[item.type]?.icon || '•',
      done: matched.length > 0,
      lastId: matched.length ? matched[matched.length - 1].id : null
    }
  })
)

async function toggle(row) {
  if (row.done) await events.remove(row.lastId)
  else await events.addPoint(row.type)
}
</script>

<template>
  <div class="wake-checklist">
    <button
      v-for="row in rows"
      :key="row.id"
      class="wc-row"
      :class="{ done: row.done }"
      @click="toggle(row)"
    >
      <span class="wc-icon">{{ row.icon }}</span>
      <span class="wc-label grow">{{ row.label }}</span>
      <span class="check" :class="{ on: row.done }">{{ row.done ? '✓' : '' }}</span>
    </button>
  </div>
</template>

<style scoped>
.wake-checklist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0 4px;
}

.wc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  min-height: 48px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
}

.wc-row.done {
  background: var(--c-walk-soft);
  border-color: var(--c-walk);
}

.wc-icon { font-size: 18px; }

.wc-label { font-size: 14px; }

.check {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 2px solid var(--c-border);
  background: var(--c-surface);
  font-weight: 800;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check.on {
  background: var(--c-walk);
  border-color: var(--c-walk);
}
</style>
