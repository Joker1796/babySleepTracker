<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useSettlingStore } from '../stores/settling'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { sleepVerb } from '../logic/gender'
import { formatDurationMin } from '../logic/age'
import { EVENT_TYPES, CALENDAR_TYPE_IDS } from '../data/eventTypes'
import WakeChecklist from './WakeChecklist.vue'

const props = defineProps({
  guidance: { type: Object, required: true }
})
const emit = defineEmits(['slept'])

const events = useEventsStore()
const settling = useSettlingStore()
const children = useChildrenStore()

const now = useNow()
const childId = computed(() => children.activeChild?.id)
const phase = computed(() => props.guidance.phase)
// «Уснул/Уснула» — по полу ребёнка из профиля
const sleepWord = computed(() => sleepVerb(children.activeChild?.gender))

// Запланированные события календаря активного ребёнка (будущие и сегодняшние) —
// показываем в блоке «Чем заняться» с временем.
const plannedEvents = computed(() => {
  if (phase.value !== 'active') return []
  const todayStart = dayjs(now.value).startOf('day').valueOf()
  return events.sorted
    .filter(e => e.planned && CALENDAR_TYPE_IDS.includes(e.type) && e.startedAt >= todayStart)
    .sort((a, b) => a.startedAt - b.startedAt)
})

// Напоминание за 2 часа: только при нескольких детях и о ближайшем событии ≤ 2 ч
const soonEvent = computed(() => {
  if (children.children.length < 2) return null
  const from = now.value
  const to = from + 2 * 60 * 60 * 1000
  const ev = plannedEvents.value.find(e => e.startedAt >= from && e.startedAt <= to)
  if (!ev) return null
  return {
    icon: EVENT_TYPES[ev.type]?.icon || '📌',
    label: EVENT_TYPES[ev.type]?.label || ev.type,
    hhmm: dayjs(ev.startedAt).format('HH:mm'),
    inMin: Math.round((ev.startedAt - from) / 60000)
  }
})

function evTime(e) {
  return dayjs(e.startedAt).format('D MMM, HH:mm')
}
function evOverdue(e) {
  return e.startedAt < now.value
}

const tone = computed(() => {
  if (phase.value === 'time-to-sleep') return 'urgent'
  if (phase.value === 'wind-down' || phase.value === 'settling') return 'warn'
  return 'calm'
})

const icon = computed(() => ({
  'no-data': '🍼',
  active: '🤸',
  'wind-down': '🌥️',
  'time-to-sleep': '⏰',
  'night-waking': '🌙',
  settling: '🌙',
  'nap-extension': '🔁',
  sleeping: '😴'
}[phase.value] || '💡'))

function startSettling() {
  settling.start(childId.value)
}
function chooseLocation(loc) {
  settling.setLocation(childId.value, loc)
}
function changeLocation() {
  settling.setLocation(childId.value, null)
}
async function fellAsleep() {
  await events.startInterval('sleep')
  settling.clear(childId.value)
  settling.clearExtension(childId.value)
  emit('slept')
}
function stopExtension() {
  settling.clearExtension(childId.value)
}
</script>

