<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { useSettingsStore } from '../stores/settings'
import { useNow, simNow } from '../composables/useNow'
import { EVENT_TYPES, CALENDAR_TYPE_IDS, CALENDAR_TYPE_LIST, eventLabel, eventNote } from '../data/eventTypes'
import { illnessOnDay } from '../logic/illness'
import EventEditSheet from '../components/EventEditSheet.vue'

const events = useEventsStore()
const illness = useIllnessStore()
const settings = useSettingsStore()
const now = useNow()

const month = ref(dayjs(now.value).startOf('month'))
const selectedDay = ref(dayjs(now.value).startOf('day')) // dayjs | null
const sheetModel = ref(null)
const showPalette = ref(false)

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const monthTitle = computed(() => month.value.format('MMMM YYYY'))

function prevMonth() { month.value = month.value.subtract(1, 'month'); selectedDay.value = null }
function nextMonth() { month.value = month.value.add(1, 'month'); selectedDay.value = null }

// Только календарные события активного ребёнка (выполненные + запланированные).
// События болезни (illnessId) в календарь не выносим — вместо них день болезни
// подсвечивается красным со сводкой (см. sickByDay/selectedIllness).
const calEvents = computed(() =>
  events.sorted.filter(e => CALENDAR_TYPE_IDS.includes(e.type) && e.illnessId == null)
)

// Число месяца → болезнь, охватывающая этот день (для красной подсветки и сводки)
const sickByDay = computed(() => {
  const map = {}
  for (let d = 1; d <= month.value.daysInMonth(); d++) {
    const dayStart = month.value.date(d).startOf('day').valueOf()
    const ill = illnessOnDay(illness.illnesses, dayStart, now.value)
    if (ill) map[d] = ill
  }
  return map
})
function daySick(day) { return sickByDay.value[day] != null }

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

function dayDone(day) { return (byDay.value[day] || []).some(e => !e.planned) }
function dayPlanned(day) { return (byDay.value[day] || []).some(e => e.planned) }

function selectDay(day) {
  if (day) selectedDay.value = month.value.date(day)
}

const isSelected = (day) => selectedDay.value && selectedDay.value.isSame(month.value.date(day), 'day')

const selectedEvents = computed(() => {
  if (!selectedDay.value || !selectedDay.value.isSame(month.value, 'month')) return []
  return [...(byDay.value[selectedDay.value.date()] || [])].sort((a, b) => a.startedAt - b.startedAt)
})

// Болезнь выбранного дня и краткая сводка по ней (название + лекарства)
const selectedIllness = computed(() => {
  if (!selectedDay.value || !selectedDay.value.isSame(month.value, 'month')) return null
  return sickByDay.value[selectedDay.value.date()] || null
})
const selectedMedNames = computed(() =>
  (selectedIllness.value?.medications || []).map(m => (m.name || '').trim()).filter(Boolean)
)

function dayBase() {
  const day = selectedDay.value || dayjs(simNow())
  // Для сегодняшнего дня подставляем текущее время, иначе — полдень выбранной даты
  if (day.isSame(dayjs(simNow()), 'day')) return simNow()
  return day.hour(12).minute(0).second(0).millisecond(0).valueOf()
}

// Тап по иконке открывает форму события на выбранном дне. Выбор
// «уже было / запланировано» — внутри самой формы (EventEditSheet).
// План по умолчанию создаётся невыполненным.
function addType(typeId) {
  sheetModel.value = { isNew: true, type: typeId, startedAt: dayBase(), planned: typeId === 'plan' }
  showPalette.value = false
}

// Кнопка-план из настроек: сразу добавляет невыполненный план на выбранный день
async function addPlan(btn) {
  await events.add({ type: 'plan', kind: 'point', startedAt: dayBase(), note: btn.name, planned: true })
  showPalette.value = false
}

// Галочка выполнения плана: выполнен ↔ снова в планах
async function togglePlanDone(e) {
  await events.update({ ...e, planned: !e.planned })
}

