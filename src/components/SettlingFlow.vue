<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { db } from '../db'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import { EVENT_TYPES, CALENDAR_TYPE_IDS, eventLabel, eventNote } from '../data/eventTypes'
import WakeChecklist from './WakeChecklist.vue'
import Icon from './Icon.vue'

const props = defineProps({
  guidance: { type: Object, required: true },
  // Без своей карточки — встраивается в чужую (сводку на главном экране)
  embedded: { type: Boolean, default: false }
})

const events = useEventsStore()
const children = useChildrenStore()

const now = useNow()
const phase = computed(() => props.guidance.phase)

// Запланированные события календаря активного ребёнка ТОЛЬКО за сегодня —
// показываем в блоке «Чем заняться» с временем.
const plannedEvents = computed(() => {
  if (phase.value !== 'active') return []
  const dayStart = dayjs(now.value).startOf('day').valueOf()
  const dayEnd = dayjs(now.value).endOf('day').valueOf()
  return events.sorted
    .filter(e => e.planned && CALENDAR_TYPE_IDS.includes(e.type) &&
      e.startedAt >= dayStart && e.startedAt <= dayEnd)
    .sort((a, b) => a.startedAt - b.startedAt)
})

// Если событий много — показываем первые 3, остальное под кнопкой
const expanded = ref(false)
const visiblePlanned = computed(() =>
  expanded.value ? plannedEvents.value : plannedEvents.value.slice(0, 3)
)

// Заголовок карточки: «Планы» только когда в календаре есть события на сегодня,
// иначе — обычный заголовок фазы («Чем заняться» и т.п.).
const flowHeadline = computed(() =>
  phase.value === 'active' && plannedEvents.value.length ? 'Планы' : props.guidance.headline
)

// Напоминание за 2 часа по ВСЕМ детям (при нескольких детях) — запрос к БД,
// чтобы в любом профиле были видны ближайшие события всех детей.
const allSoon = ref([])
async function refreshSoon() {
  if (children.children.length < 2) { allSoon.value = []; return }
  const from = now.value
  const to = from + 2 * 60 * 60 * 1000
  const rows = await db.events.where('startedAt').between(from, to, true, true).toArray()
  allSoon.value = rows
    .filter(e => e.planned && CALENDAR_TYPE_IDS.includes(e.type))
    .sort((a, b) => a.startedAt - b.startedAt)
    .map(e => ({
      id: e.id,
      name: children.children.find(c => c.id === e.childId)?.name || '',
      iconName: EVENT_TYPES[e.type]?.iconName || 'pin',
      label: eventLabel(e),
      hhmm: dayjs(e.startedAt).format('HH:mm'),
      inMin: Math.round((e.startedAt - from) / 60000)
    }))
}
onMounted(refreshSoon)
watch(() => now.value, refreshSoon)
watch(() => children.children.length, refreshSoon)

function evTime(e) {
  return dayjs(e.startedAt).format('D MMM, HH:mm')
}
function evOverdue(e) {
  return e.startedAt < now.value
}

const tone = computed(() => {
  if (phase.value === 'time-to-sleep') return 'urgent'
  if (phase.value === 'wind-down') return 'warn'
  return 'calm'
})

const icon = computed(() => ({
  'no-data': 'baby',
  active: 'sun',
  'wind-down': 'sunrise',
  'time-to-sleep': 'clock',
  'night-waking': 'moon',
  sleeping: 'moon'
}[phase.value] || 'bulb'))
</script>

<template>
  <div class="flow" :class="[tone, embedded ? 'embedded' : 'card']">
    <div v-if="!(embedded && guidance.phase === 'sleeping')" class="flow-head">
      <Icon :name="icon" class="flow-icon" />
      <h2 class="flow-title">{{ flowHeadline }}</h2>
    </div>

    <p v-for="(line, i) in guidance.lines" :key="i" class="flow-line">{{ line }}</p>

    <!-- Чек-лист занятий на бодрствование (живот, утренние дела) -->
    <WakeChecklist
      v-if="guidance.wakeChecklist.length"
      :items="guidance.wakeChecklist"
      :wake-since="guidance.wakeSince"
    />

    <!-- Напоминание за 2 часа по всем детям (при нескольких детях) -->
    <div v-if="allSoon.length" class="soon-alert" role="status">
      <div v-for="s in allSoon" :key="s.id" class="soon-line">
        <Icon name="clock" :size="16" class="soon-ico" />
        <span>{{ s.name }}: через ~{{ formatDurationMin(s.inMin) }} — {{ s.label }} (<span class="num">{{ s.hhmm }}</span>).</span>
      </div>
    </div>

    <!-- Запланированные события из «Календаря» на сегодня со временем -->
    <div v-if="plannedEvents.length" class="plan-block">
      <div class="plan-cap"><Icon name="calendar" :size="14" /> Из календаря на сегодня</div>
      <div v-for="e in visiblePlanned" :key="e.id" class="plan-line">
        <Icon :name="EVENT_TYPES[e.type]?.iconName || 'pin'" :size="18" class="plan-ico" />
        <span class="grow plan-name">{{ eventLabel(e) }}<template v-if="eventNote(e)"> · {{ eventNote(e) }}</template></span>
        <span class="plan-date small num" :class="evOverdue(e) ? 'overdue' : 'muted'">{{ evTime(e) }}</span>
      </div>
      <button v-if="plannedEvents.length > 3" class="plan-more" @click="expanded = !expanded">
        {{ expanded ? 'Свернуть' : `Ещё ${plannedEvents.length - 3}` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Сценарий — лист дневника; тон задаёт цвет иконки, а не полоска слева */
.flow.card { padding: var(--sp-4); }
.flow-icon { color: var(--c-text-soft); }
.flow.warn .flow-icon, .flow.urgent .flow-icon { color: var(--c-accent); }
.flow.card.urgent { border-color: var(--c-accent); }

/* Встроена в чужую карточку (сводку) — без рамки, с разделителем сверху */
.flow.embedded {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
}

.flow-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.flow-title { margin: 0; font-size: var(--fs-lg); }

.flow-line {
  font-size: var(--fs-base);
  line-height: 1.5;
  margin: 0 0 8px;
}

/* Напоминание за 2 часа */
.soon-alert {
  margin: 6px 0 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--c-accent-soft);
  border: 1px solid var(--c-accent);
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: 500;
}

.soon-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.soon-line + .soon-line { margin-top: 4px; }

.soon-ico { flex-shrink: 0; margin-top: 2px; color: var(--c-accent); }

/* События из календаря */
.plan-block { margin: 4px 0 10px; }

.plan-cap {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}

.plan-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--c-border);
}

.plan-line:last-child { border-bottom: none; }

.plan-ico { flex-shrink: 0; color: var(--c-text-soft); }

.plan-name { font-size: var(--fs-base); font-weight: 500; }

.plan-date { flex-shrink: 0; }

.plan-more {
  margin-top: 6px;
  min-height: 44px;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-primary);
}

.overdue { color: var(--c-urgent); }
</style>
