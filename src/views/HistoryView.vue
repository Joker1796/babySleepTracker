<script setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { formatDurationMin, plural, ageInMonths } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import { poopVerb } from '../logic/gender'
import { EVENT_TYPES, NON_SLEEP_TYPE_LIST, NON_CALENDAR_TYPE_LIST, CALENDAR_TYPE_IDS, eventKind, eventLabel } from '../data/eventTypes'
import { getNorms } from '../data/sleepNorms'
import { scheduleProfile, buildSchedule, minToHHMM, hhmmToMin } from '../logic/schedule'
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

const gender = computed(() => children.activeChild?.gender)
const poopWord = computed(() => poopVerb(gender.value))

// Строки плашки после четырёх постоянных: по типам событий, реально
// отмеченным в этот день (независимо от текущих настроек кнопок).
// Количество (мл) — суммой, температура (°C) — последним значением,
// интервальные — суммарным временем, точечные — количеством.
function countLabel(n) {
  return `${n} ${plural(n, 'раз', 'раза', 'раз')}`
}
const otherStats = computed(() => {
  const d = dayjs(dayTs.value)
  const rows = []
  for (const t of NON_SLEEP_TYPE_LIST) {
    const evs = events.sorted.filter(e => e.type === t.id && !e.planned && dayjs(e.startedAt).isSame(d, 'day'))
    if (!evs.length) continue
    const label = t.id === 'poop' ? poopWord.value : (t.btnLabel || t.label)
    let value
    if (t.amountUnit && t.amountAgg === 'sum') {
      const sum = evs.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      value = `${sum} ${t.amountUnit}`
    } else if (t.amountUnit && t.amountAgg === 'last') {
      const withAmt = evs.filter(e => e.amount != null)
      value = withAmt.length ? `${withAmt[withAmt.length - 1].amount} ${t.amountUnit}` : countLabel(evs.length)
    } else if (evs.some(e => eventKind(e) === 'interval')) {
      value = formatDurationMin(dayTotalMin(events.sorted, t.id, dayTs.value, now.value))
    } else {
      value = countLabel(dayCount(events.sorted, t.id, dayTs.value))
    }
    rows.push({ id: t.id, icon: EVENT_TYPES[t.id].icon, label, value })
  }
  return rows
})

// Аккордеон верхней плашки-сводки: первые 4 строки (сон) видны всегда,
// остальные (события дня) — сворачиваются под эту кнопку.
const showSummary = ref(false)

// ── Статистика за период ──
const days = ref(7)
const showStats = ref(false)

// Текущий день не включаем — статистика по завершённым дням (вчера и назад)
const stats = computed(() => {
  const result = []
  for (let i = days.value; i >= 1; i--) {
    const ts = dayjs(now.value).startOf('day').subtract(i, 'day').valueOf()
    result.push({ dayTs: ts, ...analyzeDay(events.sorted, ts, now.value) })
  }
  return result
})

const norms = computed(() => {
  if (!children.activeChild) return null
  return getNorms(ageInMonths(children.activeChild.birthDate, now.value))
})

// геометрия SVG-графика
const W = 340
const H = 190
const PAD = { top: 8, right: 6, bottom: 22, left: 26 }
const maxH = 20 // часов на шкале

const chartW = W - PAD.left - PAD.right
const chartH = H - PAD.top - PAD.bottom

function y(hours) {
  return PAD.top + chartH - (Math.min(hours, maxH) / maxH) * chartH
}

// Шаг подписей оси X: на длинных периодах показываем реже, чтобы не наложились
const labelStep = computed(() => (days.value <= 7 ? 1 : days.value <= 14 ? 2 : 5))

const bars = computed(() => {
  const n = stats.value.length
  const slot = chartW / n
  const barW = Math.min(slot * 0.62, 30)
  return stats.value.map((d, i) => {
    const x = PAD.left + slot * i + (slot - barW) / 2
    const nightH = d.nightSleepMin / 60
    const dayH = d.daySleepMin / 60
    return {
      x,
      barW,
      nightY: y(nightH),
      nightHpx: y(0) - y(nightH),
      dayY: y(nightH + dayH),
      dayHpx: y(nightH) - y(nightH + dayH),
      label: dayjs(d.dayTs).format('D.MM'),
      total: d.totalSleepMin
    }
  })
})

