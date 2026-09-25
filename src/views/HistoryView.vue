<script setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { formatDurationMin, plural } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import { poopVerb } from '../logic/gender'
import { EVENT_TYPES, NON_SLEEP_TYPE_LIST, NON_CALENDAR_TYPE_LIST, CALENDAR_TYPE_IDS, eventKind, eventLabel } from '../data/eventTypes'
import { effectiveNorms, normsAgeM } from '../logic/norms'
import { averageStats, normVerdict } from '../logic/stats'
import { scheduleProfile, buildSchedule, minToHHMM, hhmmToMin } from '../logic/schedule'
import TimelineDay from '../components/TimelineDay.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import Icon from '../components/Icon.vue'

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
    rows.push({ id: t.id, iconName: t.iconName || 'star', color: t.color, label, value })
  }
  return rows
})

// Аккордеон верхней плашки-сводки: первые 4 строки (сон) видны всегда,
// остальные (события дня) — сворачиваются под эту кнопку.
const showSummary = ref(false)

// ── Статистика за период ──
const days = ref(7)
const showStats = ref(false)

// Текущий день не включаем — статистика по завершённым дням (вчера и назад).
// День с неполными данными (сна не было вовсе, либо какая-то сессия сна
// за этот день ещё не закрыта — не отмечено пробуждение) в статистику не идёт.
const stats = computed(() => {
  const result = []
  for (let i = days.value; i >= 1; i--) {
    const ts = dayjs(now.value).startOf('day').subtract(i, 'day').valueOf()
    const day = analyzeDay(events.sorted, ts, now.value)
    const complete = day.totalSleepMin > 0 && !day.sessions.some(s => s.endedAt == null)
    if (complete) result.push({ dayTs: ts, ...day })
  }
  return result
})

