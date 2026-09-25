<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { formatDurationMin, plural } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import { poopVerb } from '../logic/gender'
import TimelineDay from '../components/TimelineDay.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import Icon from '../components/Icon.vue'

const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()
const router = useRouter()

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

const gender = computed(() => children.activeChild?.gender)
const poopWord = computed(() => poopVerb(gender.value))

function goSchedule() {
  router.push({ name: 'stats', query: { schedule: '1' } })
}

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
      <button class="day-arrow" @click="dayOffset--" aria-label="Предыдущий день">
        <Icon name="chevron-left" />
      </button>
      <div class="day-label">
        <h1>{{ dayLabel }}</h1>
        <span class="muted small">{{ dayjs(dayTs).format('D MMMM YYYY') }}</span>
      </div>
      <button class="day-arrow" :disabled="dayOffset >= 0" @click="dayOffset++" aria-label="Следующий день">
        <Icon name="chevron-right" />
      </button>
    </div>

    <section class="summary">
      <div class="total">
        <span class="total-value serif num">{{ formatDurationMin(summary.totalSleepMin) }}</span>
        <span class="muted">сна за день</span>
      </div>
      <div class="rep-row">
        <span class="rep-label"><Icon name="moon" :size="18" /> Ночной сон</span>
        <span class="rep-value num">{{ formatDurationMin(summary.nightSleepMin) }}</span>
      </div>
      <div class="rep-row">
        <span class="rep-label"><Icon name="sun" :size="18" /> Дневной сон</span>
        <span class="rep-value num">{{ formatDurationMin(summary.daySleepMin) }} · {{ summary.napCount }} {{ plural(summary.napCount, 'сон', 'сна', 'снов') }}</span>
      </div>
      <div class="rep-row">
        <span class="rep-label"><Icon name="tummy" :size="18" /> На животе</span>
        <span class="rep-value num">{{ tummyMin > 0 ? formatDurationMin(tummyMin) : '—' }}</span>
      </div>
      <div class="rep-row">
        <span class="rep-label"><Icon name="diaper" :size="18" /> {{ poopWord }}</span>
        <span class="rep-value num">{{ poopCount }} {{ plural(poopCount, 'раз', 'раза', 'раз') }}</span>
      </div>
      <button class="btn secondary block schedule-btn" @click="goSchedule">
        <Icon name="calendar" :size="18" /> Построить расписание на завтра
      </button>
    </section>

    <section class="events">
      <h2 class="section-title">События</h2>
      <TimelineDay :day-ts="dayTs" @edit="e => (sheetModel = e)" />
      <button class="btn secondary block add-btn" @click="addEvent">
        <Icon name="plus" :size="18" /> Добавить событие
      </button>
    </section>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.day-nav {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0 var(--sp-3);
}

.day-label {
  flex: 1;
  text-align: center;
}

.day-label h1 { margin: 0; }

.day-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--c-border);
  color: var(--c-text);
}

.day-arrow:disabled { opacity: 0.35; }

.summary { padding: 0 var(--sp-1); }

.total {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: var(--sp-2) 0 var(--sp-3);
}

.total-value {
  font-size: var(--fs-xl);
  font-weight: 500;
}

.rep-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  min-height: 44px;
  border-top: 1px solid var(--c-border);
}

.rep-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--c-text-soft);
}

.rep-value { font-weight: 500; text-align: right; }

.schedule-btn { margin-top: var(--sp-3); }

.events { margin-top: var(--sp-5); }

.section-title {
  font-size: var(--fs-lg);
  margin: 0 0 var(--sp-1);
}

.add-btn { margin-top: var(--sp-3); }
</style>