const gridLines = computed(() =>
  [4, 8, 12, 16, 20].map(h => ({ h, y: y(h) }))
)

const avg = computed(() => {
  const withData = stats.value.filter(d => d.totalSleepMin > 0)
  if (!withData.length) return null
  const total = withData.reduce((s, d) => s + d.totalSleepMin, 0) / withData.length
  const day = withData.reduce((s, d) => s + d.daySleepMin, 0) / withData.length
  const naps = withData.reduce((s, d) => s + d.napCount, 0) / withData.length
  return { total, day, naps: Math.round(naps * 10) / 10, daysCounted: withData.length }
})

const avgVerdict = computed(() => {
  if (!avg.value || !norms.value) return ''
  const [min, max] = norms.value.totalSleep
  if (avg.value.total < min - 30) return 'Суммарного сна в среднем меньше возрастной нормы — присмотритесь к подсказкам на главном экране.'
  if (avg.value.total > max + 30) return 'Сна в среднем больше нормы — если малыш бодр и весел, для младенцев это обычно не проблема.'
  return 'Суммарный сон в пределах возрастной нормы — отличная работа!'
})

// ── Метрика статистики: сон или один из реально отмеченных типов событий ──
// Служебные/врачебные типы в статистику не выводим.
const STATS_EXCLUDE = new Set([
  'doctor', 'vitaminD', 'temperature', 'vaccination', 'pool', 'club',
  'nails', 'bath', 'massage', 'feedLeft', 'feedRight', 'plan'
])
const metric = ref('sleep')
const usedEventTypes = computed(() => {
  const present = new Set(events.sorted.filter(e => !e.planned && e.type !== 'sleep').map(e => e.type))
  return NON_SLEEP_TYPE_LIST.filter(t => present.has(t.id) && !STATS_EXCLUDE.has(t.id))
})
const metricDef = computed(() => metric.value === 'sleep' ? null : EVENT_TYPES[metric.value])

function eventValueForDay(type, ts) {
  const def = EVENT_TYPES[type]
  if (def?.amountUnit && def.amountAgg === 'sum') {
    const d = dayjs(ts)
    return events.sorted
      .filter(e => e.type === type && !e.planned && dayjs(e.startedAt).isSame(d, 'day'))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0)
  }
  if (def?.kind === 'interval') return dayTotalMin(events.sorted, type, ts, now.value)
  return dayCount(events.sorted, type, ts)
}

const eventUnit = computed(() => {
  const def = metricDef.value
  if (!def) return ''
  if (def.amountUnit && def.amountAgg === 'sum') return def.amountUnit
  if (def.kind === 'interval') return 'мин'
  return 'раз'
})

const eventSeries = computed(() =>
  metric.value === 'sleep' ? [] : stats.value.map(d => ({ dayTs: d.dayTs, value: eventValueForDay(metric.value, d.dayTs) }))
)
const eventMax = computed(() => Math.max(1, ...eventSeries.value.map(s => s.value)))
const eventBars = computed(() => {
  const n = eventSeries.value.length || 1
  const slot = chartW / n
  const barW = Math.min(slot * 0.62, 30)
  return eventSeries.value.map((s, i) => {
    const h = (s.value / eventMax.value) * chartH
    return {
      x: PAD.left + slot * i + (slot - barW) / 2,
      barW,
      y: PAD.top + chartH - h,
      hpx: h,
      label: dayjs(s.dayTs).format('D.MM'),
      value: s.value
    }
  })
})
const eventAvg = computed(() => {
  const withData = eventSeries.value.filter(s => s.value > 0)
  if (!withData.length) return null
  return Math.round((withData.reduce((s, d) => s + d.value, 0) / withData.length) * 10) / 10
})

// Если выбранный тип события исчез из данных — вернуться к «Сон»
watch(usedEventTypes, (list) => {
  if (metric.value !== 'sleep' && !list.some(t => t.id === metric.value)) metric.value = 'sleep'
})

// ── Расписание дня ──
const showSchedule = ref(false)
// Выбор начала/конца дня (строки HH:MM). null → берётся из профиля.
// Ручной выбор сохраняется пер-ребёнок и переживает переход по вкладкам.
const wakeStr = ref(null)
const bedStr = ref(null)

