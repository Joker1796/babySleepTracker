<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettlingStore } from '../stores/settling'
import { useNow } from '../composables/useNow'
import { buildGuidance } from '../logic/guidance'
import { formatDurationMin, plural } from '../logic/age'
import { buildStatus, wokeAtLabel as wokeAt, timeToSleepLabel as timeToSleep, wakeProgressValue } from '../logic/status'
import { normsCappedForChild } from '../logic/norms'
import ChildSwitcher from '../components/ChildSwitcher.vue'
import SleepButton from '../components/SleepButton.vue'
import SettlingFlow from '../components/SettlingFlow.vue'
import DayGreeting from '../components/DayGreeting.vue'
import EventButtons from '../components/EventButtons.vue'
import AdviceCard from '../components/AdviceCard.vue'
import QuickTopics from '../components/QuickTopics.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const events = useEventsStore()
const settling = useSettlingStore()
const now = useNow()

const toast = ref('')
let toastTimer = null
onBeforeUnmount(() => clearTimeout(toastTimer))

const guidance = computed(() => {
  if (!children.activeChild) return null
  return buildGuidance({
    child: children.activeChild,
    events: events.sorted,
    now: now.value,
    settling: settling.get(children.activeChild.id),
    extension: settling.getExtension(children.activeChild.id)
  })
})

const advice = computed(() => guidance.value?.advisor || null)

// Открытый сон дольше 16 ч — вероятно, забыли отметить пробуждение.
// Прогноз на нём не строится; предлагаем поправить время в редакторе.
const staleSleep = computed(() => advice.value?.state.staleSleep || null)
const sheetModel = ref(null)
function fixStaleSleep() {
  sheetModel.value = staleSleep.value
}

// Если малыш заснул (в т.ч. через большую кнопку) — закрываем сессии укладывания и продления
watch(
  () => events.currentSleep?.id,
  (sleepId) => {
    const id = children.activeChild?.id
    if (sleepId && id) {
      if (settling.get(id)) settling.clear(id)
      if (settling.getExtension(id)) settling.clearExtension(id)
    }
  }
)

// Ночное пробуждение для верхней карточки: пока идёт ночь и малыш проснулся,
// показываем «Ночное пробуждение», а не «Бодрствует» — даже во время продления сна.
const isNightWaking = computed(() => !!guidance.value?.isNightWaking)

const gender = computed(() => children.activeChild?.gender || null)
const status = computed(() => buildStatus(advice.value, { isNightWaking: isNightWaking.value, gender: gender.value }))
const wokeAtLabel = computed(() => wokeAt(advice.value, gender.value))
const progress = computed(() => wakeProgressValue(advice.value))
// Текст под полосой: сколько осталось до сна
const timeToSleepLabel = computed(() => timeToSleep(advice.value))

// Крупное время на главном: «1:20 ч» или «45 мин». Только для «спит» и «бодрствует»;
// в остальных состояниях (ночное пробуждение, забытый сон, нет данных) — заголовок статуса.
const hero = computed(() => {
  const s = advice.value?.state
  if (!s) return null
  let label = null
  let min = null
  if (s.sleeping) { label = 'Спит'; min = s.sleepingMin }
  else if (!isNightWaking.value && s.awakeMin != null) { label = 'Бодрствует'; min = s.awakeMin }
  if (min == null) return null
  const m = Math.max(0, Math.floor(min))
  return m < 60
    ? { label, big: String(m), unit: 'мин' }
    : { label, big: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, unit: 'ч' }
})

// Старше года нормы считаются по группе 10–12 мес — показываем пометку
const normsCapped = computed(() => normsCappedForChild(children.activeChild, now.value))

// Флоу сам даёт кнопку «Уснул» во время укладывания — большая кнопка тогда лишняя
const showSleepButton = computed(() =>
  guidance.value && !['settling', 'nap-extension'].includes(guidance.value.phase)
)

const showGreeting = computed(() =>
  guidance.value?.greeting && !settling.isGreetingDismissed(children.activeChild?.id)
)

// Общие возрастные подсказки (регрессы, переходы) не дублируем на главном —
// они доступны в разделе «Советы». Оставляем только ситуативные.
// Пока висит забытый сон, данные дня недостоверны — подсказки по ним не показываем
const secondaryAdvices = computed(() =>
  staleSleep.value ? [] : advice.value?.advices.filter(a => !a.general).slice(0, 4) || []
)

