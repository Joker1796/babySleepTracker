<script setup>
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettlingStore } from '../stores/settling'
import { useNow } from '../composables/useNow'
import { buildGuidance } from '../logic/guidance'
import { formatDurationMin, plural } from '../logic/age'
import { dayCount, dayTotalMin } from '../logic/eventStats'
import ChildSwitcher from '../components/ChildSwitcher.vue'
import SleepButton from '../components/SleepButton.vue'
import SettlingFlow from '../components/SettlingFlow.vue'
import DayGreeting from '../components/DayGreeting.vue'
import EventButtons from '../components/EventButtons.vue'
import AdviceCard from '../components/AdviceCard.vue'
import QuickTopics from '../components/QuickTopics.vue'

const children = useChildrenStore()
const events = useEventsStore()
const settling = useSettlingStore()
const now = useNow()

const toast = ref('')
let toastTimer = null

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

const isNightWaking = computed(() => guidance.value?.phase === 'night-waking')

const status = computed(() => {
  const a = advice.value
  if (!a) return null
  if (a.state.sleeping) {
    return {
      icon: '😴',
      title: `Спит ${formatDurationMin(a.state.sleepingMin)}`,
      sub: `уснул(а) в ${dayjs(a.state.sleeping.startedAt).format('HH:mm')}`
    }
  }
  if (isNightWaking.value && a.state.lastWakeAt != null) {
    return {
      icon: '🌙',
      title: 'Ночное пробуждение',
      sub: `проснулся(ась) в ${dayjs(a.state.lastWakeAt).format('HH:mm')} · уложите обратно`
    }
  }
  if (a.state.awakeMin != null) {
    // Время пробуждения показываем под полосой (слева), поэтому здесь sub не нужен
    return {
      icon: '🙂',
      title: `Бодрствует ${formatDurationMin(a.state.awakeMin)}`,
      sub: null
    }
  }
  return { icon: '🍼', title: 'Нет данных о сне', sub: 'отметьте засыпание и пробуждение' }
})

const wokeAtLabel = computed(() => {
  const t = advice.value?.state.lastWakeAt
  return t != null ? `проснулся(ась) в ${dayjs(t).format('HH:mm')}` : ''
})

const progress = computed(() => {
  const p = advice.value?.wakeProgress
  if (p == null) return null
  return Math.min(p, 1.15)
})

// Текст под полосой: сколько осталось до сна
const timeToSleepLabel = computed(() => {
  const left = advice.value?.wakeWindowLeft
  if (left == null) return ''
  return left > 0 ? `время до сна ~${formatDurationMin(left)}` : 'пора укладывать'
})

// Итоги дня по событиям
const tummyMinToday = computed(() => dayTotalMin(events.sorted, 'tummy', now.value, now.value))
const poopToday = computed(() => dayCount(events.sorted, 'poop', now.value))

// Флоу сам даёт кнопку «Уснул» во время укладывания — большая кнопка тогда лишняя
const showSleepButton = computed(() =>
  guidance.value && !['settling', 'nap-extension'].includes(guidance.value.phase)
)

const showGreeting = computed(() =>
  guidance.value?.greeting && !settling.isGreetingDismissed(children.activeChild?.id)
)

// Общие возрастные подсказки (регрессы, переходы) не дублируем на главном —
// они доступны в разделе «Советы». Оставляем только ситуативные.
const secondaryAdvices = computed(() => advice.value?.advices.filter(a => !a.general).slice(0, 4) || [])

