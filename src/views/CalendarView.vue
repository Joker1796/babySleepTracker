<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useNow, simNow } from '../composables/useNow'
import { EVENT_TYPES, CALENDAR_TYPE_IDS, CALENDAR_TYPE_LIST } from '../data/eventTypes'
import EventEditSheet from '../components/EventEditSheet.vue'

const events = useEventsStore()
const now = useNow()

const month = ref(dayjs(now.value).startOf('month'))
const selectedDay = ref(dayjs(now.value).startOf('day')) // dayjs | null
const sheetModel = ref(null)

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const monthTitle = computed(() => month.value.format('MMMM YYYY'))

function prevMonth() { month.value = month.value.subtract(1, 'month'); selectedDay.value = null }
function nextMonth() { month.value = month.value.add(1, 'month'); selectedDay.value = null }

// Только календарные события активного ребёнка (выполненные + запланированные)
const calEvents = computed(() => events.sorted.filter(e => CALENDAR_TYPE_IDS.includes(e.type)))

// Число месяца → список событий этого дня (в текущем месяце)
const byDay = computed(() => {
  const map = {}
  for (const e of calEvents.value) {
    const d = dayjs(e.startedAt)
    if (d.isSame(month.value, 'month')) (map[d.date()] ??= []).push(e)
  }
  return map
})

// Ячейки сетки: ведущие пустые (неделя с Пн) + числа месяца
const cells = computed(() => {
  const lead = (month.value.startOf('month').day() + 6) % 7
  const arr = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= month.value.daysInMonth(); d++) arr.push(d)
  return arr
})

function hasEvents(day) { return !!byDay.value[day]?.length }
function dayDone(day) { return (byDay.value[day] || []).some(e => !e.planned) }
function dayPlanned(day) { return (byDay.value[day] || []).some(e => e.planned) }

function iconsFor(day) {
  const seen = []
  for (const e of byDay.value[day] || []) {
    const ic = EVENT_TYPES[e.type]?.icon
    if (ic && !seen.includes(ic)) seen.push(ic)
  }
  return seen.slice(0, 3)
}

function selectDay(day) {
  if (day) selectedDay.value = month.value.date(day)
}

const isSelected = (day) => selectedDay.value && selectedDay.value.isSame(month.value.date(day), 'day')

const selectedEvents = computed(() => {
  if (!selectedDay.value || !selectedDay.value.isSame(month.value, 'month')) return []
  return [...(byDay.value[selectedDay.value.date()] || [])].sort((a, b) => a.startedAt - b.startedAt)
})

function dayBase() {
  return (selectedDay.value || dayjs(simNow())).hour(12).minute(0).second(0).millisecond(0).valueOf()
}

// Тап по иконке открывает форму события на выбранном дне. Выбор
// «уже было / запланировано» — внутри самой формы (EventEditSheet).
function addType(typeId) {
  sheetModel.value = { isNew: true, type: typeId, startedAt: dayBase() }
}

function detailOf(e) {
  const unit = EVENT_TYPES[e.type]?.amountUnit
  const amt = unit && e.amount != null ? `${e.amount} ${unit}` : ''
  return [amt, e.note].filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="page">
    <div class="cal-nav">
      <button class="arrow" @click="prevMonth">‹</button>
      <h1 class="cal-title">{{ monthTitle }}</h1>
      <button class="arrow" @click="nextMonth">›</button>
    </div>

    <div class="card">
      <div class="cal-grid weekdays">
        <div v-for="w in weekdays" :key="w" class="wd">{{ w }}</div>
      </div>
      <div class="cal-grid">
        <template v-for="(c, i) in cells" :key="i">
          <div v-if="c === null" class="cell empty"></div>
          <button
            v-else
            class="cell"
            :class="{ event: dayDone(c), planned: dayPlanned(c) && !dayDone(c), selected: isSelected(c) }"
            @click="selectDay(c)"
          >
            <span class="num">{{ c }}</span>
            <span v-if="hasEvents(c)" class="dots">
              <span v-for="(ic, k) in iconsFor(c)" :key="k">{{ ic }}</span>
            </span>
          </button>
        </template>
      </div>
    </div>

    <div class="card day-card">
      <div class="row day-head">
        <b class="grow">{{ selectedDay ? selectedDay.format('D MMMM') : 'Сегодня' }}</b>
      </div>
      <div class="add-palette">
        <button
          v-for="t in CALENDAR_TYPE_LIST"
          :key="t.id"
          class="add-ico"
          :title="t.label"
          @click="addType(t.id)"
        >
          <span class="ai-emoji">{{ t.icon }}</span>
          <span class="ai-label">{{ t.btnLabel || t.label }}</span>
        </button>
      </div>

      <p v-if="selectedDay && !selectedEvents.length" class="muted small empty-note">В этот день событий нет.</p>
      <button v-for="e in selectedEvents" :key="e.id" class="ev-row" @click="sheetModel = e">
        <span class="ev-ico">{{ EVENT_TYPES[e.type]?.icon }}</span>
        <span class="grow ev-body">
          <span class="ev-title">{{ EVENT_TYPES[e.type]?.label || e.type }}<span v-if="e.planned" class="plan-tag">· план</span></span>
          <span v-if="detailOf(e)" class="muted small">{{ detailOf(e) }}</span>
        </span>
        <span class="muted small">{{ dayjs(e.startedAt).format('HH:mm') }}</span>
      </button>
    </div>

    <EventEditSheet :model="sheetModel" :types="CALENDAR_TYPE_LIST" allow-plan @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.cal-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px;
}

.cal-title {
  flex: 1;
  text-align: center;
  margin: 0;
  font-size: 19px;
  text-transform: capitalize;
}

.arrow {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--shadow);
  font-size: 24px;
  color: var(--c-primary);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekdays { margin-bottom: 6px; }

.wd {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-soft);
}

.cell {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border-radius: var(--radius-sm);
  background: transparent;
}

.cell.empty { visibility: hidden; }

.num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 600;
}

.cell.event .num {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-weight: 800;
}

.cell.planned .num {
  border: 1.5px dashed var(--c-primary);
  color: var(--c-primary);
  font-weight: 800;
}

.cell.selected .num { outline: 2px solid var(--c-primary); }

.dots {
  display: flex;
  gap: 1px;
  font-size: 9px;
  line-height: 1;
}

.day-card { margin-top: 12px; }

.day-head {
  align-items: center;
  margin-bottom: 8px;
}

.add-palette {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.add-ico {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  min-height: 58px;
}

.add-ico:active { opacity: 0.7; }

.ai-emoji { font-size: 22px; line-height: 1; }

.ai-label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--c-text-soft);
  text-align: center;
  line-height: 1.1;
}

.empty-note { padding: 4px 2px; }

.ev-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 4px;
  border-bottom: 1px solid var(--c-border);
  min-height: 52px;
}

.ev-row:last-child { border-bottom: none; }

.ev-ico { font-size: 20px; }

.ev-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ev-title {
  font-weight: 600;
  font-size: 14px;
}

.plan-tag {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-soft);
}
</style>
