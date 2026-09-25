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
import Icon from '../components/Icon.vue'

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
      <button class="arrow" aria-label="Предыдущий месяц" @click="prevMonth"><Icon name="chevron-left" :size="22" /></button>
      <h1 class="cal-title">{{ monthTitle }}</h1>
      <button class="arrow" aria-label="Следующий месяц" @click="nextMonth"><Icon name="chevron-right" :size="22" /></button>
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
            :aria-pressed="!!isSelected(c)"
            :aria-label="`${month.date(c).format('D MMMM')}${daySick(c) ? ', болезнь' : ''}${dayDone(c) ? ', есть события' : ''}${dayPlanned(c) ? ', есть планы' : ''}`"
            @click="selectDay(c)"
          >
            <span class="dnum num">{{ c }}</span>
          </button>
        </template>
      </div>
    </div>

    <div class="card day-card">
      <div class="row day-head">
        <h2 class="grow day-title">{{ selectedDay ? selectedDay.format('D MMMM') : 'Сегодня' }}</h2>
        <button
          class="btn secondary day-add"
          :class="{ active: showPalette }"
          :aria-expanded="showPalette"
          :aria-label="showPalette ? 'Закрыть выбор' : 'Добавить событие'"
          @click="showPalette = !showPalette"
        >
          <template v-if="showPalette"><Icon name="close" :size="18" /></template>
          <template v-else><Icon name="plus" :size="18" /> Добавить</template>
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
          <Icon name="pin" :size="22" class="ai-icon" />
          <span class="ai-label">{{ b.name }}</span>
        </button>
        <button
          v-for="t in CALENDAR_TYPE_LIST"
          :key="t.id"
          class="add-ico"
          :title="t.label"
          @click="addType(t.id)"
        >
          <Icon :name="t.iconName" :size="22" class="ai-icon" />
          <span class="ai-label">{{ t.btnLabel || t.label }}</span>
        </button>
      </div>

      <!-- Сводка болезни этого дня -->
      <div v-if="selectedIllness" class="sick-summary">
        <div class="ss-head"><Icon name="thermometer" :size="18" /> {{ selectedIllness.name || 'Болезнь' }}</div>
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
          :aria-pressed="!e.planned"
          :aria-label="e.planned ? 'Отметить выполненным' : 'Вернуть в планы'"
          @click="togglePlanDone(e)"
        ><span class="plan-box"><Icon v-if="!e.planned" name="check" :size="16" /></span></button>
        <Icon v-else :name="EVENT_TYPES[e.type]?.iconName || 'pin'" :size="20" class="ev-ico" />
        <button class="grow ev-body" @click="sheetModel = e">
          <span class="ev-title" :class="{ done: e.type === 'plan' && !e.planned }">
            {{ eventLabel(e) }}<span v-if="e.planned && e.type !== 'plan'" class="plan-tag">· план</span>
          </span>
          <span v-if="detailOf(e)" class="muted small">{{ detailOf(e) }}</span>
        </button>
        <span class="muted small num">{{ dayjs(e.startedAt).format('HH:mm') }}</span>
      </div>
    </div>

    <EventEditSheet :model="sheetModel" :types="CALENDAR_TYPE_LIST" allow-plan @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.cal-nav {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0 var(--sp-3);
}

.cal-title {
  flex: 1;
  text-align: center;
  margin: 0;
  font-size: var(--fs-xl);
}

/* Первая буква месяца заглавная, без капса всего слова */
.cal-title::first-letter { text-transform: uppercase; }

.arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  color: var(--c-text);
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--sp-1);
}

.weekdays { margin-bottom: 6px; }

.wd {
  text-align: center;
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-text-soft);
}

.cell {
  min-height: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  border-radius: var(--radius-sm);
  background: transparent;
}

.cell.empty { visibility: hidden; }

.dnum {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text);
}

/* Было событие — залито чернилами */
.cell.event .dnum {
  background: var(--c-primary);
  color: var(--c-on-primary);
}

/* Только запланировано — пунктирная обводка */
.cell.planned .dnum {
  border: 1.5px dashed var(--c-text);
}

/* День болезни — «срочным» цветом (правило ниже по каскаду — важнее событий) */
.cell.sick .dnum {
  background: var(--c-urgent-soft);
  color: var(--c-urgent);
  border: 1px solid var(--c-urgent);
}

.cell.selected .dnum {
  outline: 2px solid var(--c-accent);
  outline-offset: 1px;
}

.sick-summary {
  border: 1px solid var(--c-urgent);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  margin-bottom: var(--sp-3);
}

.ss-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: var(--c-urgent);
}
.ss-line { margin-top: 2px; }

.day-card { margin-top: var(--sp-3); }

.day-head {
  align-items: center;
  margin-bottom: var(--sp-2);
}

.day-title { margin: 0; font-size: var(--fs-lg); }

.day-add {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: var(--fs-sm);
}

.day-add.active {
  border-color: var(--c-text);
}

.add-palette {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

/* Контурные плитки выбора типа */
.add-ico {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: var(--sp-2) 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  min-height: 64px;
}

.add-ico:active { opacity: 0.7; }

.ai-icon { color: var(--c-text); }

.ai-label {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-text-soft);
  text-align: center;
  line-height: 1.15;
  word-break: break-word;
}

.empty-note { padding: var(--sp-1) 0; }

/* Свои кнопки-планы — обводка чернилами, чтобы отличались от типов */
.plan-quick { border-color: var(--c-text); }
.plan-quick .ai-label { color: var(--c-text); }

.ev-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  text-align: left;
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--c-border);
  min-height: 52px;
}

.ev-row:last-child { border-bottom: none; }

.ev-ico { flex-shrink: 0; color: var(--c-text-soft); }

.ev-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  text-align: left;
  min-height: 44px;
  justify-content: center;
}

/* Галочка плана: касание 44px, видимый квадрат 24px */
.plan-check {
  width: 44px;
  height: 44px;
  margin: 0 -10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-box {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--c-text);
  color: var(--c-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.plan-check.done .plan-box { background: var(--c-primary); border-color: var(--c-primary); }

.ev-title {
  font-weight: 500;
  font-size: var(--fs-base);
}

.ev-title.done {
  text-decoration: line-through;
  color: var(--c-text-soft);
}

.plan-tag {
  margin-left: 6px;
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-text-soft);
}
</style>
