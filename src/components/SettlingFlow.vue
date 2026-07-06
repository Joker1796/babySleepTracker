<script setup>
import { computed, ref } from 'vue'
import { useEventsStore } from '../stores/events'
import { useSettlingStore } from '../stores/settling'
import { useChildrenStore } from '../stores/children'
import WakeChecklist from './WakeChecklist.vue'

const props = defineProps({
  guidance: { type: Object, required: true }
})
const emit = defineEmits(['slept'])

const events = useEventsStore()
const settling = useSettlingStore()
const children = useChildrenStore()

const childId = computed(() => children.activeChild?.id)
const phase = computed(() => props.guidance.phase)

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
  'no-data': '🍼',
  active: '🤸',
  'wind-down': '🌥️',
  'time-to-sleep': '⏰',
  'night-waking': '🌙',
  settling: '🌙',
  'nap-extension': '🔁',
  sleeping: '😴'
}[phase.value] || '💡'))

function startSettling() {
  settling.start(childId.value)
}
function chooseLocation(loc) {
  settling.setLocation(childId.value, loc)
}
function changeLocation() {
  settling.setLocation(childId.value, null)
}
async function fellAsleep() {
  await events.startInterval('sleep')
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
      <span class="flow-icon">{{ icon }}</span>
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
        <button class="btn grow" @click="fellAsleep">Уснул(а)</button>
      </div>
    </template>

    <!-- Кнопка «Начать укладывание» (wind-down / time-to-sleep) -->
    <button v-if="guidance.showStartSettling" class="btn block start-btn" @click="startSettling">
      🌙 Начать укладывание
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
          <span class="loc-icon">{{ loc.icon }}</span>
          <span>{{ loc.label }}</span>
        </button>
      </div>

      <!-- Шаг 2: советы для выбранного места -->
      <template v-else>
        <ol class="steps">
          <li v-for="(step, i) in guidance.steps" :key="i">{{ step }}</li>
        </ol>
      </template>

      <button class="btn block" @click="fellAsleep">Уснул(а)</button>

      <!-- Назад к выбору места (значок слева внизу) -->
      <button
        v-if="guidance.location"
        class="back-btn"
        @click="changeLocation"
        aria-label="Назад к выбору места"
      >←</button>
    </template>
  </div>
</template>

<style scoped>
.flow { border-left: 4px solid var(--c-primary); }
.flow.warn { border-left-color: var(--c-warn); }
.flow.urgent { border-left-color: var(--c-urgent); }

.flow-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.flow-icon { font-size: 24px; }

.flow-title { margin: 0; font-size: 17px; }

.flow-line {
  font-size: 14px;
  margin: 0 0 8px;
}

.remaining, .steps {
  margin: 4px 0 12px;
  padding-left: 20px;
  font-size: 14px;
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
  min-height: 36px;
  border-radius: 999px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 600;
}

.idea-tag.active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.idea-text {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.remaining { color: var(--c-urgent); font-weight: 500; }

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
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  font-size: 15px;
  font-weight: 600;
}

.loc-btn:active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.loc-icon { font-size: 22px; }

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-top: 10px;
  border-radius: var(--radius-sm);
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-text-soft);
  font-size: 20px;
  line-height: 1;
}

.back-btn:active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}
</style>
