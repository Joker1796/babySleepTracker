<script setup>
import { computed, ref, nextTick, watch } from 'vue'
import dayjs from 'dayjs'
import { useRoute } from 'vue-router'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useNow } from '../composables/useNow'
import { formatDurationMin, plural } from '../logic/age'
import { effectiveNorms, normsAgeM } from '../logic/norms'
import { dailyStats, averageStats, normVerdict } from '../logic/stats'
import { scheduleProfile, buildSchedule, minToHHMM, hhmmToMin } from '../logic/schedule'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const events = useEventsStore()
const now = useNow()
const route = useRoute()

const days = ref(7)

const stats = computed(() => dailyStats(events.sorted, now.value, days.value))

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

// Среднее — только по завершённым дням (сегодняшний ещё идёт)
const avg = computed(() => averageStats(stats.value))
const hasTodayOnly = computed(() => !avg.value && stats.value.some(d => d.isToday && d.totalSleepMin > 0))

const avgVerdict = computed(() =>
  normVerdict(avg.value, norms.value, children.activeChild ? normsAgeM(children.activeChild, now.value) : 6)
)

// ── Расписание на завтра ──
const showSchedule = ref(false)
const scheduleCard = ref(null)
// Выбор начала/конца дня (строки HH:MM). null → берётся из профиля.
const wakeStr = ref(null)
const bedStr = ref(null)

const profile = computed(() =>
  scheduleProfile(events.sorted, now.value, days.value, children.activeChild)
)

const schedule = computed(() =>
  buildSchedule(profile.value, {
    wakeMin: hhmmToMin(wakeStr.value),
    bedMin: hhmmToMin(bedStr.value)
  })
)

// Засечки времени на 24-часовой полосе
const timeTicks = [0, 6, 12, 18, 24]

function openSchedule() {
  if (wakeStr.value == null) wakeStr.value = minToHHMM(profile.value.wakeMin)
  if (bedStr.value == null) bedStr.value = minToHHMM(profile.value.bedMin)
  showSchedule.value = true
}

// Открытие по ссылке ?schedule=1 — и при первом входе, и когда экран
// статистики уже открыт (переход с того же маршрута не пересоздаёт компонент)
watch(() => route.query.schedule, v => {
  if (!v) return
  openSchedule()
  nextTick(() => scheduleCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}, { immediate: true })
</script>

<template>
  <div class="page">
    <h1 class="page-title">Статистика</h1>

    <div class="row period">
      <button class="chip" :class="{ active: days === 7 }" @click="days = 7">7 дней</button>
      <button class="chip" :class="{ active: days === 14 }" @click="days = 14">14 дней</button>
    </div>

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
          <text v-if="days === 7 || i % 2 === 0" :x="b.x + b.barW / 2" :y="H - 6" class="axis mid">{{ b.label }}</text>
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
      <p class="muted small avg-note">
        В среднем за {{ avg.daysCounted }} дн. с данными. Сегодняшний день ещё идёт — в среднее он не входит.
      </p>
      <div class="avg-row"><span class="muted">Дневной сон</span><span class="num">{{ formatDurationMin(avg.day) }}</span></div>
      <div class="avg-row"><span class="muted">Дневных снов</span><span class="num">{{ avg.naps }}</span></div>
      <div v-if="norms" class="avg-row">
        <span class="muted">{{ norms.custom ? 'Цель по режиму' : 'Норма всего' }}</span>
        <span class="num">{{ formatDurationMin(norms.totalSleep[0]) }} – {{ formatDurationMin(norms.totalSleep[1]) }}</span>
      </div>
      <p class="verdict">{{ avgVerdict }}</p>
    </section>

    <p v-else-if="hasTodayOnly" class="muted small empty-note">
      Средние появятся, когда завершится хотя бы один день с отметками сна — сегодняшний ещё идёт.
    </p>
    <p v-else class="muted small empty-note">
      Пока нет данных — отмечайте сон на главном экране, и здесь появится картина недели.
    </p>

    <button v-if="!showSchedule" class="btn block schedule-open" @click="openSchedule">
      <Icon name="calendar" :size="18" /> Построить расписание на завтра
    </button>

    <div v-if="showSchedule" ref="scheduleCard" class="card schedule">
      <div class="card-title">Примерный распорядок на завтра</div>
      <p class="muted small src-note">
        {{ schedule.source === 'history'
          ? `На основе средних за ${schedule.daysCounted} ${plural(schedule.daysCounted, 'день', 'дня', 'дней')} с данными`
          : 'По возрастным нормам — данных о сне пока мало' }}
      </p>

      <div class="day-bounds">
        <label class="bound">
          <span>Начало дня</span>
          <input v-model="wakeStr" type="time" class="num" />
        </label>
        <label class="bound">
          <span>Конец дня</span>
          <input v-model="bedStr" type="time" class="num" />
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
        </div>
        <div class="tl-ticks num">
          <span v-for="t in timeTicks" :key="t" :style="{ left: `${(t / 24) * 100}%` }">{{ t }}</span>
        </div>
      </div>

      <!-- Вертикальный таймлайн: тонкая линия и отметки -->
      <div class="sched-list">
        <div class="sched-row">
          <span class="sr-ico wake"><Icon name="sun" :size="18" /></span>
          <span class="sr-label">Подъём</span>
          <span class="sr-time num">{{ schedule.wake.hhmm }}</span>
        </div>
        <template v-for="(nap, i) in schedule.naps" :key="i">
          <div class="sched-gap muted small">бодрствование ~{{ formatDurationMin(schedule.wakeWindowMin) }}</div>
          <div class="sched-row">
            <span class="sr-ico nap"><Icon name="star" :size="16" /></span>
            <span class="sr-label">Сон {{ i + 1 }} <span class="muted small num">· {{ formatDurationMin(nap.durMin) }}</span></span>
            <span class="sr-time num">{{ nap.startHHMM }}–{{ nap.endHHMM }}</span>
          </div>
        </template>
        <div class="sched-gap muted small">бодрствование ~{{ formatDurationMin(schedule.wakeWindowMin) }}</div>
        <div class="sched-row">
          <span class="sr-ico night"><Icon name="moon" :size="18" /></span>
          <span class="sr-label">Ночной сон</span>
          <span class="sr-time num">{{ schedule.bedtime.hhmm }}</span>
        </div>
      </div>

      <p class="muted small sched-foot">Ориентир по средним, а не жёсткое правило — подстраивайте под признаки усталости малыша.</p>
    </div>
  </div>
</template>

<style scoped>
.period { margin-bottom: var(--sp-3); }

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

.schedule-open { margin-bottom: var(--sp-3); }

.src-note { margin: calc(-1 * var(--sp-1)) 0 var(--sp-3); }

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

.warn-ico { margin-top: 1px; color: var(--c-warn); }

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

.sched-foot { margin: var(--sp-3) 0 0; }
</style>