// Нормы — возрастные (по корректированному возрасту) или свой режим
const norms = computed(() => {
  if (!children.activeChild) return null
  return effectiveNorms(children.activeChild, now.value)
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

// Средние — только по полным завершённым дням (см. stats выше)
const avg = computed(() => averageStats(stats.value))

const avgVerdict = computed(() =>
  normVerdict(avg.value, norms.value, children.activeChild ? normsAgeM(children.activeChild, now.value) : 6)
)

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
  try { localStorage.setItem(overKey(id), JSON.stringify({ wake: wakeStr.value, bed: bedStr.value })) } catch {}
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
      icon: EVENT_TYPES[e.type]?.icon || '📌',
      iconName: EVENT_TYPES[e.type]?.iconName || 'pin'
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
  let napIdx = 0
  for (const st of stops) {
    if (st.kind === 'nap') {
      rows.push({ kind: 'gap', min: st.nap.wwBeforeMin })
      rows.push({ kind: 'nap', idx: ++napIdx, nap: st.nap })
    } else {
      rows.push({ kind: 'event', ev: st.ev })
    }
  }
  rows.push({ kind: 'gap', min: s.wwBeforeBedMin })
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
      <button class="day-arrow" aria-label="Предыдущий день" @click="dayOffset--">
        <Icon name="chevron-left" />
      </button>
      <div class="day-label">
        <h1>{{ dayLabel }}</h1>
        <span class="muted small">{{ dayjs(dayTs).format('D MMMM YYYY') }}</span>
      </div>
      <button class="day-arrow" :disabled="dayOffset >= 0" aria-label="Следующий день" @click="dayOffset++">
        <Icon name="chevron-right" />
      </button>
    </div>

    <section class="summary">
      <h2 class="section-title">Сводка за день</h2>
      <div class="report">
        <div class="rep-row">
          <span class="rep-label"><Icon name="hourglass" :size="18" /> Среднее бодрствование</span>
          <span class="rep-value num">{{ summary.wakeWindowMin > 0 ? formatDurationMin(summary.wakeWindowMin) : '—' }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label"><Icon name="sun" :size="18" /> Дневной сон</span>
          <span class="rep-value num">{{ formatDurationMin(summary.daySleepMin) }} · {{ summary.napCount }} {{ plural(summary.napCount, 'сон', 'сна', 'снов') }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label"><Icon name="moon" :size="18" /> Ночной сон</span>
          <span class="rep-value num">{{ formatDurationMin(summary.nightSleepMin) }}</span>
        </div>
        <div class="rep-row">
          <span class="rep-label"><Icon name="clock" :size="18" /> Всего сна</span>
          <span class="rep-value num">{{ formatDurationMin(summary.totalSleepMin) }}</span>
        </div>
        <template v-if="showSummary">
          <div v-for="r in otherStats" :key="r.id" class="rep-row">
            <span class="rep-label"><Icon :name="r.iconName" :size="18" :style="{ color: r.color }" /> {{ r.label }}</span>
            <span class="rep-value num">{{ r.value }}</span>
          </div>
        </template>
      </div>
      <button
        v-if="otherStats.length"
        class="summary-more"
        :aria-expanded="showSummary"
        @click="showSummary = !showSummary"
      >
        <Icon name="chevron-right" :size="18" class="chev" :class="{ open: showSummary }" />
        {{ showSummary ? 'Свернуть' : `Ещё ${otherStats.length} ${plural(otherStats.length, 'событие', 'события', 'событий')}` }}
      </button>
    </section>

    <!-- Распорядок дня -->
    <button v-if="!showSchedule" class="btn secondary block schedule-open" @click="openSchedule">
      <Icon name="calendar" :size="18" /> Построить распорядок дня
    </button>

    <div v-if="showSchedule" class="card schedule">
      <h2 class="section-title">Распорядок дня</h2>
      <p class="muted small src-note">
        {{ schedule.source === 'history'
          ? `На основе средних за ${schedule.daysCounted} ${plural(schedule.daysCounted, 'день', 'дня', 'дней')} с данными`
          : 'По возрастным нормам — данных о сне пока мало' }}
      </p>

      <label class="bound sched-day">
        <span>День (учитываются события из календаря на эту дату)</span>
        <input v-model="schedDate" type="date" class="num" />
      </label>

      <div class="day-bounds">
        <label class="bound">
          <span>Начало дня</span>
          <input v-model="wakeStr" type="time" class="num" @change="saveSchedOverride" />
        </label>
        <label class="bound">
          <span>Конец дня</span>
          <input v-model="bedStr" type="time" class="num" @change="saveSchedOverride" />
        </label>
      </div>

      <p v-if="schedule.warning" class="small sched-warning">
        <Icon name="alert" :size="16" class="warn-ico" />
        <span>{{ schedule.warning }}</span>
      </p>

      <!-- 24-часовая полоса -->
      <div class="tl-wrap" aria-hidden="true">
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
          ><Icon :name="a.iconName || 'pin'" :size="12" /></div>
        </div>
        <div class="tl-ticks num">
          <span v-for="t in timeTicks" :key="t" :style="{ left: `${(t / 24) * 100}%` }">{{ t }}</span>
        </div>
      </div>

      <!-- Вертикальный таймлайн: тонкая линия и отметки -->
      <div class="sched-list">
        <template v-for="(r, i) in schedRows" :key="i">
          <div v-if="r.kind === 'wake'" class="sched-row">
            <span class="sr-ico wake"><Icon name="sun" :size="18" /></span>
            <span class="sr-label">Подъём</span>
            <span class="sr-time num">{{ r.hhmm }}</span>
          </div>
          <div v-else-if="r.kind === 'gap'" class="sched-gap muted small">бодрствование ~{{ formatDurationMin(r.min) }}</div>
          <div v-else-if="r.kind === 'nap'" class="sched-row">
            <span class="sr-ico nap"><Icon name="star" :size="16" /></span>
            <span class="sr-label">Сон {{ r.idx }} <span class="muted small num">· {{ formatDurationMin(r.nap.durMin) }}</span></span>
            <span class="sr-time num">{{ r.nap.startHHMM }}–{{ r.nap.endHHMM }}</span>
          </div>
          <div v-else-if="r.kind === 'event'" class="sched-row event">
            <span class="sr-ico ev"><Icon :name="r.ev.iconName || 'pin'" :size="16" /></span>
            <span class="sr-label">{{ r.ev.label }} <span class="muted small">· бодрствование</span></span>
            <span class="sr-time num">{{ r.ev.hhmm }}</span>
          </div>
          <div v-else-if="r.kind === 'bed'" class="sched-row">
            <span class="sr-ico night"><Icon name="moon" :size="18" /></span>
            <span class="sr-label">Ночной сон</span>
            <span class="sr-time num">{{ r.hhmm }}</span>
          </div>
        </template>
      </div>

      <p v-if="schedule.anchorsAdjusted" class="muted small adjusted-note">
        <Icon name="calendar" :size="14" /> Расписание подстроено под события из календаря — к их времени малыш бодрствует.
      </p>
      <p class="muted small sched-foot">Окна бодрствования короче с утра и длиннее к вечеру. Ориентир по средним, а не жёсткое правило — подстраивайте под признаки усталости малыша.</p>
    </div>

    <!-- Статистика -->
    <button v-if="!showStats" class="btn secondary block schedule-open" @click="openStats">
      <Icon name="chart" :size="18" /> Статистика
    </button>

    <template v-if="showStats">
      <h2 class="section-title stats-title">Статистика</h2>
      <p class="muted small stats-note">По дням и средние за период (текущий день и дни с неполными данными не учитываются).</p>
      <div class="row stats-controls">
        <select v-model="metric" class="period-select" aria-label="Показатель">
          <option value="sleep">😴 Сон</option>
          <option v-for="t in usedEventTypes" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
        </select>
        <select v-model.number="days" class="period-select" aria-label="Период">
          <option :value="7">7 дней</option>
          <option :value="14">14 дней</option>
          <option :value="30">Месяц</option>
        </select>
      </div>

      <!-- Сон -->
      <template v-if="metric === 'sleep'">
        <div class="card">
          <div class="card-title">Сон по дням, часы</div>
          <svg :viewBox="`0 0 ${W} ${H}`" class="chart" role="img" aria-label="Сон по дням: ночной и дневной, в часах">
            <g v-for="line in gridLines" :key="line.h">
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="line.y" :y2="line.y" class="grid" />
              <text :x="PAD.left - 5" :y="line.y + 3" class="axis">{{ line.h }}</text>
            </g>

            <g v-for="(b, i) in bars" :key="i">
              <rect :x="b.x" :y="b.nightY" :width="b.barW" :height="b.nightHpx" rx="2" class="bar-night" />
              <rect :x="b.x" :y="b.dayY" :width="b.barW" :height="b.dayHpx" rx="2" class="bar-day" />
              <text v-if="i % labelStep === 0" :x="b.x + b.barW / 2" :y="H - 6" class="axis mid">{{ b.label }}</text>
            </g>

            <template v-if="norms">
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(norms.totalSleep[0] / 60)" :y2="y(norms.totalSleep[0] / 60)" class="norm" />
              <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(norms.totalSleep[1] / 60)" :y2="y(norms.totalSleep[1] / 60)" class="norm" />
            </template>
          </svg>
          <div class="legend">
            <span class="leg-item"><span class="leg-dot night"></span>ночь</span>
            <span class="leg-item"><span class="leg-dot day"></span>день</span>
            <span v-if="norms" class="leg-item"><span class="leg-line"></span>{{ norms.custom ? 'цель' : 'норма' }}</span>
          </div>
        </div>

        <section v-if="avg" class="avg">
          <div class="avg-head">
            <span class="avg-big serif num">{{ formatDurationMin(avg.total) }}</span>
            <span class="muted">сна в сутки</span>
          </div>
          <p class="muted small avg-note">В среднем за {{ avg.daysCounted }} дн. с полными данными.</p>
          <div class="avg-row"><span class="muted">Дневной сон</span><span class="num">{{ formatDurationMin(avg.day) }}</span></div>
          <div class="avg-row"><span class="muted">Дневных снов</span><span class="num">{{ avg.naps }}</span></div>
          <div v-if="norms" class="avg-row">
            <span class="muted">{{ norms.custom ? 'Цель по режиму' : 'Норма всего' }}</span>
            <span class="num">{{ formatDurationMin(norms.totalSleep[0]) }} – {{ formatDurationMin(norms.totalSleep[1]) }}</span>
          </div>
          <p class="verdict">{{ avgVerdict }}</p>
        </section>

        <p v-else class="muted small empty-note">
          Пока нет данных — отмечайте сон на главном экране, и здесь появится картина недели.
        </p>
      </template>

      <!-- Другое событие -->
      <template v-else>
        <div class="card">
          <div class="card-title">{{ metricDef?.label }} по дням, {{ eventUnit }}</div>
          <svg :viewBox="`0 0 ${W} ${H}`" class="chart" role="img" :aria-label="`${metricDef?.label} по дням`">
            <line :x1="PAD.left" :x2="W - PAD.right" :y1="PAD.top + chartH" :y2="PAD.top + chartH" class="grid" />
            <g v-for="(b, i) in eventBars" :key="i">
              <rect :x="b.x" :y="b.y" :width="b.barW" :height="b.hpx" rx="2" :fill="metricDef?.color || 'var(--c-primary)'" />
              <text v-if="i % labelStep === 0" :x="b.x + b.barW / 2" :y="H - 6" class="axis mid">{{ b.label }}</text>
            </g>
          </svg>
          <p v-if="eventAvg != null" class="muted small event-avg">
            В среднем <span class="num">{{ eventAvg }}</span> {{ eventUnit }}/день
          </p>
          <p v-else class="muted small event-avg">Нет отметок за период.</p>
        </div>
      </template>
    </template>

    <!-- История событий за день -->
    <section class="events">
      <h2 class="section-title">История событий</h2>
      <button class="btn secondary block add-btn" @click="addEvent">
        <Icon name="plus" :size="18" /> Добавить событие
      </button>
      <TimelineDay :day-ts="dayTs" @edit="e => (sheetModel = e)" />
    </section>

    <EventEditSheet :model="sheetModel" :types="NON_CALENDAR_TYPE_LIST" @close="sheetModel = null" />
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

.section-title {
  font-family: var(--font-serif);
  font-size: var(--fs-lg);
  font-weight: 500;
  margin: 0 0 var(--sp-2);
}

/* ── Сводка за день: строки с разделителями ── */
.summary {
  padding: 0 var(--sp-1);
  margin-bottom: var(--sp-4);
}

.report {
  display: flex;
  flex-direction: column;
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

.summary-more {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: 44px;
  border-top: 1px solid var(--c-border);
  text-align: left;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text-soft);
}

.summary-more .chev { transition: transform 0.2s; }
.summary-more .chev.open { transform: rotate(90deg); }

.schedule-open { margin-bottom: var(--sp-3); }

/* ── Статистика ── */
.stats-title { margin-bottom: var(--sp-1); }
.stats-note { margin: 0 0 var(--sp-3); }
.stats-controls { margin-bottom: var(--sp-3); }

.period-select {
  flex: 1;
  min-height: 44px;
  font-size: var(--fs-sm);
  font-weight: 500;
}

.chart {
  width: 100%;
  height: auto;
  overflow: visible;
}

.grid {
  stroke: var(--c-border);
  stroke-width: 1;
}

.bar-night { fill: var(--c-night-bar); }
.bar-day { fill: var(--c-day-bar); }

.norm {
  stroke: var(--c-accent);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.axis {
  font-family: var(--font-sans);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  fill: var(--c-text-soft);
  text-anchor: end;
}

.axis.mid { text-anchor: middle; }

.legend {
  display: flex;
  gap: var(--sp-4);
  justify-content: center;
  margin-top: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.leg-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.leg-dot.night { background: var(--c-night-bar); }
.leg-dot.day { background: var(--c-day-bar); }

.leg-line {
  width: 16px;
  border-top: 2px dashed var(--c-accent);
}

.event-avg {
  text-align: center;
  margin: var(--sp-2) 0 0;
}

/* Средние: крупная цифра и строки с разделителями, без карточки */
.avg {
  padding: var(--sp-2) var(--sp-1) 0;
  margin-bottom: var(--sp-5);
}

.avg-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}

.avg-big {
  font-size: var(--fs-xl);
  font-weight: 500;
  line-height: 1.2;
}

.avg-note { margin: var(--sp-1) 0 var(--sp-3); }

.avg-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  min-height: 44px;
  border-top: 1px solid var(--c-border);
}

.avg-row .num { font-weight: 500; text-align: right; }

.verdict {
  margin: 0;
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border);
  font-family: var(--font-serif);
  font-style: italic;
  line-height: 1.55;
  color: var(--c-text-soft);
}

.empty-note {
  text-align: center;
  margin: var(--sp-2) var(--sp-4) var(--sp-4);
}

/* ── Распорядок дня ── */
.src-note { margin: calc(-1 * var(--sp-1)) 0 var(--sp-3); }

.sched-day { margin-bottom: var(--sp-3); }

.day-bounds {
  display: flex;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.bound {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  margin: 0;
}

.bound span {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.bound input { width: 100%; }

.sched-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  background: var(--c-warn-soft);
  line-height: 1.4;
}

.warn-ico { margin-top: 1px; color: var(--c-warn); flex-shrink: 0; }

/* 24-часовая полоса */
.tl-wrap { margin-bottom: var(--sp-4); }

.tl-bar {
  position: relative;
  height: 18px;
  border-radius: 4px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--c-surface);
  color: var(--c-accent);
  pointer-events: none;
}

.tl-ticks {
  position: relative;
  height: 16px;
  margin-top: var(--sp-1);
}

.tl-ticks span {
  position: absolute;
  transform: translateX(-50%);
  font-size: var(--fs-xs);
  color: var(--c-text-soft);
}

.tl-ticks span:first-child { transform: none; }
.tl-ticks span:last-child { transform: translateX(-100%); }

/* Вертикальный таймлайн */
.sched-list {
  position: relative;
  display: flex;
  flex-direction: column;
}

.sched-list::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 18px;
  bottom: 18px;
  border-left: 1px solid var(--c-border);
}

.sched-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 36px;
}

.sr-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  background: var(--c-surface);
}

.sr-ico.wake { color: var(--c-accent); }
.sr-ico.nap { color: var(--c-day-bar); }
.sr-ico.night { color: var(--c-night-bar); }
.sr-ico.ev {
  color: var(--c-accent);
  border: 1px solid var(--c-accent);
  border-radius: 50%;
}

.sr-label {
  flex: 1;
  font-weight: 500;
}

.sr-time {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  font-weight: 500;
}

.sched-gap {
  padding: 2px 0 2px 39px;
}

.adjusted-note {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  margin: var(--sp-3) 0 0;
}

.sched-foot { margin: var(--sp-3) 0 0; }

/* ── История событий ── */
.events { margin-top: var(--sp-5); }

.add-btn { margin-bottom: var(--sp-3); }
</style>
