<script setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useNow } from '../composables/useNow'
import { analyzeDay } from '../logic/sleepAnalyzer'
import { ageInMonths, formatDurationMin } from '../logic/age'
import { getNorms } from '../data/sleepNorms'

const children = useChildrenStore()
const events = useEventsStore()
const now = useNow()

const days = ref(7)

const stats = computed(() => {
  const result = []
  for (let i = days.value - 1; i >= 0; i--) {
    const dayTs = dayjs(now.value).startOf('day').subtract(i, 'day').valueOf()
    result.push({ dayTs, ...analyzeDay(events.sorted, dayTs, now.value) })
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
</script>

<template>
  <div class="page">
    <h1 class="page-title">Статистика</h1>

    <div class="row" style="margin-bottom: 12px">
      <button class="chip" :class="{ active: days === 7 }" @click="days = 7">7 дней</button>
      <button class="chip" :class="{ active: days === 14 }" @click="days = 14">14 дней</button>
    </div>

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
          <text v-if="days === 7 || i % 2 === 0" :x="b.x + b.barW / 2" :y="H - 8" class="axis" text-anchor="middle">{{ b.label }}</text>
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
  </div>
</template>

<style scoped>
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
</style>