function overKey(id) { return `schedOverride:${id}` }
function loadOverride(id) {
  try { return JSON.parse(localStorage.getItem(overKey(id))) || null } catch { return null }
}
function applyOverrideForChild() {
  const id = children.activeChild?.id
  const ov = id ? loadOverride(id) : null
  wakeStr.value = ov?.wake ?? null
  bedStr.value = ov?.bed ?? null
}
function saveSchedOverride() {
  const id = children.activeChild?.id
  if (!id) return
  localStorage.setItem(overKey(id), JSON.stringify({ wake: wakeStr.value, bed: bedStr.value }))
}
applyOverrideForChild()
watch(() => children.activeChild?.id, applyOverrideForChild)

const profile = computed(() =>
  scheduleProfile(events.sorted, now.value, days.value, children.activeChild)
)

// День, на который строим распорядок (по умолчанию — завтра)
const schedDate = ref(dayjs(now.value).add(1, 'day').format('YYYY-MM-DD'))

// Запланированные события выбранного дня → «якоря» бодрствования для расписания
const dayAnchors = computed(() => {
  const start = dayjs(schedDate.value).startOf('day')
  const end = start.add(1, 'day')
  return events.sorted
    .filter(e => e.planned && CALENDAR_TYPE_IDS.includes(e.type) &&
      e.startedAt >= start.valueOf() && e.startedAt < end.valueOf())
    .map(e => ({
      min: dayjs(e.startedAt).diff(start, 'minute'),
      label: eventLabel(e),
      icon: EVENT_TYPES[e.type]?.icon || '📌'
    }))
})

const schedule = computed(() =>
  buildSchedule(profile.value, {
    wakeMin: hhmmToMin(wakeStr.value),
    bedMin: hhmmToMin(bedStr.value),
    anchors: dayAnchors.value
  })
)

// Единый упорядоченный список для отрисовки: подъём → окна/сны/события → отбой
const schedRows = computed(() => {
  const s = schedule.value
  const rows = [{ kind: 'wake', hhmm: s.wake.hhmm }]
  const stops = [
    ...s.naps.map(n => ({ at: n.startMin, kind: 'nap', nap: n })),
    ...s.anchors.map(a => ({ at: a.min, kind: 'event', ev: a }))
  ].sort((x, y) => x.at - y.at)
  let prevEnd = s.wake.min
  let napIdx = 0
  for (const st of stops) {
    if (st.kind === 'nap') {
      rows.push({ kind: 'gap', min: st.nap.startMin - prevEnd })
      rows.push({ kind: 'nap', idx: ++napIdx, nap: st.nap })
      prevEnd = st.nap.endMin
    } else {
      rows.push({ kind: 'event', ev: st.ev })
    }
  }
  rows.push({ kind: 'gap', min: s.bedtime.min - prevEnd })
  rows.push({ kind: 'bed', hhmm: s.bedtime.hhmm })
  return rows
})

// Засечки времени на 24-часовой полосе
const timeTicks = [0, 6, 12, 18, 24]

function openSchedule() {
  if (wakeStr.value == null) wakeStr.value = minToHHMM(profile.value.wakeMin)
  if (bedStr.value == null) bedStr.value = minToHHMM(profile.value.bedMin)
  showStats.value = false
  showSchedule.value = true
}

