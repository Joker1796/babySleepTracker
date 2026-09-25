<script setup>
import { computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { formatDurationMin } from '../logic/age'
import { getNorms } from '../data/sleepNorms'
import { normsAgeM, normsCappedForChild } from '../logic/norms'
import { REGIME_LIMITS, clampRegimeNumber, isValidHHMM } from '../data/regime'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const now = useNow()

const child = computed(() => children.activeChild)
const regime = computed(() => child.value?.regime || null)
const isCustom = computed(() => regime.value?.mode === 'custom')

// Возрастные нормы — подсказка родителю (по корректированному возрасту ребёнка)
const norms = computed(() =>
  child.value ? getNorms(normsAgeM(child.value, now.value)) : null
)
const normsCapped = computed(() => normsCappedForChild(child.value, now.value))

function save(patch) {
  const id = child.value?.id
  if (id) children.updateRegime(id, patch)
}

// Числовое поле: сохраняем по @change (не на каждую клавишу). Пустое или
// нечисловое значение не сохраняем — возвращаем в поле прежнее; вне диапазона
// прижимаем к границе.
function onNumber(key, e) {
  const v = clampRegimeNumber(key, e.target.value)
  if (v == null) {
    e.target.value = regime.value?.[key] ?? ''
    return
  }
  e.target.value = v
  if (v !== regime.value?.[key]) save({ [key]: v })
}

function onTime(key, e) {
  const v = e.target.value
  if (!isValidHHMM(v)) {
    e.target.value = regime.value?.[key] ?? ''
    return
  }
  if (v !== regime.value?.[key]) save({ [key]: v })
}

function onToggle(key, e) {
  save({ [key]: !!e.target.checked })
}

// Итоговые цели по введённым значениям
const daySleepMin = computed(() => (Number(regime.value?.napCount) || 0) * (Number(regime.value?.napDurationMin) || 0))
const nightSleepMin = computed(() => Number(regime.value?.nightSleepMin) || 0)
const totalSleepMin = computed(() => daySleepMin.value + nightSleepMin.value)

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
        <div class="sum-item"><span>Окно бодрствования</span><span class="num">{{ norms.wakeWindow[0] }}–{{ norms.wakeWindow[1] }} мин</span></div>
        <div class="sum-item"><span>Дневных снов</span><span class="num">{{ norms.naps[0] === norms.naps[1] ? norms.naps[0] : `${norms.naps[0]}–${norms.naps[1]}` }}</span></div>
        <div class="sum-item"><span>Дневной сон</span><span class="num">{{ formatDurationMin(norms.daySleep[0]) }} – {{ formatDurationMin(norms.daySleep[1]) }}</span></div>
        <div class="sum-item"><span>Ночной сон</span><span class="num">{{ formatDurationMin(norms.nightSleep[0]) }} – {{ formatDurationMin(norms.nightSleep[1]) }}</span></div>
        <div class="sum-item"><span>Всего за сутки</span><span class="num">{{ formatDurationMin(norms.totalSleep[0]) }} – {{ formatDurationMin(norms.totalSleep[1]) }}</span></div>
        <div class="sum-item"><span>Чаще всего</span><span class="num">{{ formatDurationMin(norms.typicalTotal[0]) }} – {{ formatDurationMin(norms.typicalTotal[1]) }}</span></div>
        <div class="sum-item"><span>Отбой</span><span class="num">{{ norms.bedtime[0] }}–{{ norms.bedtime[1] }}</span></div>
      </div>
      <p class="muted small norms-note">{{ norms.note }}</p>
      <p class="muted small norms-note">Суточный сон — по рекомендациям AASM (2016) и NSF (2015), ночной — с учётом пробуждений на кормление. Окна бодрствования и отбой — ориентиры: главное — признаки усталости малыша.</p>
      <p v-if="normsCapped" class="muted small norms-note">Нормы рассчитаны до года — сейчас показаны для 10–12 месяцев.</p>
    </div>

    <template v-if="!child">
      <div class="card"><p class="muted">Сначала добавьте профиль малыша.</p></div>
    </template>

    <template v-else-if="!isCustom">
      <div class="card">
        <p class="off-text">Настраиваемый режим выключен — сейчас приложение считает окна сна автоматически по возрасту.</p>
        <button class="btn block" @click="enableCustom"><Icon name="sliders" :size="18" /> Включить настраиваемый режим</button>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <div class="card-title">Целевые ориентиры</div>
        <div class="target-total">
          <span class="target-big serif num">{{ formatDurationMin(totalSleepMin) }}</span>
          <span class="muted">сна за сутки</span>
        </div>
        <div class="summary">
          <div class="sum-item"><span>Дневной сон</span><span class="num">{{ formatDurationMin(daySleepMin) }}</span></div>
          <div class="sum-item"><span>Ночной сон</span><span class="num">{{ formatDurationMin(nightSleepMin) }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Основные параметры</div>

        <div class="field">
          <label>Окно бодрствования, мин</label>
          <input :value="regime.wakeWindow" @change="onNumber('wakeWindow', $event)" type="number" class="num" :min="REGIME_LIMITS.wakeWindow[0]" :max="REGIME_LIMITS.wakeWindow[1]" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Количество дневных снов</label>
          <input :value="regime.napCount" @change="onNumber('napCount', $event)" type="number" class="num" :min="REGIME_LIMITS.napCount[0]" :max="REGIME_LIMITS.napCount[1]" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Продолжительность одного сна, мин</label>
          <input :value="regime.napDurationMin" @change="onNumber('napDurationMin', $event)" type="number" class="num" :min="REGIME_LIMITS.napDurationMin[0]" :max="REGIME_LIMITS.napDurationMin[1]" inputmode="numeric" />
        </div>
        <div class="field">
          <label>Начало ночного сна (отбой)</label>
          <input :value="regime.nightStart" @change="onTime('nightStart', $event)" type="time" class="num" />
        </div>
      </div>

      <div class="card">
        <div class="card-title">Дополнительно</div>

        <div class="field">
          <label>Утренний подъём</label>
          <input :value="regime.morningWake" @change="onTime('morningWake', $event)" type="time" class="num" />
          <p class="muted small hint">Используется в расписании на завтра, пока отметок сна мало.</p>
        </div>
        <div class="field">
          <label>Продолжительность ночного сна, мин</label>
          <input :value="regime.nightSleepMin" @change="onNumber('nightSleepMin', $event)" type="number" class="num" :min="REGIME_LIMITS.nightSleepMin[0]" :max="REGIME_LIMITS.nightSleepMin[1]" inputmode="numeric" />
        </div>
        <div class="field">
          <label>За сколько минут до сна «сбавить темп»</label>
          <input :value="regime.windDownMin" @change="onNumber('windDownMin', $event)" type="number" class="num" :min="REGIME_LIMITS.windDownMin[0]" :max="REGIME_LIMITS.windDownMin[1]" inputmode="numeric" />
        </div>
        <label class="switch-row">
          <input :checked="regime.shortNapReduce !== false" @change="onToggle('shortNapReduce', $event)" type="checkbox" />
          <span>Сокращать окно бодрствования после короткого сна</span>
        </label>
      </div>

      <p class="muted small footnote">Значения переопределяют возрастные нормы: прогноз следующего сна, фазы «скоро сон / пора укладывать» и оценка суточной нормы считаются по ним. Чтобы вернуться к авторасчёту, переключите режим на «Авто» на экране «Сегодня».</p>
    </template>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
}

.sum-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-3);
  min-height: 40px;
  border-top: 1px solid var(--c-border);
}

.sum-item span:first-child { color: var(--c-text-soft); }
.sum-item .num { font-weight: 500; text-align: right; }

.target-total {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: var(--sp-2);
}

.target-big {
  font-size: var(--fs-xl);
  font-weight: 500;
}

.norms-note {
  margin: var(--sp-3) 0 0;
  line-height: 1.45;
}

.off-text { margin-bottom: var(--sp-3); }

.field { margin-bottom: var(--sp-3); }

.hint { margin: var(--sp-1) 0 0; }

.switch-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 44px;
  margin: 0;
  font-size: var(--fs-base);
  color: var(--c-text);
  cursor: pointer;
}

.switch-row input {
  width: 22px;
  height: 22px;
  min-height: 22px;
  flex-shrink: 0;
  margin: 0;
  accent-color: var(--c-primary);
}

.footnote { margin: 0 var(--sp-1); line-height: 1.45; }
</style>
