<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { formatDurationMin, plural, ageInMonths } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import { summarizeDay } from '../logic/daySummary'
import { poopVerb } from '../logic/gender'
import TimelineDay from '../components/TimelineDay.vue'
import EventEditSheet from '../components/EventEditSheet.vue'

const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

const dayOffset = ref(0)
const sheetModel = ref(null)

const dayTs = computed(() => dayjs(now.value).startOf('day').add(dayOffset.value, 'day').valueOf())

const dayLabel = computed(() => {
  if (dayOffset.value === 0) return 'Сегодня'
  if (dayOffset.value === -1) return 'Вчера'
  return dayjs(dayTs.value).format('D MMMM, dd')
})

const summary = computed(() => analyzeDay(events.sorted, dayTs.value, now.value))

const tummyMin = computed(() => dayTotalMin(events.sorted, 'tummy', dayTs.value, now.value))
const poopCount = computed(() => dayCount(events.sorted, 'poop', dayTs.value))

const isToday = computed(() => dayOffset.value === 0)
const gender = computed(() => children.activeChild?.gender)
const poopWord = computed(() => poopVerb(gender.value))

const summaryText = computed(() => {
  const child = children.activeChild
  const ageM = child ? ageInMonths(child.birthDate, dayTs.value) : 6
  return summarizeDay({
    summary: summary.value,
    tummyMin: tummyMin.value,
    poopCount: poopCount.value,
    ageM,
    isToday: isToday.value,
    gender: gender.value
  })
})

function addEvent() {
  const base = dayOffset.value === 0
    ? simNow()
    : dayjs(dayTs.value).add(12, 'hour').valueOf()
  sheetModel.value = { isNew: true, type: 'sleep', startedAt: base }
}
</script>

<template>
  <div class="page">
    <div class="day-nav">
      <button class="day-arrow" @click="dayOffset--">‹</button>
      <div class="day-label">
        <h1>{{ dayLabel }}</h1>
        <span class="muted small">{{ dayjs(dayTs).format('D MMMM YYYY') }}</span>
      </div>
      <button class="day-arrow" :disabled="dayOffset >= 0" @click="dayOffset++">›</button>
    </div>

    <div class="card summary">
      <div class="report">
        <div class="rep-row">
          <span class="rep-label">Всего сна</span>
          <span class="rep-value">{{ formatDurationMin(summary.totalSleepMin) }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">Ночной сон</span>
          <span class="rep-value">{{ formatDurationMin(summary.nightSleepMin) }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">Дневной сон</span>
          <span class="rep-value">{{ formatDurationMin(summary.daySleepMin) }} · {{ summary.napCount }} {{ plural(summary.napCount, 'сон', 'сна', 'снов') }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">👶 На животе</span>
          <span class="rep-value">{{ tummyMin > 0 ? formatDurationMin(tummyMin) : '—' }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">💩 {{ poopWord }}</span>
          <span class="rep-value">{{ poopCount }} {{ plural(poopCount, 'раз', 'раза', 'раз') }}</span>
        </div>
      </div>
      <p class="summary-text">{{ summaryText }}</p>
    </div>

    <div class="card">
      <TimelineDay :day-ts="dayTs" @edit="e => (sheetModel = e)" />
      <button class="btn secondary block" style="margin-top: 10px" @click="addEvent">
        + Добавить событие
      </button>
    </div>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.day-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px;
}

.day-label {
  flex: 1;
  text-align: center;
}

.day-label h1 { margin: 0; font-size: 19px; }

.day-arrow {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--c-surface);
  box-shadow: var(--shadow);
  font-size: 24px;
  color: var(--c-primary);
}

.day-arrow:disabled {
  opacity: 0.35;
}

.report {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.rep-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
}

.rep-label { color: var(--c-text-soft); }
.rep-value { font-weight: 700; }

.summary-text {
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--c-border);
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--c-text);
}
</style>