function openStats() {
  showSchedule.value = false
  showStats.value = true
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
      <button class="day-arrow" @click="dayOffset--">‹</button>
      <div class="day-label">
        <h1>{{ dayLabel }}</h1>
        <span class="muted small">{{ dayjs(dayTs).format('D MMMM YYYY') }}</span>
      </div>
      <button class="day-arrow" :disabled="dayOffset >= 0" @click="dayOffset++">›</button>
    </div>

    <div class="card summary">
      <div class="summary-head-static">
        <b>Сводка за день</b>
      </div>
      <div class="report">
        <div class="rep-row">
          <span class="rep-label">Среднее бодрствование</span>
          <span class="rep-value">{{ summary.wakeWindowMin > 0 ? formatDurationMin(summary.wakeWindowMin) : '—' }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">Дневной сон</span>
          <span class="rep-value">{{ formatDurationMin(summary.daySleepMin) }} · {{ summary.napCount }} {{ plural(summary.napCount, 'сон', 'сна', 'снов') }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">Ночной сон</span>
          <span class="rep-value">{{ formatDurationMin(summary.nightSleepMin) }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label">Всего сна</span>
          <span class="rep-value">{{ formatDurationMin(summary.totalSleepMin) }}</span>
        </div>
        <template v-if="showSummary">
          <div v-for="r in otherStats" :key="r.id" class="rep-row">
            <span class="rep-label">{{ r.icon }} {{ r.label }}</span>
            <span class="rep-value">{{ r.value }}</span>
          </div>
        </template>
      </div>
      <button v-if="otherStats.length" class="summary-more" @click="showSummary = !showSummary">
        <span class="chev" :class="{ open: showSummary }">›</span>
        {{ showSummary ? 'Свернуть' : `Ещё ${otherStats.length} ${plural(otherStats.length, 'событие', 'события', 'событий')}` }}
      </button>
    </div>

    <!-- Распорядок дня -->
    <button v-if="!showSchedule" class="btn block schedule-open" @click="openSchedule">
      🗓️ Построить распорядок дня
    </button>

    <div v-if="showSchedule" class="card schedule">
      <div class="card-title">Распорядок дня</div>
      <p class="muted small src-note">
        {{ schedule.source === 'history'
          ? `На основе средних за ${schedule.daysCounted} ${plural(schedule.daysCounted, 'день', 'дня', 'дней')} с данными`
          : 'По возрастным нормам — данных о сне пока мало' }}
      </p>

      <label class="bound sched-day">
        <span>День (учитываются события из календаря на эту дату)</span>
        <input v-model="schedDate" type="date" />
      </label>

      <div class="day-bounds">
        <label class="bound">
          <span>Начало дня</span>
          <input v-model="wakeStr" type="time" @change="saveSchedOverride" />
        </label>
        <label class="bound">
          <span>Конец дня</span>
          <input v-model="bedStr" type="time" @change="saveSchedOverride" />
        </label>
      </div>

      <!-- 24-часовая полоса -->
      <div class="tl-wrap">
        <div class="tl-bar">
          <div
            v-for="(s, i) in schedule.segments"
            :key="i"
            class="tl-seg"
            :class="s.type"
            :style="{ left: `${(s.from / 1440) * 100}%`, width: `${((s.to - s.from) / 1440) * 100}%` }"
          ></div>
          <div
            v-for="(a, i) in schedule.anchors"
            :key="'a' + i"
            class="tl-anchor"
            :style="{ left: `${(a.min / 1440) * 100}%` }"
            :title="`${a.label} · ${a.hhmm}`"
          >{{ a.icon }}</div>
        </div>
        <div class="tl-ticks">
          <span v-for="t in timeTicks" :key="t" :style="{ left: `${(t / 24) * 100}%` }">{{ t }}</span>
        </div>
      </div>

      <div class="sched-list">
        <template v-for="(r, i) in schedRows" :key="i">
          <div v-if="r.kind === 'wake'" class="sched-row">
            <span class="sr-ico">☀️</span>
            <span class="sr-label">Подъём</span>
            <span class="sr-time">{{ r.hhmm }}</span>
          </div>
          <div v-else-if="r.kind === 'gap'" class="sched-gap muted small">бодрствование ~{{ formatDurationMin(r.min) }}</div>
          <div v-else-if="r.kind === 'nap'" class="sched-row">
            <span class="sr-ico">😴</span>
            <span class="sr-label">Сон {{ r.idx }} <span class="muted small">· {{ formatDurationMin(r.nap.durMin) }}</span></span>
            <span class="sr-time">{{ r.nap.startHHMM }}–{{ r.nap.endHHMM }}</span>
          </div>
          <div v-else-if="r.kind === 'event'" class="sched-row event">
            <span class="sr-ico">{{ r.ev.icon }}</span>
            <span class="sr-label">{{ r.ev.label }} <span class="muted small">· бодрствование</span></span>
            <span class="sr-time">{{ r.ev.hhmm }}</span>
          </div>
          <div v-else-if="r.kind === 'bed'" class="sched-row night">
            <span class="sr-ico">🌙</span>
            <span class="sr-label">Ночной сон</span>
            <span class="sr-time">{{ r.hhmm }}</span>
          </div>
        </template>
      </div>

      <p v-if="schedule.adjusted" class="muted small adjusted-note">🎯 Расписание подстроено под события из календаря — к их времени малыш бодрствует.</p>
      <p class="muted small" style="margin-top: 10px">Окна бодрствования короче с утра и длиннее к вечеру. Ориентир по средним, а не жёсткое правило — подстраивайте под признаки усталости малыша.</p>
    </div>

    <!-- Статистика -->
    <button v-if="!showStats" class="btn block schedule-open" @click="openStats">
      📊 Статистика
    </button>

    <template v-if="showStats">
      <div class="card-title stats-title">Статистика</div>
      <p class="muted small stats-note">По дням и средние за период (текущий день не учитывается).</p>
      <div class="row stats-controls">
        <select v-model="metric" class="period-select">
          <option value="sleep">😴 Сон</option>
          <option v-for="t in usedEventTypes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
        </select>
        <select v-model.number="days" class="period-select">
          <option :value="7">7 дней</option>
          <option :value="14">14 дней</option>
          <option :value="30">Месяц</option>
        </select>
      </div>

      <!-- Сон -->
      <template v-if="metric === 'sleep'">
        <div class="card">
          <div class="card-title">Сон по дням, часы</div>
          <svg :viewBox="`0 0 ${W} ${H}`" class="chart">
            <g v-for="line in gridLines" :key="line.h">
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="line.y" :y2="line.y" class="grid" />
              <text :x="PAD.left - 5" :y="line.y + 3" class="axis">{{ line.h }}</text>
            </g>

            <template v-if="norms">
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(norms.totalSleep[0] / 60)" :y2="y(norms.totalSleep[0] / 60)" class="norm" />
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(norms.totalSleep[1] / 60)" :y2="y(norms.totalSleep[1] / 60)" class="norm" />
            </template>

            <g v-for="(b, i) in bars" :key="i">
              <rect :x="b.x" :y="b.nightY" :width="b.barW" :height="b.nightHpx" rx="3" fill="var(--c-night-bar)" />
              <rect :x="b.x" :y="b.dayY" :width="b.barW" :height="b.dayHpx" rx="3" fill="var(--c-day-bar)" />
              <text v-if="i % labelStep === 0" :x="b.x + b.barW / 2" :y="H - 8" class="axis" text-anchor="middle">{{ b.label }}</text>
            </g>
          </svg>
          <div class="legend">
            <span class="leg-item"><span class="leg-dot" style="background: var(--c-night-bar)"></span>ночь</span>
            <span class="leg-item"><span class="leg-dot" style="background: var(--c-day-bar)"></span>день</span>
            <span class="leg-item"><span class="leg-line"></span>норма</span>
          </div>
        </div>

        <div v-if="avg" class="card">
          <div class="card-title">В среднем за {{ avg.daysCounted }} дн. с данными</div>
          <div class="avg-row"><span>Всего сна в сутки</span><b>{{ formatDurationMin(avg.total) }}</b></div>
          <div class="avg-row"><span>Дневной сон</span><b>{{ formatDurationMin(avg.day) }}</b></div>
          <div class="avg-row"><span>Дневных снов</span><b>{{ avg.naps }}</b></div>
          <div v-if="norms" class="avg-row"><span>Норма всего</span><b>{{ formatDurationMin(norms.totalSleep[0]) }} – {{ formatDurationMin(norms.totalSleep[1]) }}</b></div>
          <p class="muted small" style="margin-top: 8px">{{ avgVerdict }}</p>
        </div>

        <p v-else class="muted small" style="text-align: center">
          Пока нет данных — отмечайте сон на главном экране, и здесь появится картина недели.
        </p>
      </template>

      <!-- Другое событие -->
      <template v-else>
        <div class="card">
          <div class="card-title">{{ metricDef?.label }} по дням, {{ eventUnit }}</div>
          <svg :viewBox="`0 0 ${W} ${H}`" class="chart">
            <line :x1="PAD.left" :x2="W - PAD.right" :y1="PAD.top + chartH" :y2="PAD.top + chartH" class="grid" />
            <g v-for="(b, i) in eventBars" :key="i">
              <rect :x="b.x" :y="b.y" :width="b.barW" :height="b.hpx" rx="3" :fill="metricDef?.color || 'var(--c-primary)'" />
              <text v-if="i % labelStep === 0" :x="b.x + b.barW / 2" :y="H - 8" class="axis" text-anchor="middle">{{ b.label }}</text>
            </g>
          </svg>
          <p v-if="eventAvg != null" class="muted small" style="text-align: center; margin-top: 6px">
            В среднем {{ eventAvg }} {{ eventUnit }}/день
          </p>
          <p v-else class="muted small" style="text-align: center">Нет отметок за период.</p>
        </div>
      </template>
    </template>

    <!-- История событий за день -->
    <div class="card">
      <div class="card-title" style="margin-bottom: 10px">История событий</div>
      <button class="btn secondary block" style="margin-bottom: 12px" @click="addEvent">
        + Добавить событие
      </button>
      <TimelineDay :day-ts="dayTs" @edit="e => (sheetModel = e)" />
    </div>

    <EventEditSheet :model="sheetModel" :types="NON_CALENDAR_TYPE_LIST" @close="sheetModel = null" />
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

.summary-head-static {
  font-size: 15px;
}

.summary-more {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--c-border);
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-soft);
}

.summary-more .chev {
  font-size: 20px;
  line-height: 1;
  transition: transform 0.2s;
}

.summary-more .chev.open { transform: rotate(90deg); }

.report {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.rep-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
}

.rep-label { color: var(--c-text-soft); }
.rep-value { font-weight: 700; }

/* ── Выбор периода статистики ── */
.period-select {
  flex: 1;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text);
  font-size: 14px;
  font-weight: 600;
}

/* ── График статистики ── */
.chart {
  width: 100%;
  height: auto;
}

.grid {
  stroke: var(--c-border);
  stroke-width: 1;
}

.norm {
  stroke: var(--c-warn);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.8;
}

.axis {
  font-size: 9px;
  fill: var(--c-text-soft);
  text-anchor: end;
}

text.axis[text-anchor='middle'] { text-anchor: middle; }

.legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-text-soft);
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.leg-line {
  width: 16px;
  border-top: 2px dashed var(--c-warn);
}

