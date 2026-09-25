<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { useUiStore } from '../stores/ui'
import { useNow } from '../composables/useNow'
import { buildGuidance } from '../logic/guidance'
import { isDaytimeStart } from '../logic/sleepAnalyzer'
import { formatDurationMin, plural, ageInMonths } from '../logic/age'
import { buildStatus, wokeAtLabel as wokeAt, timeToSleepLabel as timeToSleep, wakeProgressValue } from '../logic/status'
import { normsCappedForChild } from '../logic/norms'
import ChildSwitcher from '../components/ChildSwitcher.vue'
import SleepButton from '../components/SleepButton.vue'
import SettlingFlow from '../components/SettlingFlow.vue'
import DayGreeting from '../components/DayGreeting.vue'
import EventButtons from '../components/EventButtons.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import AdviceCard from '../components/AdviceCard.vue'
import QuickTopics from '../components/QuickTopics.vue'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const events = useEventsStore()
const illness = useIllnessStore()
const ui = useUiStore()
const now = useNow()
const router = useRouter()

// «Ваш ребёнок заболел?» — начинаем болезнь (если ещё не идёт) и открываем вкладку
async function startIllness() {
  if (!illness.hasActive) await illness.start()
  router.push('/illness')
}

// «Скрывать подсказки» — свой флаг у активного ребёнка
const hideHints = computed(() => !!children.activeChild?.hideHints)

// Возраст активного ребёнка в месяцах (для скрытия «Быстрых тем» после года)
const childAgeMonths = computed(() => {
  const bd = children.activeChild?.birthDate
  return bd ? ageInMonths(bd, now.value) : null
})

// Форма события: для типов с количеством (смесь мл, температура °C)
// и для исправления забытого сна
const sheetModel = ref(null)

const toast = ref('')
let toastTimer = null
onBeforeUnmount(() => clearTimeout(toastTimer))

const guidance = computed(() => {
  if (!children.activeChild) return null
  return buildGuidance({
    child: children.activeChild,
    events: events.sorted,
    now: now.value
  })
})

const advice = computed(() => guidance.value?.advisor || null)

// Открытый сон дольше 16 ч — вероятно, забыли отметить пробуждение.
// Прогноз на нём не строится; предлагаем поправить время в редакторе.
const staleSleep = computed(() => advice.value?.state.staleSleep || null)
function fixStaleSleep() {
  sheetModel.value = staleSleep.value
}

// Ночное пробуждение для верхней карточки: пока идёт ночь и малыш проснулся,
// показываем «Ночное пробуждение», а не «Бодрствует».
const isNightWaking = computed(() => !!guidance.value?.isNightWaking)

const gender = computed(() => children.activeChild?.gender || null)
const status = computed(() => buildStatus(advice.value, { isNightWaking: isNightWaking.value, gender: gender.value }))
const wokeAtLabel = computed(() => wokeAt(advice.value, gender.value))
const progress = computed(() => wakeProgressValue(advice.value))
// Текст под полосой: сколько осталось до сна
const timeToSleepLabel = computed(() => timeToSleep(advice.value))

