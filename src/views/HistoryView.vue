<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useNow, simNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { formatDurationMin } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import TimelineDay from '../components/TimelineDay.vue'
import EventEditSheet from '../components/EventEditSheet.vue'

const events = useEventsStore()
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
      <div class="sum-item">
        <span class="sum-value">{{ formatDurationMin(summary.totalSleepMin) }}</span>
        <span class="muted small">всего сна</span>
      </div>
      <div class="sum-item">
        <span class="sum-value">{{ formatDurationMin(summary.daySleepMin) }}</span>
        <span class="muted small">днём</span>
      </div>
      <div class="sum-item">
        <span class="sum-value">{{ summary.napCount }}</span>
        <span class="muted small">дневных снов</span>
      </div>
      <div class="sum-item">
        <span class="sum-value">🤸 {{ tummyMin > 0 ? formatDurationMin(tummyMin) : '—' }}</span>
        <span class="muted small">на животе</span>
      </div>
      <div class="sum-item">
        <span class="sum-value">💩 {{ poopCount }}</span>
        <span class="muted small">покакал</span>
      </div>
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

.summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  gap: 10px 4px;
  text-align: center;
}

.sum-item {
  display: flex;
  flex-direction: column;
  flex: 1 0 30%;
}

.sum-value {
  font-size: 17px;
  font-weight: 700;
}
</style>