.avg-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0;
}

/* ── Расписание на завтра ── */
.schedule-open {
  margin-bottom: 12px;
}

.src-note {
  margin: -4px 0 12px;
}

.stats-title { margin-bottom: 2px; }

.stats-note { margin: 0 0 10px; }

.stats-controls { margin-bottom: 12px; }

.sched-day { margin-bottom: 14px; }

.day-bounds {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.bound {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bound span {
  font-size: 13px;
  color: var(--c-text-soft);
}

.bound input {
  width: 100%;
}

/* 24-часовая полоса */
.tl-wrap {
  margin-bottom: 14px;
}

.tl-bar {
  position: relative;
  height: 22px;
  border-radius: 6px;
  background: var(--c-surface-2);
  overflow: hidden;
}

.tl-seg {
  position: absolute;
  top: 0;
  bottom: 0;
}

.tl-seg.night { background: var(--c-night-bar); }
.tl-seg.day { background: var(--c-day-bar); }

.tl-anchor {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  line-height: 1;
  filter: drop-shadow(0 0 2px var(--c-surface));
  pointer-events: none;
}

.tl-ticks {
  position: relative;
  height: 14px;
  margin-top: 2px;
}

.tl-ticks span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 9px;
  color: var(--c-text-soft);
}

.tl-ticks span:first-child { transform: none; }
.tl-ticks span:last-child { transform: translateX(-100%); }

.sched-list {
  display: flex;
  flex-direction: column;
}

.sched-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
}

.sched-row.night {
  background: var(--c-primary-soft);
}

.sched-row.event {
  background: var(--c-warn-soft);
  outline: 1px solid var(--c-warn);
}

.adjusted-note { margin-top: 10px; }

.sr-ico { font-size: 18px; }

.sr-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}

.sr-time {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sched-gap {
  padding: 3px 0 3px 40px;
  position: relative;
}

.sched-gap::before {
  content: '';
  position: absolute;
  left: 19px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--c-border);
}
</style>
