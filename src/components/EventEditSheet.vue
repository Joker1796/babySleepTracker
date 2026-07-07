<script setup>
import { ref, watch, computed } from 'vue'
import dayjs from 'dayjs'
import { useEventsStore } from '../stores/events'
import { simNow } from '../composables/useNow'
import { EVENT_TYPES, EVENT_TYPE_LIST, eventKind } from '../data/eventTypes'

// model: null (закрыт) | { isNew: true, type?, startedAt? } | существующее событие
const props = defineProps({
  model: { type: Object, default: null }
})
const emit = defineEmits(['close'])

const events = useEventsStore()

const form = ref(null)
const error = ref('')

function tsToLocal(ts) {
  return ts == null ? '' : dayjs(ts).format('YYYY-MM-DDTHH:mm')
}
function localToTs(str) {
  return str ? dayjs(str).valueOf() : null
}

watch(() => props.model, m => {
  error.value = ''
  if (!m) { form.value = null; return }
  form.value = {
    isNew: !!m.isNew,
    id: m.id || null,
    type: m.type || 'sleep',
    kind: m.isNew ? null : eventKind(m),
    startedAt: tsToLocal(m.startedAt ?? simNow()),
    endedAt: tsToLocal(m.endedAt),
    hasEnd: m.endedAt != null,
    note: m.note || '',
    amount: m.amount ?? null
  }
}, { immediate: true })

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
  if (endedAt != null && endedAt <= startedAt) { error.value = 'Окончание должно быть позже начала'; return }

  const amount = typeDef.value.amountUnit && f.amount !== '' && f.amount != null
    ? Number(f.amount)
    : null
  const data = { type: f.type, startedAt, endedAt, note: f.note.trim(), kind: kind.value, amount }
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

          <div v-if="form.isNew" class="field">
            <label>Тип события</label>
            <select v-model="form.type">
              <option v-for="t in EVENT_TYPE_LIST" :key="t.id" :value="t.id">{{ t.icon }} {{ t.label }}</option>
            </select>
          </div>

          <div class="field">
            <label>{{ kind === 'interval' ? 'Начало' : 'Время' }}</label>
            <input v-model="form.startedAt" type="datetime-local" />
          </div>

          <template v-if="kind === 'interval'">
            <div class="field row check-row">
              <input id="hasEnd" v-model="form.hasEnd" type="checkbox" class="checkbox" @change="onToggleEnd" />
              <label for="hasEnd" class="check-label">Уже закончилось</label>
            </div>
            <div v-if="form.hasEnd" class="field">
              <label>Окончание</label>
              <input v-model="form.endedAt" type="datetime-local" />
            </div>
          </template>

          <div v-if="typeDef.amountUnit" class="field">
            <label>Количество, {{ typeDef.amountUnit }}</label>
            <input v-model="form.amount" type="number" step="0.1" min="0" inputmode="decimal" />
          </div>

          <div class="field">
            <label>Заметка</label>
            <input v-model="form.note" type="text" :placeholder="typeDef.notePlaceholder || 'Необязательно'" />
          </div>

          <p v-if="error" class="error small">{{ error }}</p>

          <div class="row actions">
            <button v-if="!form.isNew" class="btn danger" @click="remove">Удалить</button>
            <span class="grow"></span>
            <button class="btn secondary" @click="emit('close')">Отмена</button>
            <button class="btn" @click="save">Сохранить</button>
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
  background: rgba(10, 12, 24, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 560px;
  background: var(--c-surface);
  border-radius: 20px 20px 0 0;
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px));
  max-height: 88dvh;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--c-border);
  margin: 6px auto 14px;
}

.field { margin-bottom: 12px; }

.check-row { margin: 4px 0 12px; }

.checkbox {
  width: 22px;
  height: 22px;
  min-height: 22px;
  margin: 0;
  accent-color: var(--c-primary);
}

.check-label {
  margin: 0;
  font-size: 15px;
  color: var(--c-text);
}

.error { color: var(--c-urgent); }

.actions { margin-top: 16px; }
</style>