function detailOf(e) {
  const unit = EVENT_TYPES[e.type]?.amountUnit
  const amt = unit && e.amount != null ? `${e.amount} ${unit}` : ''
  return [amt, eventNote(e)].filter(Boolean).join(' · ')
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
            :class="{ event: dayDone(c), planned: dayPlanned(c) && !dayDone(c), sick: daySick(c), selected: isSelected(c) }"
            @click="selectDay(c)"
          >
            <span class="num">{{ c }}</span>
          </button>
        </template>
      </div>
    </div>

    <div class="card day-card">
      <div class="row day-head">
        <b class="grow">{{ selectedDay ? selectedDay.format('D MMMM') : 'Сегодня' }}</b>
        <button class="btn secondary day-add" :class="{ active: showPalette }" @click="showPalette = !showPalette">
          {{ showPalette ? '✕' : '＋ Добавить' }}
        </button>
      </div>

      <div v-if="showPalette" class="add-palette">
        <button
          v-for="b in settings.planButtons"
          :key="b.id"
          class="add-ico plan-quick"
          :title="`Добавить план «${b.name}»`"
          @click="addPlan(b)"
        >
          <span class="ai-emoji">📌</span>
          <span class="ai-label">{{ b.name }}</span>
        </button>
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

      <!-- Сводка болезни этого дня -->
      <div v-if="selectedIllness" class="sick-summary">
        <div class="ss-head">🤒 {{ selectedIllness.name || 'Болезнь' }}</div>
        <div class="ss-line muted small">
          <template v-if="selectedMedNames.length">Лекарства: {{ selectedMedNames.join(', ') }}</template>
          <template v-else>Лекарства не указаны</template>
        </div>
      </div>

      <p v-if="selectedDay && !selectedEvents.length && !selectedIllness" class="muted small empty-note">В этот день событий нет.</p>
      <div v-for="e in selectedEvents" :key="e.id" class="ev-row">
        <button
          v-if="e.type === 'plan'"
          class="plan-check"
          :class="{ done: !e.planned }"
          :title="e.planned ? 'Отметить выполненным' : 'Вернуть в планы'"
          @click="togglePlanDone(e)"
        >{{ e.planned ? '' : '✓' }}</button>
        <span v-else class="ev-ico">{{ EVENT_TYPES[e.type]?.icon }}</span>
        <button class="grow ev-body" @click="sheetModel = e">
          <span class="ev-title" :class="{ done: e.type === 'plan' && !e.planned }">
            {{ eventLabel(e) }}<span v-if="e.planned && e.type !== 'plan'" class="plan-tag">· план</span>
          </span>
          <span v-if="detailOf(e)" class="muted small">{{ detailOf(e) }}</span>
        </button>
        <span class="muted small">{{ dayjs(e.startedAt).format('HH:mm') }}</span>
      </div>
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

/* День болезни — красным (важнее обычных событий, поэтому правило ниже по каскаду) */
.cell.sick .num {
  background: var(--c-urgent-soft);
  color: var(--c-urgent);
  font-weight: 800;
}

.cell.selected .num { outline: 2px solid var(--c-primary); }

.sick-summary {
  border: 1px solid var(--c-urgent);
  background: var(--c-urgent-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-bottom: 10px;
}

.ss-head { font-weight: 700; font-size: 14px; }
.ss-line { margin-top: 2px; }

.day-card { margin-top: 12px; }

.day-head {
  align-items: center;
  margin-bottom: 8px;
}

.day-add {
  flex-shrink: 0;
  min-height: 36px;
  padding: 6px 12px;
  font-size: 13px;
}

.day-add.active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
  color: var(--c-primary);
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

.plan-quick {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.plan-quick .ai-label { color: var(--c-primary); }

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
  text-align: left;
}

.plan-check {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--c-primary);
  color: var(--c-on-primary);
  font-size: 15px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-check.done { background: var(--c-primary); }

.ev-title.done {
  text-decoration: line-through;
  color: var(--c-text-soft);
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