// Крестик закрывает конкретную подсказку из профиля (соска, укачивание, пеленание и т.п.)
// до конца дня. Ситуативные подсказки (перегул, пора спать) остаются всегда.
const visibleAdvices = computed(() =>
  secondaryAdvices.value.filter(a => !a.profile || !settling.isAdviceDismissed(children.activeChild?.id, a.id))
)
function dismissAdvice(id) {
  settling.dismissAdvice(children.activeChild?.id, id)
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

function dismissGreeting() {
  settling.dismissGreeting(children.activeChild?.id)
}

function extendNap() {
  settling.startExtension(children.activeChild?.id)
}

const showMilestone = computed(() =>
  guidance.value?.milestone && !settling.isMilestoneDismissed(children.activeChild?.id)
)
function dismissMilestone() {
  settling.dismissMilestone(children.activeChild?.id)
}

// Поддержка для мамы — можно закрыть крестиком на день
const showEncouragement = computed(() =>
  !staleSleep.value && guidance.value?.encouragement && !settling.isEncouragementDismissed(children.activeChild?.id)
)
function dismissEncouragement() {
  settling.dismissEncouragement(children.activeChild?.id)
}

// Режим расчёта: 'auto' (наш движок по возрасту) или 'custom' (параметры родителя)
const regimeMode = computed(() => children.activeChild?.regime?.mode || 'auto')
function toggleRegime() {
  const id = children.activeChild?.id
  if (!id) return
  children.setRegimeMode(id, regimeMode.value === 'custom' ? 'auto' : 'custom')
}
</script>

<template>
  <div class="page">
    <ChildSwitcher />

    <!-- Поздравление с новым месяцем/годом -->
    <div v-if="showMilestone" class="note milestone">
      <Icon name="star" class="note-icon accent" />
      <p class="grow">{{ guidance.milestone.text }}</p>
      <button class="note-close" @click="dismissMilestone" aria-label="Скрыть"><Icon name="close" :size="16" /></button>
    </div>

    <DayGreeting v-if="showGreeting" :greeting="guidance.greeting" @dismiss="dismissGreeting" />

    <!-- Главное: состояние и крупное время -->
    <section v-if="advice" class="hero" aria-live="polite">
      <div class="hero-top">
        <span class="hero-label">
          <Icon :name="status.icon" :size="18" />
          {{ hero ? hero.label : status.title }}
        </span>
        <button
          class="regime-toggle"
          :class="{ custom: regimeMode === 'custom' }"
          @click="toggleRegime"
          :aria-label="`Режим расчёта: ${regimeMode === 'custom' ? 'свой' : 'авто'}. Переключить`"
        >
          <Icon name="sliders" :size="16" />
          {{ regimeMode === 'custom' ? 'Свой' : 'Авто' }}
        </button>
      </div>

      <div v-if="hero" class="hero-time num">
        <span class="hero-big">{{ hero.big }}</span>
        <span class="hero-unit">{{ hero.unit }}</span>
      </div>
      <div v-if="status.sub" class="hero-sub">{{ status.sub }}</div>

      <div v-if="progress != null && !advice.state.sleeping && !isNightWaking" class="ww">
        <div class="ww-bar" role="progressbar" aria-label="Окно бодрствования" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(Math.min(progress, 1) * 100)">
          <div class="ww-fill" :style="{ width: `${Math.min(progress, 1) * 100}%` }"></div>
          <span class="ww-tip" :style="{ left: `${Math.min(progress, 1) * 100}%` }"></span>
        </div>
        <div class="ww-labels num">
          <span>{{ wokeAtLabel }}</span>
          <span class="ww-left">{{ timeToSleepLabel }}</span>
        </div>
      </div>

      <div class="day-line num">
        <span>Днём сегодня</span>
        <span>{{ formatDurationMin(advice.today.daySleepMin) }} · {{ advice.today.napCount }} {{ plural(advice.today.napCount, 'сон', 'сна', 'снов') }}</span>
      </div>
      <p v-if="normsCapped" class="muted small norms-capped">Нормы рассчитаны до года — после года ориентируйтесь в первую очередь на самочувствие малыша.</p>
    </section>

    <!-- Забытая отметка пробуждения -->
    <div v-if="staleSleep" class="note stale">
      <Icon name="clock" class="note-icon warn" />
      <p class="grow">Похоже, забыли отметить пробуждение — исправить?</p>
      <button class="btn sm" @click="fixStaleSleep">Исправить</button>
    </div>

    <!-- Достижение дня -->
    <div v-if="guidance?.achievement && !staleSleep" class="note trophy">
      <Icon name="star" class="note-icon accent" />
      <p class="grow">{{ guidance.achievement.text }}</p>
    </div>

    <!-- Поддержка для мамы — тихая строка, без плашки -->
    <div v-if="showEncouragement" class="support">
      <p class="grow">{{ guidance.encouragement.text }}</p>
      <button class="note-close" @click="dismissEncouragement" aria-label="Скрыть"><Icon name="close" :size="16" /></button>
    </div>

    <!-- Пора укладывать / укладываемся / сон — над кнопками активностей -->
    <SettlingFlow v-if="guidance && !staleSleep && guidance.phase !== 'active'" :guidance="guidance" @slept="showToast('Сладких снов')" />

    <!-- Продлить сон (после короткого сна) — над кнопкой «Уснул» -->
    <button v-if="guidance?.showExtendNap" class="btn block secondary extend-btn" @click="extendNap">
      <Icon name="repeat" :size="18" /> Продлить сон
    </button>

    <SleepButton v-if="showSleepButton" :stale="!!staleSleep" @fix="fixStaleSleep" />
    <EventButtons @logged="showToast" />

    <!-- Чем заняться (активное бодрствование) — под кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase === 'active'" :guidance="guidance" @slept="showToast('Сладких снов')" />

    <section v-if="visibleAdvices.length" class="section">
      <h2 class="section-title">Подсказки</h2>
      <AdviceCard
        v-for="a in visibleAdvices"
        :key="a.id"
        :advice="a"
        :dismissible="a.profile"
        @dismiss="dismissAdvice(a.id)"
      />
    </section>

    <!-- Быстрые темы-справки -->
    <section class="section">
      <h2 class="section-title">Быстрые ответы</h2>
      <QuickTopics />
    </section>

    <Transition name="fade">
      <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
    </Transition>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
/* ── Главный блок: состояние и крупное время, без карточки ── */
.hero {
  padding: var(--sp-3) var(--sp-1) var(--sp-5);
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.hero-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-base);
  color: var(--c-text-soft);
}

