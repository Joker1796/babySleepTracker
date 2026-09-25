<script setup>
import { ref, watch, computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { useChildrenStore } from '../stores/children'
import { useNow, simNow } from '../composables/useNow'
import { ageInMonths } from '../logic/age'
import { EVENT_TYPES, EVENT_TYPE_LIST, eventKind, typesForAge } from '../data/eventTypes'
import { findSleepConflict, isStaleOpenSleep } from '../logic/sleepAnalyzer'
import ToothChart from './ToothChart.vue'
import Icon from './Icon.vue'

// model: null (закрыт) | { isNew: true, type?, startedAt? } | существующее событие
const props = defineProps({
  model: { type: Object, default: null },
  // Ограничение списка типов в выпадашке (напр. только календарные)
  types: { type: Array, default: null },
  // Показывать выбор «уже было / запланировано» (используется в Календаре)
  allowPlan: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const events = useEventsStore()
const children = useChildrenStore()
const now = useNow()

const childAgeM = computed(() => {
  const bd = children.activeChild?.birthDate
  return bd ? ageInMonths(bd, now.value) : null
})

// Последнее использование каждого типа (по времени начала события)
const lastUsed = computed(() => {
  const last = {}
  for (const e of events.sorted) {
    if (last[e.type] == null || e.startedAt > last[e.type]) last[e.type] = e.startedAt
  }
  return last
})

// Список типов в выпадашке: недоступные по возрасту скрыты; недавно
// использованные — первыми, остальные сохраняют порядок реестра.
const typeOptions = computed(() => {
  const base = typesForAge(props.types || EVENT_TYPE_LIST, childAgeM.value)
  const last = lastUsed.value
  return [...base].sort((a, b) => {
    const la = last[a.id], lb = last[b.id]
    if (la != null && lb != null) return lb - la
    if (la != null) return -1
    if (lb != null) return 1
    return 0
  })
})

const form = ref(null)
const error = ref('')
// Пересечение с другим сном: первое «Сохранить» предупреждает, второе — сохраняет
const overlapConfirmed = ref(false)
// Верхняя граница полей времени — нельзя выбрать будущее
const maxLocal = ref('')

function tsToLocal(ts) {
  return ts == null ? '' : dayjs(ts).format('YYYY-MM-DDTHH:mm')
}
function localToTs(str) {
  return str ? dayjs(str).valueOf() : null
}

// Числовое значение (температура, мл, рост, вес): принимаем и точку, и запятую
// (на русской раскладке десятичный разделитель — запятая). '' → null.
function parseAmount(v) {
  if (v == null) return null
  const s = String(v).trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

watch(() => props.model, m => {
  error.value = ''
  overlapConfirmed.value = false
  maxLocal.value = tsToLocal(simNow())
  if (!m) { form.value = null; return }
  // Забытый открытый сон: сразу просим указать окончание (подставляем
  // дату начала, чтобы пикер открылся рядом с нужным днём)
  const stale = !m.isNew && m.startedAt != null && isStaleOpenSleep(m, simNow())
  form.value = {
    isNew: !!m.isNew,
    id: m.id || null,
    type: m.type || 'sleep',
    kind: m.isNew ? null : eventKind(m),
    startedAt: tsToLocal(m.startedAt ?? simNow()),
    endedAt: tsToLocal(stale ? m.startedAt : m.endedAt),
    hasEnd: stale || m.endedAt != null,
    stale,
    note: m.note || '',
    amount: m.amount ?? null,
    planned: !!m.planned,
    teeth: Array.isArray(m.teeth) ? [...m.teeth] : [],
    // Контекст болезни: сохраняем для точного матчинга напоминаний (см. logic/illness)
    illnessId: m.illnessId ?? null,
    medId: m.medId ?? null
  }
}, { immediate: true })

// Для запланированных событий будущее разрешено
const timeMax = computed(() => (form.value?.planned ? undefined : maxLocal.value))

// Любая правка формы снимает прежнее предупреждение о пересечении
watch(form, () => {
  if (overlapConfirmed.value) { overlapConfirmed.value = false; error.value = '' }
}, { deep: true })

function fmt(ts) {
  return dayjs(ts).format('DD.MM HH:mm')
}

const typeDef = computed(() => EVENT_TYPES[form.value?.type] || EVENT_TYPES.sleep)

// «Вид» события: у новых — из реестра по выбранному типу (реагирует на смену
// типа в списке), у существующих — сохранённый на записи.
const kind = computed(() => {
  if (!form.value) return 'interval'
  if (form.value.isNew) return typeDef.value.kind
  return form.value.kind ?? typeDef.value.kind
})

// При отметке «уже закончилось» сразу подставляем текущий день и время,
// чтобы не заполнять поле окончания с нуля.
function onToggleEnd() {
  if (form.value.hasEnd && !form.value.endedAt) {
    form.value.endedAt = tsToLocal(simNow())
  }
}

async function save() {
  const f = form.value
  const startedAt = localToTs(f.startedAt)
  const endedAt = kind.value === 'interval' && f.hasEnd ? localToTs(f.endedAt) : null
  if (!startedAt) { error.value = 'Укажите время начала'; return }
  if (kind.value === 'interval' && f.hasEnd && endedAt == null) { error.value = 'Укажите время окончания'; return }
  if (endedAt != null && endedAt <= startedAt) { error.value = 'Окончание должно быть позже начала'; return }
  // Поля — с точностью до минуты, поэтому допускаем текущую минуту целиком
  const limit = simNow() + 60000
  if (!f.planned && (startedAt > limit || (endedAt != null && endedAt > limit))) {
    error.value = 'Время не может быть в будущем'
    return
  }

  const amount = typeDef.value.amountUnit ? parseAmount(f.amount) : null
  if (Number.isNaN(amount)) { error.value = `Проверьте значение (${typeDef.value.amountUnit})`; return }
  const data = { type: f.type, startedAt, endedAt, note: f.note.trim(), kind: kind.value, amount, planned: !!f.planned }
  if (f.type === 'teeth') data.teeth = [...f.teeth]
  if (f.illnessId != null) data.illnessId = f.illnessId
  if (f.medId != null) data.medId = f.medId

  // Запланированные события не участвуют в проверке пересечений снов
  const conflict = data.planned
    ? null
    : findSleepConflict(events.sorted.filter(e => !e.planned), { ...data, id: f.id }, simNow())
  if (conflict?.kind === 'open') {
    error.value = `Уже идёт другой сон (с ${fmt(conflict.other.startedAt)}). Сначала отметьте его окончание.`
    return
  }
  if (conflict?.kind === 'overlap' && !overlapConfirmed.value) {
    const o = conflict.other
    error.value = `Пересекается с другим сном (${fmt(o.startedAt)} – ${o.endedAt ? dayjs(o.endedAt).format('HH:mm') : 'сейчас'}). ` +
      'Проверьте время или нажмите «Сохранить всё равно».'
    overlapConfirmed.value = true
    return
  }

  if (f.isNew) await events.add(data)
  else await events.update({ ...props.model, ...data })
  emit('close')
}

async function remove() {
  if (!confirm('Удалить это событие?')) return
  await events.remove(form.value.id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="form" class="sheet-backdrop" @click.self="emit('close')">
        <div class="sheet">
          <div class="sheet-handle"></div>
          <h2>{{ form.isNew ? 'Новое событие' : 'Изменить событие' }}</h2>

          <!-- Уже было / запланировано (только в Календаре) -->
          <div v-if="allowPlan" class="field">
            <label>Статус</label>
            <div class="chips">
              <button class="chip" :class="{ active: !form.planned }" :aria-pressed="!form.planned" @click="form.planned = false"><Icon name="check" :size="16" /> Уже было</button>
              <button class="chip" :class="{ active: form.planned }" :aria-pressed="form.planned" @click="form.planned = true"><Icon name="calendar" :size="16" /> Запланировано</button>
            </div>
          </div>

          <div v-if="form.isNew" class="field">
            <label for="ev-type">Тип события</label>
            <select id="ev-type" v-model="form.type">
              <option v-for="t in typeOptions" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
            </select>
          </div>

          <div class="field">
            <label for="ev-start">{{ kind === 'interval' ? 'Начало' : 'Время' }}</label>
            <input id="ev-start" v-model="form.startedAt" type="datetime-local" :max="timeMax" />
          </div>

          <template v-if="kind === 'interval'">
            <div class="field row check-row">
              <input id="hasEnd" v-model="form.hasEnd" type="checkbox" class="checkbox" @change="onToggleEnd" />
              <label for="hasEnd" class="check-label">Уже закончилось</label>
            </div>
            <div v-if="form.hasEnd" class="field">
              <label for="ev-end">Окончание</label>
              <input id="ev-end" v-model="form.endedAt" type="datetime-local" :max="timeMax" />
              <p v-if="form.stale" class="muted small hint">Сон идёт больше 16 часов — укажите, когда малыш проснулся.</p>
            </div>
          </template>

          <div v-if="typeDef.amountUnit" class="field">
            <label for="ev-amount">Количество, {{ typeDef.amountUnit }}</label>
            <input id="ev-amount" v-model="form.amount" type="text" inputmode="decimal" placeholder="Например, 37,5" />
          </div>

          <div v-if="form.type === 'teeth'" class="field">
            <label>Прорезавшиеся зубы <span class="muted small">· {{ form.teeth.length }}</span></label>
            <ToothChart v-model="form.teeth" />
          </div>

          <div class="field">
            <label for="ev-note">Заметка</label>
            <input id="ev-note" v-model="form.note" type="text" :placeholder="typeDef.notePlaceholder || 'Необязательно'" />
          </div>

          <p v-if="error" class="error small">{{ error }}</p>

          <div class="row actions">
            <button v-if="!form.isNew" class="btn danger" @click="remove"><Icon name="trash" :size="18" /> Удалить</button>
            <span class="grow"></span>
            <button class="btn secondary" @click="emit('close')">Отмена</button>
            <button class="btn" @click="save">{{ overlapConfirmed ? 'Сохранить всё равно' : 'Сохранить' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: var(--c-overlay);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 560px;
  background: var(--c-surface);
  border-radius: var(--radius) var(--radius) 0 0;
  border-top: 1px solid var(--c-border);
  padding: var(--sp-2) var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  max-height: 88dvh;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--c-border);
  margin: 6px auto var(--sp-3);
}

.field { margin-bottom: var(--sp-3); }

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

.check-row { margin: var(--sp-1) 0 var(--sp-3); }

.checkbox {
  width: 22px;
  height: 22px;
  min-height: 22px;
  margin: 0;
  accent-color: var(--c-primary);
}

.check-label {
  margin: 0;
  font-size: var(--fs-base);
  color: var(--c-text);
}

.error { color: var(--c-urgent); }

.hint { margin: 6px 0 0; }

.actions { margin-top: var(--sp-4); flex-wrap: wrap; }
</style>
