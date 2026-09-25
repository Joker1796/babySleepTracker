<script setup>
import { computed, ref } from 'vue'
import { useEventsStore } from '../stores/events'
import { useSettlingStore } from '../stores/settling'
import { useChildrenStore } from '../stores/children'
import { sleepVerb } from '../logic/gender'
import WakeChecklist from './WakeChecklist.vue'
import Icon from './Icon.vue'

const props = defineProps({
  guidance: { type: Object, required: true }
})
const emit = defineEmits(['slept'])

const events = useEventsStore()
const settling = useSettlingStore()
const children = useChildrenStore()

const childId = computed(() => children.activeChild?.id)
const phase = computed(() => props.guidance.phase)
// «Уснул/Уснула» — по полу ребёнка из профиля
const sleepWord = computed(() => sleepVerb(children.activeChild?.gender))

// Раскрытие подробностей идеи «чем заняться» (по аналогии с быстрыми темами)
const openActivity = ref(null)
function toggleActivity(i) {
  openActivity.value = openActivity.value === i ? null : i
}

const tone = computed(() => {
  if (phase.value === 'time-to-sleep') return 'urgent'
  if (phase.value === 'wind-down' || phase.value === 'settling') return 'warn'
  return 'calm'
})

const icon = computed(() => ({
  'no-data': 'baby',
  active: 'sun',
  'wind-down': 'sunrise',
  'time-to-sleep': 'clock',
  'night-waking': 'moon',
  settling: 'moon',
  'nap-extension': 'repeat',
  sleeping: 'moon'
}[phase.value] || 'bulb'))

function startSettling() {
  settling.start(childId.value)
}
function chooseLocation(loc) {
  settling.setLocation(childId.value, loc)
}
function changeLocation() {
  settling.setLocation(childId.value, null)
}
// Повторный тап не создаст второй сон: startInterval в сторе отдаёт уже
// создаваемый/открытый интервал. Флаг лишь гасит повторные вызовы целиком.
let asleepBusy = false
async function fellAsleep() {
  if (asleepBusy) return
  asleepBusy = true
  try {
    await events.startInterval('sleep')
  } finally {
    asleepBusy = false
  }
  settling.clear(childId.value)
  settling.clearExtension(childId.value)
  emit('slept')
}
function stopExtension() {
  settling.clearExtension(childId.value)
}
</script>

<template>
  <div class="flow card" :class="tone">
    <div class="flow-head">
      <Icon :name="icon" class="flow-icon" />
      <h2 class="flow-title">{{ guidance.headline }}</h2>
    </div>

    <p v-for="(line, i) in guidance.lines" :key="i" class="flow-line">{{ line }}</p>

    <!-- Активное время: чем заняться — кнопки с раскрытием подробностей -->
    <div v-if="guidance.activities.length" class="ideas">
      <div class="idea-tags">
        <button
          v-for="(idea, i) in guidance.activities"
          :key="i"
          class="idea-tag"
          :class="{ active: openActivity === i }"
          @click="toggleActivity(i)"
        >{{ idea.title }}</button>
      </div>
      <Transition name="fade">
        <div v-if="openActivity !== null" class="idea-text">
          {{ guidance.activities[openActivity].text }}
        </div>
      </Transition>
    </div>

    <!-- Чек-лист занятий на бодрствование (живот, утренние дела) -->
    <WakeChecklist
      v-if="guidance.wakeChecklist.length"
      :items="guidance.wakeChecklist"
      :wake-since="guidance.wakeSince"
    />

    <!-- Продление сна: шаги алгоритма -->
    <template v-if="phase === 'nap-extension'">
      <ol v-if="guidance.steps.length" class="steps">
        <li v-for="(step, i) in guidance.steps" :key="i">{{ step }}</li>
      </ol>
      <div class="row two-btn">
        <button class="btn secondary grow" @click="stopExtension">Начать бодрствование</button>
        <button class="btn grow" @click="fellAsleep">{{ sleepWord }}</button>
      </div>
    </template>

    <!-- Кнопка «Начать укладывание» (wind-down / time-to-sleep) -->
    <button v-if="guidance.showStartSettling" class="btn block start-btn" @click="startSettling">
      <Icon name="moon" :size="18" /> Начать укладывание
    </button>

    <!-- Укладывание: выбор места и советы под обстановку -->
    <template v-if="phase === 'settling'">
      <!-- Шаг 1: где укладываете -->
      <div v-if="!guidance.location" class="loc-options">
        <button
          v-for="loc in guidance.locationOptions"
          :key="loc.id"
          class="loc-btn"
          @click="chooseLocation(loc.id)"
        >
          <Icon :name="loc.iconName || 'star'" class="loc-icon" />
          <span>{{ loc.label }}</span>
        </button>
      </div>

      <!-- Шаг 2: советы для выбранного места -->
      <template v-else>
        <ol class="steps">
          <li v-for="(step, i) in guidance.steps" :key="i">{{ step }}</li>
        </ol>
      </template>

      <button class="btn block" @click="fellAsleep">{{ sleepWord }}</button>

      <!-- Назад к выбору места (значок слева внизу) -->
      <button
        v-if="guidance.location"
        class="back-btn"
        @click="changeLocation"
        aria-label="Назад к выбору места"
      ><Icon name="chevron-left" :size="20" /></button>
    </template>
  </div>
</template>

<style scoped>
/* Сценарий — лист дневника; тон задаёт цвет иконки, а не полоска слева */
.flow { padding: var(--sp-4); }
.flow-icon { color: var(--c-text-soft); }
.flow.warn .flow-icon, .flow.urgent .flow-icon { color: var(--c-accent); }
.flow.urgent { border-color: var(--c-accent); }

.flow-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.flow-title { margin: 0; font-size: var(--fs-lg); }

.flow-line {
  font-size: var(--fs-base);
  line-height: 1.5;
  margin: 0 0 8px;
}

.remaining, .steps {
  margin: 4px 0 12px;
  padding-left: 20px;
  font-size: var(--fs-base);
}

.remaining li, .steps li { margin-bottom: 5px; }

.ideas { margin: 4px 0 12px; }

.idea-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.idea-tag {
  padding: 7px 14px;
  min-height: 40px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: 500;
}

.idea-tag.active {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: var(--c-on-primary);
}

.idea-text {
  margin-top: 8px;
  font-size: var(--fs-base);
  line-height: 1.5;
}

.remaining { color: var(--c-accent); font-weight: 500; }

.steps li { margin-bottom: 8px; }

.start-btn { margin-top: 6px; }

.two-btn { gap: 10px; margin-top: 8px; }

.loc-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 6px 0 12px;
}

.loc-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 12px 14px;
  min-height: 52px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  font-size: var(--fs-base);
  font-weight: 500;
}

.loc-btn:active {
  background: var(--c-surface-2);
  border-color: var(--c-primary);
}

.loc-icon { color: var(--c-text-soft); }

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-top: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  color: var(--c-text-soft);
}

.back-btn:active {
  background: var(--c-surface-2);
  border-color: var(--c-primary);
}
</style>