.hero-time {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: var(--sp-1);
}

.hero-big {
  font-family: var(--font-serif);
  font-size: var(--fs-display);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
}

.hero-unit {
  font-size: var(--fs-base);
  color: var(--c-text-soft);
}

.hero-sub {
  margin-top: 6px;
  color: var(--c-text-soft);
}

/* Переключатель режима расчёта — тихая текстовая кнопка */
.regime-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  color: var(--c-text-soft);
  font-size: var(--fs-sm);
  font-weight: 500;
  white-space: nowrap;
}

/* Зона касания 44px при компактном виде кнопки */
.regime-toggle::after {
  content: '';
  position: absolute;
  inset: -4px;
}

.regime-toggle.custom {
  border-color: var(--c-primary);
  color: var(--c-text);
}

/* Окно бодрствования: тонкая линия с точкой на текущем моменте */
.ww { margin-top: var(--sp-4); }

.ww-bar {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: var(--c-border);
  margin: 6px 0 8px;
}

.ww-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--c-accent);
  transition: width 0.4s;
}

.ww-tip {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 50%;
  background: var(--c-accent);
  box-shadow: 0 0 0 4px var(--c-bg);
  transform: translateY(-50%);
  transition: left 0.4s;
}

.ww-labels {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.ww-left { color: var(--c-accent); font-weight: 500; }

.day-line {
  display: flex;
  justify-content: space-between;
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.day-line span:last-child { color: var(--c-text); font-weight: 500; }

.norms-capped { margin: var(--sp-2) 0 0; }

/* ── Заметки: достижение, поздравление, забытый сон ── */
.note {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-surface);
}

.note p { margin: 0; }

.note-icon.accent { color: var(--c-accent); }
.note-icon.warn { color: var(--c-warn); }

.milestone p {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
}

.stale { background: var(--c-warn-soft); border-color: transparent; }

.stale .btn.sm {
  min-height: 40px;
  padding: 6px 14px;
}

.note-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -10px -12px -10px 0;
  flex-shrink: 0;
  color: var(--c-text-soft);
}

.support {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  margin: 0 var(--sp-1) var(--sp-4);
}

.support p {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--fs-base);
  line-height: 1.55;
  color: var(--c-text-soft);
}

.extend-btn { margin-bottom: 10px; }

/* ── Разделы ниже кнопок ── */
.section { margin-top: var(--sp-5); }

.section-title {
  font-size: var(--fs-lg);
  margin: 0 0 var(--sp-1);
}

.toast {
  position: fixed;
  bottom: calc(var(--nav-height) + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-primary);
  color: var(--c-on-primary);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: 500;
  z-index: 90;
  white-space: nowrap;
}
</style>
