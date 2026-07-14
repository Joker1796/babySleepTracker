<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { useSettlingStore } from '../stores/settling'
import { useUiStore } from '../stores/ui'
import { useNow } from '../composables/useNow'
import { buildGuidance } from '../logic/guidance'
import { formatDurationMin, plural, ageInMonths } from '../logic/age'
import { sleepVerb, wakeVerb } from '../logic/gender'
import ChildSwitcher from '../components/ChildSwitcher.vue'
import SleepButton from '../components/SleepButton.vue'
import SettlingFlow from '../components/SettlingFlow.vue'
import DayGreeting from '../components/DayGreeting.vue'
import EventButtons from '../components/EventButtons.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import AdviceCard from '../components/AdviceCard.vue'
import QuickTopics from '../components/QuickTopics.vue'

const children = useChildrenStore()
const events = useEventsStore()
const illness = useIllnessStore()
const settling = useSettlingStore()
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

// Форма события для типов с количеством (смесь мл, температура °C)
const sheetModel = ref(null)

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

// Ночное пробуждение для верхней карточки: пока идёт ночь и малыш проснулся,
// показываем «Ночное пробуждение», а не «Бодрствует» — даже во время продления сна.
const isNightWaking = computed(() => !!guidance.value?.isNightWaking)

const genderOf = computed(() => children.activeChild?.gender)

const status = computed(() => {
  const a = advice.value
  if (!a) return null
  if (a.state.sleeping) {
    return {
      icon: '😴',
      title: `Спит ${formatDurationMin(a.state.sleepingMin)}`,
      sub: `${sleepVerb(genderOf.value).toLowerCase()} в ${dayjs(a.state.sleeping.startedAt).format('HH:mm')}`
    }
  }
  if (isNightWaking.value && a.state.lastWakeAt != null) {
    return {
      icon: '🌙',
      title: 'Ночное пробуждение',
      sub: `${wakeVerb(genderOf.value).toLowerCase()} в ${dayjs(a.state.lastWakeAt).format('HH:mm')} · уложите обратно`
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
  return t != null ? `${wakeVerb(genderOf.value).toLowerCase()} в ${dayjs(t).format('HH:mm')}` : ''
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
  return left > 0 ? `до сна ~${formatDurationMin(left)}` : 'пора укладывать'
})


// Флоу сам даёт кнопку «Уснул» во время укладывания — большая кнопка тогда лишняя
const showSleepButton = computed(() =>
  guidance.value && !['settling', 'nap-extension'].includes(guidance.value.phase)
)

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

// Подсказка «настройте под ребёнка» — пока не заданы «помощники сна» и не закрыта
const showAidsHint = computed(() =>
  !!children.activeChild &&
  !(children.activeChild.aids && children.activeChild.aids.length) &&
  !hidden('aids-hint')
)

// Общие возрастные подсказки (регрессы, переходы) не дублируем на главном —
// они доступны в разделе «Советы». Оставляем только ситуативные.
const secondaryAdvices = computed(() => advice.value?.advices.filter(a => !a.general).slice(0, 4) || [])

// Скрываем закрытые крестиком карточки-подсказки (на день)
const visibleAdvices = computed(() => secondaryAdvices.value.filter(a => !hidden(`advice-${a.id}`)))

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2200)
}

function extendNap() {
  settling.startExtension(children.activeChild?.id)
}

// Поздравление с месяцем/годом остаётся видимым независимо от «Скрывать подсказки».
const showMilestone = computed(() => !!guidance.value?.milestone && !hidden('milestone'))

const showAchievement = computed(() => !!guidance.value?.achievement && !hidden('achievement'))

