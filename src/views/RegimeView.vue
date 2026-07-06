<script setup>
import { computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { formatDurationMin, ageInMonths } from '../logic/age'
import { getNorms } from '../data/sleepNorms'

const children = useChildrenStore()
const now = useNow()

const child = computed(() => children.activeChild)
const regime = computed(() => child.value?.regime || null)
const isCustom = computed(() => regime.value?.mode === 'custom')

// Возрастные нормы — подсказка родителю (по текущему возрасту ребёнка)
const norms = computed(() =>
  child.value ? getNorms(ageInMonths(child.value.birthDate, now.value)) : null
)

// Двусторонняя привязка поля режима: чтение из regime, запись через updateRegime.
function field(key, { number = false } = {}) {
  return computed({
    get: () => regime.value?.[key] ?? '',
    set: (val) => {
      const id = child.value?.id
      if (!id) return
      children.updateRegime(id, { [key]: number ? Number(val) : val })
    }
  })
}

const wakeWindow = field('wakeWindow', { number: true })
const napCount = field('napCount', { number: true })
const napDurationMin = field('napDurationMin', { number: true })
const nightSleepMin = field('nightSleepMin', { number: true })
const windDownMin = field('windDownMin', { number: true })
const dayStart = field('dayStart')
const nightStart = field('nightStart')
const morningWake = field('morningWake')
const shortNapReduce = field('shortNapReduce')

// Итоговые цели по введённым значениям
const daySleepMin = computed(() => (Number(regime.value?.napCount) || 0) * (Number(regime.value?.napDurationMin) || 0))
const totalSleepMin = computed(() => daySleepMin.value + (Number(regime.value?.nightSleepMin) || 0))

function enableCustom() {
  const id = child.value?.id
  if (id) children.setRegimeMode(id, 'custom')
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">Мой режим</h1>

    <!-- Подсказка родителю: возрастные нормы по месяцам -->
    <div v-if="norms" class="card norms-hint">
      <div class="card-title">Нормы для возраста {{ norms.label }}</div>
      <div class="summary">
        <div class="sum-item"><span>Окно бодрствования</span><b>{{ norms.wakeWindow[0] }}–{{ norms.wakeWindow[1] }} мин</b></div>
        <div class="sum-item"><span>Дневных снов</span><b>{{ norms.naps[0] === norms.naps[1] ? norms.naps[0] : `${norms.naps[0]}–${norms.naps[1]}` }}</b></div>
        <div class="sum-item"><span>Дневной сон</span><b>{{ formatDurationMin(norms.daySleep[0]) }} – {{ formatDurationMin(norms.daySleep[1]) }}</b></div>
        <div class="sum-item"><span>Ночной сон</span><b>{{ formatDurationMin(norms.nightSleep[0]) }} – {{ formatDurationMin(norms.nightSleep[1]) }}</b></div>
        <div class="sum-item"><span>Всего за сутки</span><b>{{ formatDurationMin(norms.totalSleep[0]) }} – {{ formatDurationMin(norms.totalSleep[1]) }}</b></div>
        <div class="sum-item"><span>Отбой</span><b>{{ norms.bedtime[0] }}–{{ norms.bedtime[1] }}</b></div>
      </div>
      <p class="muted small norms-note">{{ norms.note }}</p>
    </div>

    <template v-if="!child">
      <div class="card"><p class="muted">Сначала добавьте профиль малыша.</p></div>
    </template>

    <template v-else-if="!isCustom">
      <div class="card">
        <p>Настраиваемый режим выключен — сейчас приложение считает окна сна автоматически по возрасту.</p>
        <button class="btn block" @click="enableCustom">Включить настраиваемый режим</button>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <div class="card-title">Целевые ориентиры</div>
        <div class="summary">
          <div class="sum-item"><span>Дневной сон</span><b>{{ formatDurationMin(daySleepMin) }}</b></div>
          <div class="sum-item"><span>Ночной сон</span><b>{{ formatDurationMin(nightSleepMin || 0) }}</b></div>
          <div class="sum-item"><span>Всего за сутки</span><b>{{ formatDurationMin(totalSleepMin) }}</b></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Основные параметры</div>

        <div class="field">
          <label>Окно бодрствования, мин</label>
          <input v-model="wakeWindow" type="number" min="15" max="360" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Количество дневных снов</label>
          <input v-model="napCount" type="number" min="0" max="8" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Продолжительность одного сна, мин</label>
          <input v-model="napDurationMin" type="number" min="10" max="240" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Начало дневного сна (первый)</label>
          <input v-model="dayStart" type="time" />
        </div>
        <div class="field">
          <label>Начало ночного сна (отбой)</label>
          <input v-model="nightStart" type="time" />
        </div>
      </div>

      <div class="card">
        <div class="card-title">Дополнительно</div>

        <div class="field">
          <label>Утренний подъём</label>
          <input v-model="morningWake" type="time" />
        </div>
        <div class="field">
          <label>Продолжительность ночного сна, мин</label>
          <input v-model="nightSleepMin" type="number" min="0" max="900" inputmode="numeric" />
        </div>
        <div class="field">
          <label>За сколько минут до сна «сбавить темп»</label>
          <input v-model="windDownMin" type="number" min="0" max="90" inputmode="numeric" />
        </div>
        <label class="switch-row">
          <input v-model="shortNapReduce" type="checkbox" />
          <span>Сокращать окно бодрствования после короткого сна</span>
        </label>
      </div>

      <p class="muted small">Значения переопределяют возрастные нормы: прогноз следующего сна, фазы «скоро сон / пора укладывать» и оценка суточной нормы считаются по ним. Чтобы вернуться к авторасчёту, переключите режим на «✨ Авто» на экране «Сегодня».</p>
    </template>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sum-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.sum-item span { color: var(--c-text-soft); }

.norms-hint {
  border: 1px solid var(--c-primary);
  background: var(--c-primary-soft);
}

.norms-note {
  margin: 10px 0 0;
  line-height: 1.45;
}

.field { margin-bottom: 12px; }

.field input[type='number'],
.field input[type='time'] {
  width: 100%;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
}

.switch-row input { width: 20px; height: 20px; flex-shrink: 0; }
</style>
