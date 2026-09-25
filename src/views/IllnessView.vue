<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { simNow } from '../composables/useNow'
import { EVENT_TYPES } from '../data/eventTypes'
import { CONDITION_STATES } from '../data/illness'
import IllnessSetup from '../components/IllnessSetup.vue'
import IllnessReminders from '../components/IllnessReminders.vue'
import EventEditSheet from '../components/EventEditSheet.vue'
import Icon from '../components/Icon.vue'

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
  showToast('Записали питьё')
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
  return EVENT_TYPES[e.type]?.iconName || 'bandage'
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
    <h1 class="page-title">Болезнь</h1>

    <template v-if="active">
      <IllnessSetup :illness="active" />

      <IllnessReminders :illness="active" :events="events.sorted" @log="onReminderLog" />

      <!-- Кнопки лога -->
      <h2 class="section-title">Отметить</h2>
      <div class="log-btns">
        <button class="log-btn" :aria-expanded="(active.medications || []).length > 1 ? medPickerOpen : undefined" @click="onMedicine">
          <Icon name="pill" :size="22" class="log-icon" /><span>Лекарство</span>
        </button>
        <button class="log-btn" @click="openSheet('temperature')">
          <Icon name="thermometer" :size="22" class="log-icon" /><span>Температура</span>
        </button>
        <button class="log-btn" @click="logWater">
          <Icon name="cup" :size="22" class="log-icon" /><span>Питьё</span>
        </button>
        <button class="log-btn" @click="openSheet('food')">
          <Icon name="bowl" :size="22" class="log-icon" /><span>Еда</span>
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
          ><Icon name="pill" :size="16" /> {{ med.name || 'Лекарство' }}</button>
        </div>
      </Transition>

      <!-- Состояние ребёнка -->
      <h2 class="section-title">Как малыш себя чувствует?</h2>
      <div class="states">
        <button
          v-for="s in CONDITION_STATES"
          :key="s.id"
          class="state-btn"
          @click="logCondition(s)"
        >
          <span class="state-label">{{ s.label }}</span>
        </button>
      </div>

      <!-- Лента записей болезни -->
      <template v-if="illnessEvents.length">
        <h2 class="section-title">Записи</h2>
        <div class="card log-list">
          <div v-for="e in illnessEvents" :key="e.id" class="log-row">
            <Icon :name="eventIcon(e)" :size="18" class="log-row-icon" />
            <span class="grow">{{ eventText(e) }}</span>
            <span class="muted small num">{{ dayjs(e.startedAt).format('D.MM HH:mm') }}</span>
            <button class="log-del" aria-label="Удалить запись" @click="deleteEvent(e)"><Icon name="trash" :size="18" /></button>
          </div>
        </div>
      </template>

      <button class="btn block recover-btn" @click="recover"><Icon name="check" :size="18" /> Малыш выздоровел</button>
    </template>

    <!-- Активной болезни нет (например, после выздоровления) -->
    <div v-else class="card">
      <p>Сейчас нет активной болезни.</p>
      <router-link to="/" class="btn secondary">На главную</router-link>
    </div>

    <Transition name="fade">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>

    <EventEditSheet :model="sheetModel" @close="sheetModel = null" />
  </div>
</template>

<style scoped>
.section-title {
  font-size: var(--fs-md);
  margin: var(--sp-4) 0 var(--sp-2);
}

.log-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

/* Контурные кнопки отметки */
.log-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: 56px;
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  font-size: var(--fs-base);
  font-weight: 500;
}
.log-btn:active { opacity: 0.75; }
.log-icon { color: var(--c-text-soft); flex-shrink: 0; }

.med-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}
.med-picker .chip { min-height: 44px; }

.states {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

.state-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-2) var(--sp-1);
  min-height: 52px;
  border-radius: var(--radius-sm);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}
.state-btn:active { opacity: 0.75; }
.state-label { font-size: var(--fs-sm); font-weight: 500; text-align: center; line-height: 1.25; }

.log-list { padding: var(--sp-1) var(--sp-4); }
.log-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--sp-1) 0;
  min-height: 48px;
  border-bottom: 1px solid var(--c-border);
  font-size: var(--fs-base);
}
.log-row:last-child { border-bottom: none; }
.log-row-icon { color: var(--c-text-soft); flex-shrink: 0; }

.log-del {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-right: calc(-1 * var(--sp-2));
  border-radius: 999px;
  color: var(--c-text-soft);
}
.log-del:active { color: var(--c-urgent); }

.recover-btn { margin-top: var(--sp-2); }

.toast {
  position: fixed;
  bottom: calc(var(--nav-height) + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-text);
  color: var(--c-bg);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: 500;
  z-index: 90;
  white-space: nowrap;
}
</style>
