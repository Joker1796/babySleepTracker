<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore, CHILD_COLORS } from '../stores/children'
import { GENDERS, FEEDING_TYPES, SLEEP_AIDS } from '../data/childOptions'
import { EVENT_TYPES, MAIN_BUTTON_TYPE_LIST, getMainButtons } from '../data/eventTypes'

const props = defineProps({
  child: { type: Object, default: null }
})
const emit = defineEmits(['saved', 'cancel', 'delete'])

const store = useChildrenStore()

const name = ref(props.child?.name || '')
const birthDate = ref(props.child?.birthDate || '')
const gender = ref(props.child?.gender || null)
const color = ref(props.child?.color || CHILD_COLORS[store.children.length % CHILD_COLORS.length])
const feeding = ref(props.child?.feeding || 'breast')
const aids = ref([...(props.child?.aids || [])])
// Кнопки главного экрана: [{ type, mode: 'time' | 'count' }]
const mainButtons = ref(getMainButtons(props.child).map(b => ({ ...b })))
const hideHints = ref(props.child?.hideHints || false)
const error = ref('')
const justSaved = ref(false)  // подсветка кнопки «✓ Сохранено» сразу после сохранения
let savedTimer = null

const today = dayjs().format('YYYY-MM-DD')

function toggleAid(id) {
  const i = aids.value.indexOf(id)
  if (i === -1) aids.value.push(id)
  else aids.value.splice(i, 1)
}

// Строки пикера: «Левая»/«Правая» грудь сводим в один переключатель «Грудь»
// (в mainButtons при этом по-прежнему лежат оба типа — на главном две кнопки).
const pickerRows = computed(() =>
  MAIN_BUTTON_TYPE_LIST
    .filter(t => t.id !== 'feedRight')
    .map(t => t.id === 'feedLeft'
      ? { id: 'breast', icon: '🤱', btnLabel: 'Грудь', kind: 'point', canTime: true, combined: ['feedLeft', 'feedRight'] }
      : t)
)

function rowIds(row) {
  return row.combined || [row.id]
}
function defaultMode(type) {
  return EVENT_TYPES[type].kind === 'interval' ? 'time' : 'count'
}

function isEnabled(row) {
  return rowIds(row).some(id => mainButtons.value.some(b => b.type === id))
}
function toggleType(row) {
  const ids = rowIds(row)
  if (isEnabled(row)) {
    mainButtons.value = mainButtons.value.filter(b => !ids.includes(b.type))
  } else {
    for (const id of ids) mainButtons.value.push({ type: id, mode: defaultMode(id) })
  }
}
function modeOf(row) {
  for (const id of rowIds(row)) {
    const b = mainButtons.value.find(b => b.type === id)
    if (b) return b.mode
  }
}
function setMode(row, mode) {
  for (const id of rowIds(row)) {
    const b = mainButtons.value.find(b => b.type === id)
    if (b) b.mode = mode
  }
}

async function save() {
  if (!name.value.trim()) { error.value = 'Введите имя'; return }
  if (!birthDate.value) { error.value = 'Укажите дату рождения'; return }
  if (birthDate.value > today) { error.value = 'Дата рождения в будущем' ; return }
  const data = {
    name: name.value.trim(),
    birthDate: birthDate.value,
    gender: gender.value,
    color: color.value,
    feeding: feeding.value,
    aids: [...aids.value],
    mainButtons: mainButtons.value.map(b => ({ ...b })),
    hideHints: hideHints.value
  }
  if (props.child) {
    await store.update({ ...props.child, ...data })
  } else {
    await store.add(data)
  }
  emit('saved')
  justSaved.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { justSaved.value = false }, 1600)
}
</script>