const showEncouragement = computed(() =>
  guidance.value?.encouragement && !hideHints.value && !hidden('encouragement')
)

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
    <div v-if="showMilestone" class="card milestone">
      <button class="hint-close" aria-label="Закрыть" @click="hide('milestone')">×</button>
      <span class="ms-icon">{{ guidance.milestone.isYear ? '🎂' : '🎉' }}</span>
      <p>{{ guidance.milestone.text }}</p>
    </div>

    <DayGreeting v-if="showGreeting" :greeting="guidance.greeting" @close="hide('greeting')" />

    <!-- Подсказка: настроить помощники сна под ребёнка -->
    <div v-if="showAidsHint" class="card aids-hint">
      <button class="hint-close" aria-label="Закрыть" @click="hide('aids-hint')">×</button>
      <span class="hint-icon">⚙️</span>
      <div class="grow">
        <p class="hint-text">Настройте под ребёнка: укачивание, соска, блэкаут и другое — подсказки станут точнее.</p>
        <router-link to="/settings" class="hint-link">Открыть настройки →</router-link>
      </div>
    </div>

    <div v-if="advice" class="card status-card">
      <div class="row">
        <span class="status-icon">{{ status.icon }}</span>
        <div class="grow">
          <div class="status-title">{{ status.title }}</div>
          <div v-if="status.sub" class="muted small">{{ status.sub }}</div>
        </div>
        <button
          class="regime-toggle"
          :class="{ custom: regimeMode === 'custom' }"
          @click="toggleRegime"
          :aria-label="`Режим: ${regimeMode === 'custom' ? 'настраиваемый' : 'авто'}`"
        >
          {{ regimeMode === 'custom' ? '🎛️ Свой' : '✨ Авто' }}
        </button>
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
      </div>
    </div>

    <!-- Достижение дня -->
    <div v-if="showAchievement" class="card trophy">
      <button class="hint-close" aria-label="Закрыть" @click="hide('achievement')">×</button>
      <span class="trophy-icon">🏆</span>
      <p>{{ guidance.achievement.text }}</p>
    </div>

    <!-- Поддержка для мамы -->
    <div v-if="showEncouragement" class="card support">
      <button class="hint-close" aria-label="Закрыть" @click="hide('encouragement')">×</button>
      <span class="support-icon">💛</span>
      <p>{{ guidance.encouragement.text }}</p>
    </div>

    <!-- Пора укладывать / укладываемся / сон — над кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase !== 'active'" :guidance="guidance" @slept="showToast('Сладких снов 💤')" />

    <!-- Продлить сон (после короткого сна) — над кнопкой «Уснул(а)» -->
    <button v-if="guidance?.showExtendNap" class="btn block extend-btn" @click="extendNap">
      🔁 Продлить сон
    </button>

    <SleepButton v-if="showSleepButton" />
    <EventButtons @logged="showToast" @edit="e => (sheetModel = e)" />

    <!-- Чем заняться (активное бодрствование) — под кнопками активностей -->
    <SettlingFlow v-if="guidance && guidance.phase === 'active'" :guidance="guidance" @slept="showToast('Сладких снов 💤')" />

    <template v-if="!hideHints && visibleAdvices.length">
      <div class="card-title" style="margin-bottom: 6px">Ещё подсказки</div>
      <AdviceCard
        v-for="a in visibleAdvices"
        :key="a.id"
        :advice="a"
        @close="hide(`advice-${a.id}`)"
      />
    </template>

    <!-- Режим «Болезнь»: кнопка запуска или ссылка на активную вкладку -->
    <button v-if="!illness.hasActive" class="btn block sick-btn" @click="startIllness">
      🤒 Ваш ребёнок заболел?
    </button>
    <router-link v-else to="/illness" class="card sick-active">
      <span class="sick-icon">🤒</span>
      <span class="grow">Малыш болеет — открыть вкладку «Болезнь»</span>
      <span class="sick-arrow">›</span>
    </router-link>

    <!-- Быстрые темы-справки (для детей до года) -->
    <template v-if="childAgeMonths == null || childAgeMonths < 12">
      <div class="card-title" style="margin-top: 4px">Быстрые темы</div>
      <QuickTopics />
    </template>

    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.status-card { padding-bottom: 12px; }

/* Подсказка про настройки под ребёнка */
.aids-hint {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding-right: 34px;
  background: var(--c-info-soft);
  border: 1px solid var(--c-info);
}

.hint-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  font-size: 22px;
  line-height: 1;
  color: var(--c-text-soft);
}

.hint-icon { font-size: 24px; }

.hint-text { margin: 0 0 6px; font-size: 14px; }

.hint-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-primary);
  text-decoration: none;
}

.extend-btn { margin-bottom: 12px; }

.status-icon { font-size: 34px; }

/* Переключатель режима расчёта — компактный pill справа в карточке статуса */
.regime-toggle {
  flex-shrink: 0;
  align-self: flex-start;
  padding: 6px 10px;
  min-height: 30px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  color: var(--c-text-soft);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.regime-toggle.custom {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
  color: var(--c-primary);
}

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
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding-right: 34px;
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

.support {
  background: var(--c-medicine-soft);
}

.milestone {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 34px;
  background: linear-gradient(135deg, var(--c-primary-soft), var(--c-surface));
  border: 1px solid var(--c-primary);
}

.ms-icon { font-size: 30px; }

/* Кнопка «Ваш ребёнок заболел?» и ссылка на активную болезнь */
.sick-btn {
  margin-bottom: 12px;
  background: var(--c-urgent-soft);
  color: var(--c-urgent);
  border: 1px solid var(--c-urgent);
}

.sick-active {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--c-text);
  border: 1px solid var(--c-urgent);
  background: var(--c-urgent-soft);
}

.sick-icon { font-size: 22px; }
.sick-arrow { font-size: 22px; color: var(--c-urgent); }

.milestone p {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
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