// Крестик закрывает только советы из профиля (соска, укачивание, пеленание и т.п.).
// Ситуативные подсказки (перегул, пора спать) остаются всегда.
const adviceDismissed = computed(() => settling.isAdviceDismissed(children.activeChild?.id))
const visibleAdvices = computed(() =>
  secondaryAdvices.value.filter(a => !a.profile || !adviceDismissed.value)
)
const hasProfileAdvices = computed(() => secondaryAdvices.value.some(a => a.profile))
function dismissAdvice() {
  settling.dismissAdvice(children.activeChild?.id)
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

function dismissGreeting() {
  settling.dismissGreeting(children.activeChild?.id)
}

const showMilestone = computed(() =>
  guidance.value?.milestone && !settling.isMilestoneDismissed(children.activeChild?.id)
)
function dismissMilestone() {
  settling.dismissMilestone(children.activeChild?.id)
}
</script>

<template>
  <div class="page">
    <ChildSwitcher />

    <!-- Поздравление с новым месяцем/годом -->
    <div v-if="showMilestone" class="card milestone">
      <button class="ms-close" @click="dismissMilestone" aria-label="Скрыть">×</button>
      <span class="ms-icon">{{ guidance.milestone.isYear ? '🎂' : '🎉' }}</span>
      <p>{{ guidance.milestone.text }}</p>
    </div>

    <DayGreeting v-if="showGreeting" :greeting="guidance.greeting" @dismiss="dismissGreeting" />

    <div v-if="advice" class="card status-card">
      <div class="row">
        <span class="status-icon">{{ status.icon }}</span>
        <div class="grow">
          <div class="status-title">{{ status.title }}</div>
          <div v-if="status.sub" class="muted small">{{ status.sub }}</div>
        </div>
      </div>

      <div v-if="progress != null && !advice.state.sleeping && !isNightWaking" class="ww">
        <div class="ww-bar">
          <div class="ww-fill" :style="{ width: `${Math.min(progress, 1) * 100}%` }"></div>
        </div>
        <div class="ww-labels muted small">
          <span>{{ wokeAtLabel }}</span>
          <span>{{ timeToSleepLabel }}</span>
        </div>
      </div>

      <div class="forecast">
        <div class="forecast-item">
          <span class="f-label">Дневной сон сегодня</span>
          <span class="f-value">{{ formatDurationMin(advice.today.daySleepMin) }} · {{ advice.today.napCount }} {{ plural(advice.today.napCount, 'сон', 'сна', 'снов') }}</span>
        </div>
        <div class="forecast-item">
          <span class="f-label">🤸 Выкладывание на живот</span>
          <span class="f-value">{{ tummyMinToday > 0 ? formatDurationMin(tummyMinToday) : '—' }}</span>
        </div>
        <div class="forecast-item">
          <span class="f-label">💩 Покакал</span>
          <span class="f-value">{{ poopToday }} {{ plural(poopToday, 'раз', 'раза', 'раз') }}</span>
        </div>
      </div>
    </div>

    <!-- Достижение дня -->
    <div v-if="guidance?.achievement" class="card trophy">
      <span class="trophy-icon">🏆</span>
      <p>{{ guidance.achievement.text }}</p>
    </div>

    <!-- Поддержка для мамы -->
    <div v-if="guidance?.encouragement" class="card support">
      <span class="support-icon">💛</span>
      <p>{{ guidance.encouragement.text }}</p>
    </div>

    <!-- Пора укладывать / укладываемся / сон — над кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase !== 'active'" :guidance="guidance" @slept="showToast('Сладких снов 💤')" />

    <SleepButton v-if="showSleepButton" />
    <EventButtons @logged="showToast" />

    <!-- Чем заняться (активное бодрствование) — под кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase === 'active'" :guidance="guidance" @slept="showToast('Сладких снов 💤')" />

    <template v-if="visibleAdvices.length">
      <div class="row advices-head">
        <div class="card-title grow" style="margin: 0">Ещё подсказки</div>
        <button v-if="hasProfileAdvices && !adviceDismissed" class="adv-close" @click="dismissAdvice" aria-label="Скрыть советы из профиля">×</button>
      </div>
      <AdviceCard v-for="a in visibleAdvices" :key="a.id" :advice="a" />
    </template>

    <!-- Быстрые темы-справки -->
    <div class="card-title" style="margin-top: 4px">Быстрые темы</div>
    <QuickTopics />

    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.status-card { padding-bottom: 12px; }

.advices-head { margin-bottom: 6px; }

.adv-close {
  width: 30px;
  height: 30px;
  font-size: 22px;
  line-height: 1;
  color: var(--c-text-soft);
}

.status-icon { font-size: 34px; }

.status-title {
  font-size: 19px;
  font-weight: 700;
}

.ww { margin-top: 12px; }

.ww-labels {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.ww-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--c-surface-2);
  overflow: hidden;
  margin-bottom: 4px;
}

.ww-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s;
  /* Зелёный градиент от светлого к насыщенному; фиксируем масштаб градиента
     к ширине карточки, чтобы по мере заполнения цвет становился насыщеннее. */
  background-image: linear-gradient(90deg, var(--c-ww-from), var(--c-ww-to));
  background-size: 496px 100%;
  background-repeat: no-repeat;
}

.forecast {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  border-top: 1px solid var(--c-border);
  padding-top: 10px;
}

.forecast-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.f-label { color: var(--c-text-soft); }
.f-value { font-weight: 600; }

.trophy, .support {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.trophy {
  background: linear-gradient(135deg, #fff6e0, var(--c-surface));
  border: 1px solid var(--c-warn);
}

[data-theme='dark'] .trophy {
  background: linear-gradient(135deg, #3b2d16, var(--c-surface));
}

.trophy-icon, .support-icon { font-size: 26px; }

.trophy p, .support p { margin: 0; font-size: 14px; }

.support { background: var(--c-medicine-soft); }

.milestone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, var(--c-primary-soft), var(--c-surface));
  border: 1px solid var(--c-primary);
}

.ms-icon { font-size: 30px; }

.milestone p {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.ms-close {
  position: absolute;
  top: 6px;
  right: 10px;
  width: 30px;
  height: 30px;
  font-size: 22px;
  line-height: 1;
  color: var(--c-text-soft);
}


.toast {
  position: fixed;
  bottom: calc(var(--nav-height) + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-text);
  color: var(--c-bg);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  z-index: 90;
  white-space: nowrap;
}
</style>