// Крупное время на главном: «1:20 ч» или «45 мин». Только для «спит» и «бодрствует»;
// в остальных состояниях (ночное пробуждение, забытый сон, нет данных) — заголовок статуса.
// Во сне подпись сразу говорит, какой идёт сон: «Спит дневной сон» / «Спит ночной сон».
const hero = computed(() => {
  const s = advice.value?.state
  if (!s) return null
  let label = null
  let min = null
  if (s.sleeping) {
    label = isDaytimeStart(s.sleeping) ? 'Спит дневной сон' : 'Спит ночной сон'
    min = s.sleepingMin
  } else if (!isNightWaking.value && s.awakeMin != null) {
    label = 'Бодрствует'
    min = s.awakeMin
  }
  if (min == null) return null
  const m = Math.max(0, Math.floor(min))
  return m < 60
    ? { label, big: String(m), unit: 'мин' }
    : { label, big: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`, unit: 'ч' }
})

// Старше года нормы считаются по группе 10–12 мес — показываем пометку
const normsCapped = computed(() => normsCappedForChild(children.activeChild, now.value))

const showSleepButton = computed(() => !!guidance.value)

// Универсальное закрытие подсказок крестиком «на день»: ключ включает дату,
// поэтому назавтра подсказка появляется снова (если ещё актуальна).
function dayKey(base) {
  const id = children.activeChild?.id
  return id ? `${base}:${id}:${dayjs(now.value).format('YYYY-MM-DD')}` : null
}
function hidden(base) {
  const k = dayKey(base)
  return !!k && ui.isDismissed(k)
}
function hide(base) {
  const k = dayKey(base)
  if (k) ui.dismiss(k)
}

const showGreeting = computed(() =>
  guidance.value?.greeting && !hideHints.value && !hidden('greeting')
)

// Общие возрастные подсказки (регрессы, переходы) не дублируем на главном —
// они доступны в разделе «Советы». Оставляем только ситуативные.
// Пока висит забытый сон, данные дня недостоверны — подсказки по ним не показываем.
const secondaryAdvices = computed(() =>
  staleSleep.value ? [] : advice.value?.advices.filter(a => !a.general).slice(0, 4) || []
)

// Скрываем закрытые крестиком карточки-подсказки (на день)
const visibleAdvices = computed(() => secondaryAdvices.value.filter(a => !hidden(`advice-${a.id}`)))

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

// Поздравление с месяцем/годом остаётся видимым независимо от «Скрывать подсказки».
const showMilestone = computed(() => !!guidance.value?.milestone && !hidden('milestone'))

const showAchievement = computed(() =>
  !!guidance.value?.achievement && !staleSleep.value && !hideHints.value && !hidden('achievement')
)
</script>

<template>
  <div class="page">
    <ChildSwitcher />

    <!-- Поздравление с новым месяцем/годом -->
    <div v-if="showMilestone" class="note milestone">
      <Icon name="star" class="note-icon accent" />
      <p class="grow">{{ guidance.milestone.text }}</p>
      <button class="note-close" aria-label="Закрыть" @click="hide('milestone')"><Icon name="close" :size="16" /></button>
    </div>

    <DayGreeting v-if="showGreeting" :greeting="guidance.greeting" @close="hide('greeting')" />

    <!-- Главное: состояние и крупное время, сводка дня и сценарий фазы -->
    <section v-if="advice" class="hero" aria-live="polite">
      <div class="hero-top">
        <span class="hero-label">
          <Icon :name="status.icon" :size="18" />
          {{ hero ? hero.label : status.title }}
        </span>
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
        <span>{{ advice.today.napCount }} {{ plural(advice.today.napCount, 'дневной сон', 'дневных сна', 'дневных снов') }} сегодня</span>
        <span>{{ formatDurationMin(advice.today.daySleepMin) }}</span>
      </div>
      <p v-if="normsCapped" class="muted small norms-capped">Нормы рассчитаны до года — после года ориентируйтесь в первую очередь на самочувствие малыша.</p>

      <!-- Пора укладывать / сон — встроено в ту же плашку -->
      <SettlingFlow v-if="guidance && !staleSleep && guidance.phase !== 'active'" embedded :guidance="guidance" />
    </section>

    <!-- Забытая отметка пробуждения -->
    <div v-if="staleSleep" class="note stale">
      <Icon name="clock" class="note-icon warn" />
      <p class="grow">Похоже, забыли отметить пробуждение — исправить?</p>
      <button class="btn sm" @click="fixStaleSleep">Исправить</button>
    </div>

    <!-- Достижение дня -->
    <div v-if="showAchievement" class="note trophy">
      <Icon name="star" class="note-icon accent" />
      <p class="grow">{{ guidance.achievement.text }}</p>
      <button class="note-close" aria-label="Закрыть" @click="hide('achievement')"><Icon name="close" :size="16" /></button>
    </div>

    <SleepButton v-if="showSleepButton" :stale="!!staleSleep" @fix="fixStaleSleep" />
    <EventButtons @logged="showToast" @edit="e => (sheetModel = e)" />

    <!-- Чем заняться (активное бодрствование) — под кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase === 'active'" :guidance="guidance" />

    <section v-if="!hideHints && visibleAdvices.length" class="section">
      <h2 class="section-title">Ещё подсказки</h2>
      <AdviceCard
        v-for="a in visibleAdvices"
        :key="a.id"
        :advice="a"
        @close="hide(`advice-${a.id}`)"
      />
    </section>

    <!-- Режим «Болезнь»: кнопка запуска или ссылка на активную вкладку -->
    <button v-if="!illness.hasActive" class="btn block secondary sick-btn" @click="startIllness">
      <Icon name="thermometer" :size="18" /> Ваш ребёнок заболел?
    </button>
    <router-link v-else to="/illness" class="note sick-active">
      <Icon name="thermometer" class="note-icon urgent" />
      <span class="grow">Малыш болеет — открыть вкладку «Болезнь»</span>
      <Icon name="chevron-right" :size="20" class="sick-arrow" />
    </router-link>

    <!-- Быстрые темы-справки (для детей до года) -->
    <section v-if="childAgeMonths == null || childAgeMonths < 12" class="section">
      <h2 class="section-title">Быстрые темы</h2>
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

/* ── Заметки: достижение, поздравление, забытый сон, болезнь ── */
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

.note-icon { flex-shrink: 0; }
.note-icon.accent { color: var(--c-accent); }
.note-icon.warn { color: var(--c-warn); }
.note-icon.urgent { color: var(--c-urgent); }

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

/* Кнопка «Ваш ребёнок заболел?» и ссылка на активную болезнь */
.sick-btn {
  margin-top: var(--sp-5);
  gap: 8px;
}

.sick-active {
  margin-top: var(--sp-5);
  min-height: 52px;
  text-decoration: none;
  color: var(--c-text);
  border-color: var(--c-urgent);
}

.sick-arrow { flex-shrink: 0; color: var(--c-text-soft); }

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
