<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { simNow } from '../composables/useNow'
import { EVENT_TYPES } from '../data/eventTypes'
import { CONDITION_STATES, conditionById } from '../data/illness'
import IllnessSetup from '../components/IllnessSetup.vue'
import IllnessReminders from '../components/IllnessReminders.vue'
import EventEditSheet from '../components/EventEditSheet.vue'

const events = useEventsStore()
const illness = useIllnessStore()
const router = useRouter()

const active = computed(() => illness.active)

// Форма события (лекарство/температура/еда) и выбор лекарства
const sheetModel = ref(null)
const medPickerOpen = ref(false)

const toast = ref('')
let toastTimer = null
function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2000)
}

// События этой болезни, свежие сверху (для ленты «Записи»)
const illnessEvents = computed(() => {
  const id = active.value?.id
  if (!id) return []
  return events.sorted.filter(e => e.illnessId === id).slice().reverse()
})

function openSheet(type, extra = {}) {
  sheetModel.value = { isNew: true, type, startedAt: simNow(), illnessId: active.value.id, ...extra }
}

// Лекарство: без назначенных — просто форма; одно — сразу с подставленным
// названием; несколько — сначала выбор.
function onMedicine() {
  const meds = active.value.medications || []
  if (meds.length === 0) return openSheet('medicine')
  if (meds.length === 1) return openMed(meds[0])
  medPickerOpen.value = !medPickerOpen.value
}
function openMed(med) {
  medPickerOpen.value = false
  openSheet('medicine', { note: med.name, medId: med.id })
}

async function logWater() {
  await events.add({ type: 'water', startedAt: simNow(), kind: 'point', illnessId: active.value.id })
  showToast('Записали питьё 💧')
}

async function logCondition(state) {
  await events.add({
    type: 'condition',
    startedAt: simNow(),
    kind: 'point',
    note: state.label,
    state: state.id,
    illnessId: active.value.id
  })
  showToast(`Состояние: ${state.label}`)
}

// Клик по напоминанию → тот же путь логирования, что и по кнопке
function onReminderLog(r) {
  if (r.source === 'medicine') {
    const med = (active.value.medications || []).find(m => m.id === r.medId)
    med ? openMed(med) : openSheet('medicine')
  } else if (r.source === 'temp') {
    openSheet('temperature')
  } else if (r.source === 'water') {
    logWater()
  } else if (r.source === 'food') {
    openSheet('food')
  }
}

async function deleteEvent(e) {
  if (!confirm('Удалить эту запись?')) return
  await events.remove(e.id)
  showToast('Запись удалена')
}

async function recover() {
  if (!confirm('Отметить, что малыш выздоровел? Вкладка «Болезнь» закроется, запись сохранится в истории.')) return
  await illness.recover()
  router.replace('/')
}

function eventIcon(e) {
  if (e.type === 'condition') return conditionById(e.state)?.icon || '🩹'
  return EVENT_TYPES[e.type]?.icon || '•'
}
function eventText(e) {
  const def = EVENT_TYPES[e.type]
  const base = def?.label || e.type
  const parts = []
  if (e.amount != null) parts.push(`${e.amount} ${def?.amountUnit || ''}`.trim())
  if (e.note) parts.push(e.note)
  return parts.length ? `${base}: ${parts.join(' · ')}` : base
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">🤒 Болезнь</h1>

    <template v-if="active">
      <IllnessSetup :illness="active" />

      <IllnessReminders :illness="active" :events="events.sorted" @log="onReminderLog" />

      <!-- Кнопки лога -->
      <div class="card-title">Отметить</div>
      <div class="log-btns">
        <button class="log-btn" @click="onMedicine">
          <span class="log-icon">💊</span><span>Лекарство</span>
        </button>
        <button class="log-btn" @click="openSheet('temperature')">
          <span class="log-icon">🌡️</span><span>Температура</span>
        </button>
        <button class="log-btn" @click="logWater">
          <span class="log-icon">💧</span><span>Питьё</span>
        </button>
        <button class="log-btn" @click="openSheet('food')">
          <span class="log-icon">🥣</span><span>Еда</span>
        </button>
      </div>

      <!-- Выбор лекарства (если их несколько) -->
      <Transition name="fade">
        <div v-if="medPickerOpen" class="med-picker">
          <button
            v-for="med in active.medications"
            :key="med.id"
            class="chip"
            @click="openMed(med)"
          >💊 {{ med.name || 'Лекарство' }}</button>
        </div>
      </Transition>

      <!-- Состояние ребёнка -->
      <div class="card-title">Как малыш себя чувствует?</div>
      <div class="states">
        <button
          v-for="s in CONDITION_STATES"
          :key="s.id"
          class="state-btn"
          @click="logCondition(s)"
        >
          <span class="state-icon">{{ s.icon }}</span>
          <span class="state-label">{{ s.label }}</span>
        </button>
      </div>

      <!-- Лента записей болезни -->
      <template v-if="illnessEvents.length">
        <div class="card-title">Записи</div>
        <div class="card log-list">
          <div v-for="e in illnessEvents" :key="e.id" class="log-row">
            <span class="log-row-icon">{{ eventIcon(e) }}</span>
            <span class="grow">{{ eventText(e) }}</span>
            <span class="muted small">{{ dayjs(e.startedAt).format('D.MM HH:mm') }}</span>
            <button class="log-del" aria-label="Удалить запись" @click="deleteEvent(e)">✕</button>
          </div>
        </div>
      </template>

      <button class="btn block recover-btn" @click="recover">✅ Малыш выздоровел</button>
    </template>

    <!-- Активной болезни нет (например, после выздоровления) -->
    <div v-else class="card">
      <p>Сейчас нет активной болезни.</p>
      <router-link to="/" class="btn secondary">На главную</router-link>
    </div>

    <Transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.log-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.log-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 56px;
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  box-shadow: var(--shadow);
  font-size: 14px;
  font-weight: 600;
}
.log-btn:active { opacity: 0.75; }
.log-icon { font-size: 22px; }

.med-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.states {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.state-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  min-height: 66px;
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  box-shadow: var(--shadow);
}
.state-btn:active { opacity: 0.75; }
.state-icon { font-size: 26px; }
.state-label { font-size: 12px; font-weight: 600; text-align: center; }

.log-list { padding: 4px 16px; }
.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--c-border);
  font-size: 14px;
}
.log-row:last-child { border-bottom: none; }
.log-row-icon { font-size: 18px; }

.log-del {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--c-text-soft);
  font-size: 14px;
}
.log-del:active { background: var(--c-urgent-soft); color: var(--c-urgent); }

.recover-btn {
  margin-top: 8px;
  background: var(--c-walk);
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