<template>
  <div class="flow card" :class="tone">
    <div class="flow-head">
      <span class="flow-icon">{{ icon }}</span>
      <h2 class="flow-title">{{ guidance.headline }}</h2>
    </div>

    <p v-for="(line, i) in guidance.lines" :key="i" class="flow-line">{{ line }}</p>

    <!-- Чек-лист занятий на бодрствование (живот, утренние дела) -->
    <WakeChecklist
      v-if="guidance.wakeChecklist.length"
      :items="guidance.wakeChecklist"
      :wake-since="guidance.wakeSince"
    />

    <!-- Напоминание за 2 часа (при нескольких детях) -->
    <div v-if="soonEvent" class="soon-alert">
      🔔 Через ~{{ formatDurationMin(soonEvent.inMin) }}: {{ soonEvent.icon }} {{ soonEvent.label }} ({{ soonEvent.hhmm }}) — планируйте бодрствование.
    </div>

    <!-- Запланированные события из «Календаря» со временем -->
    <div v-if="plannedEvents.length" class="plan-block">
      <div class="plan-cap">🗓️ Из календаря</div>
      <div v-for="e in plannedEvents" :key="e.id" class="plan-line">
        <span class="plan-ico">{{ EVENT_TYPES[e.type]?.icon }}</span>
        <span class="grow plan-name">{{ EVENT_TYPES[e.type]?.label || e.type }}<template v-if="e.note"> · {{ e.note }}</template></span>
        <span class="plan-date small" :class="evOverdue(e) ? 'overdue' : 'muted'">{{ evTime(e) }}</span>
      </div>
    </div>

    <!-- Продление сна: шаги алгоритма -->
    <template v-if="phase === 'nap-extension'">
      <ol v-if="guidance.steps.length" class="steps">
        <li v-for="(step, i) in guidance.steps" :key="i">{{ step }}</li>
      </ol>
      <div class="row two-btn">
        <button class="btn secondary grow" @click="stopExtension">Начать бодрствование</button>
        <button class="btn grow" @click="fellAsleep">{{ sleepWord }}</button>
      </div>
    </template>

    <!-- Кнопка «Начать укладывание» (wind-down / time-to-sleep) -->
    <button v-if="guidance.showStartSettling" class="btn block start-btn" @click="startSettling">
      🌙 Начать укладывание
    </button>

    <!-- Укладывание: выбор места и советы под обстановку -->
    <template v-if="phase === 'settling'">
      <!-- Шаг 1: где укладываете -->
      <div v-if="!guidance.location" class="loc-options">
        <button
          v-for="loc in guidance.locationOptions"
          :key="loc.id"
          class="loc-btn"
          @click="chooseLocation(loc.id)"
        >
          <span class="loc-icon">{{ loc.icon }}</span>
          <span>{{ loc.label }}</span>
        </button>
      </div>

      <!-- Шаг 2: советы для выбранного места -->
      <template v-else>
        <ol class="steps">
          <li v-for="(step, i) in guidance.steps" :key="i">{{ step }}</li>
        </ol>
      </template>

      <button class="btn block" @click="fellAsleep">{{ sleepWord }}</button>

      <!-- Назад к выбору места (значок слева внизу) -->
      <button
        v-if="guidance.location"
        class="back-btn"
        @click="changeLocation"
        aria-label="Назад к выбору места"
      >←</button>
    </template>
  </div>
</template>

<style scoped>
.flow { border-left: 4px solid var(--c-primary); }
.flow.warn { border-left-color: var(--c-warn); }
.flow.urgent { border-left-color: var(--c-urgent); }

.flow-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.flow-icon { font-size: 24px; }

.flow-title { margin: 0; font-size: 17px; }

.flow-line {
  font-size: 14px;
  margin: 0 0 8px;
}

.remaining, .steps {
  margin: 4px 0 12px;
  padding-left: 20px;
  font-size: 14px;
}

.remaining li, .steps li { margin-bottom: 5px; }

.remaining { color: var(--c-urgent); font-weight: 500; }

.steps li { margin-bottom: 8px; }

.start-btn { margin-top: 6px; }

/* Напоминание за 2 часа */
.soon-alert {
  margin: 6px 0 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--c-warn-soft);
  border: 1px solid var(--c-warn);
  color: var(--c-warn);
  font-size: 13px;
  font-weight: 600;
}

/* События из календаря */
.plan-block { margin: 4px 0 10px; }

.plan-cap {
  font-size: 12px;
  font-weight: 700;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}

.plan-line {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--c-border);
}

.plan-line:last-child { border-bottom: none; }

.plan-ico { font-size: 18px; }

.plan-name { font-size: 14px; font-weight: 500; }

.plan-date { flex-shrink: 0; }

.overdue { color: var(--c-urgent); }

.two-btn { gap: 10px; margin-top: 8px; }

.loc-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 12px;
}

.loc-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 12px 14px;
  min-height: 52px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  font-size: 15px;
  font-weight: 600;
}

.loc-btn:active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.loc-icon { font-size: 22px; }

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-top: 10px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-text-soft);
  font-size: 20px;
  line-height: 1;
}

.back-btn:active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}
</style>
