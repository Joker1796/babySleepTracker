<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useNow } from '../composables/useNow'
import { EVENT_TYPES } from '../data/eventTypes'
import Icon from './Icon.vue'

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
    if (e.type !== item.type) return false
    if (item.scope === 'wake' && props.wakeSince != null) return e.startedAt >= props.wakeSince
    return dayjs(e.startedAt).isSame(dayjs(now.value), 'day')
  })
}

const rows = computed(() =>
  props.items.map(item => {
    const matched = eventsFor(item)
    return {
      ...item,
      iconName: EVENT_TYPES[item.type]?.iconName || 'star',
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
      <Icon :name="row.iconName" :size="20" class="wc-icon" />
      <span class="wc-label grow">{{ row.label }}</span>
      <span class="check" :class="{ on: row.done }"><Icon v-if="row.done" name="check" :size="18" /></span>
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
  border: 1px solid var(--c-border);
}

.wc-row.done {
  background: var(--c-surface-2);
}

.wc-icon { color: var(--c-text-soft); }

.wc-label { font-size: var(--fs-base); }

.check {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1.5px solid var(--c-border);
  color: var(--c-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check.on {
  background: var(--c-primary);
  border-color: var(--c-primary);
}
</style>