<template>
  <div>
    <div class="field">
      <label>Имя</label>
      <input v-model="name" type="text" placeholder="Например, Миша" autocomplete="off" />
    </div>
    <div class="field">
      <label>Дата рождения</label>
      <input v-model="birthDate" type="date" :max="today" />
    </div>
    <div class="field">
      <label>Пол</label>
      <div class="chips">
        <button
          v-for="g in GENDERS"
          :key="g.id"
          class="chip"
          :class="{ active: gender === g.id }"
          @click="gender = g.id"
        >{{ g.icon }} {{ g.label }}</button>
      </div>
    </div>
    <div class="field">
      <label>Кормление</label>
      <div class="chips">
        <button
          v-for="f in FEEDING_TYPES"
          :key="f.id"
          class="chip"
          :class="{ active: feeding === f.id }"
          @click="feeding = f.id"
        >{{ f.icon }} {{ f.label }}</button>
      </div>
    </div>
    <div class="field">
      <label>Кнопки на главном экране</label>
      <div class="mb-list">
        <div v-for="t in pickerRows" :key="t.id" class="mb-row">
          <button
            class="chip mb-toggle"
            :class="{ active: isEnabled(t) }"
            @click="toggleType(t)"
          >{{ t.icon }} {{ t.btnLabel || t.label }}</button>
          <div v-if="isEnabled(t) && (t.kind === 'interval' || t.canTime)" class="mb-modes">
            <button class="chip sm" :class="{ active: modeOf(t) === 'time' }" @click="setMode(t, 'time')">Время</button>
            <button class="chip sm" :class="{ active: modeOf(t) === 'count' }" @click="setMode(t, 'count')">Кол-во</button>
          </div>
        </div>
      </div>
      <p class="muted small hint">Эти кнопки появятся на главном экране. «Время» — засекает длительность (старт/стоп), «Кол-во» — считает нажатия.</p>
    </div>
    <div class="field">
      <label>Что используете для сна</label>
      <div class="chips aids-chips">
        <button
          v-for="a in SLEEP_AIDS"
          :key="a.id"
          class="chip"
          :class="{ active: aids.includes(a.id) }"
          @click="toggleAid(a.id)"
        >{{ a.icon }} {{ a.label }}</button>
      </div>
      <p class="muted small hint">Подсказки будут учитывать выбранное — например, напомнят, когда пора уходить от пеленания.</p>
    </div>
    <div class="field">
      <label>Подсказки</label>
      <div class="row hint-row">
        <div class="grow muted small">Скрывать приветствие, поддержку и карточки-подсказки на «Сегодня» для этого ребёнка. Поздравления остаются.</div>
        <button
          class="chip"
          :class="{ active: hideHints }"
          @click="hideHints = !hideHints"
        >{{ hideHints ? 'Скрыты' : 'Показаны' }}</button>
      </div>
    </div>
    <div class="field">
      <label>Цвет</label>
      <div class="colors">
        <button
          v-for="c in CHILD_COLORS"
          :key="c"
          class="swatch"
          :class="{ active: color === c }"
          :style="{ background: c }"
          @click="color = c"
        ></button>
      </div>
    </div>
    <p v-if="error" class="error small">{{ error }}</p>
    <div class="row">
      <button v-if="child" class="btn secondary grow" @click="emit('cancel')">Отмена</button>
      <button class="btn grow" :class="{ ok: justSaved }" @click="save">
        {{ justSaved ? '✓ Сохранено' : (child ? 'Сохранить' : 'Добавить') }}
      </button>
    </div>
    <button v-if="child" class="btn danger block delete-btn" @click="emit('delete')">
      🗑 Удалить ребёнка
    </button>
  </div>
</template>

<style scoped>
/* Подтверждение сохранения прямо на кнопке */
.btn.ok {
  background: var(--c-walk);
  color: #fff;
}

.field { margin-bottom: 12px; }

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hint { margin-top: 6px; }

.hint-row {
  align-items: center;
  gap: 12px;
}

/* Настройка кнопок главного экрана */
.mb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mb-toggle { flex: 1; min-width: 140px; text-align: left; }

.mb-modes {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.chip.sm {
  font-size: 12px;
  padding: 6px 10px;
  min-height: 34px;
}

/* Компактные чипы блока «Что используете для сна» */
.aids-chips .chip {
  font-size: 12px;
  padding: 6px 10px;
  min-height: 34px;
}

.colors {
  display: flex;
  gap: 10px;
}

.swatch {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid transparent;
}

.swatch.active {
  border-color: var(--c-text);
}

.error { color: var(--c-urgent); }

.delete-btn { margin-top: 10px; }
</style>
