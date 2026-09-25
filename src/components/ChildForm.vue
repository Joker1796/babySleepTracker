<script setup>
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore, CHILD_COLORS } from '../stores/children'
import { ageInMonths } from '../logic/age'
import { GENDERS, FEEDING_TYPES } from '../data/childOptions'
import { EVENT_TYPES, MAIN_BUTTON_TYPE_LIST, getMainButtons, typesForAge } from '../data/eventTypes'
import Icon from './Icon.vue'

const props = defineProps({
  child: { type: Object, default: null }
})
const emit = defineEmits(['saved', 'cancel', 'delete'])

const store = useChildrenStore()

const name = ref(props.child?.name || '')
const birthDate = ref(props.child?.birthDate || '')
const dueDate = ref(props.child?.dueDate || '')
const gender = ref(props.child?.gender || null)
const color = ref(props.child?.color || CHILD_COLORS[store.children.length % CHILD_COLORS.length])
const feeding = ref(props.child?.feeding || 'breast')
// Кнопки главного экрана: [{ type, mode: 'time' | 'count' }]
const mainButtons = ref(getMainButtons(props.child).map(b => ({ ...b })))
const hideHints = ref(props.child?.hideHints || false)
const error = ref('')
const justSaved = ref(false)  // подсветка кнопки «Сохранено» сразу после сохранения
let savedTimer = null

const today = dayjs().format('YYYY-MM-DD')

// Строки пикера: «Левая»/«Правая» грудь сводим в один переключатель «Грудь»
// (в mainButtons при этом по-прежнему лежат оба типа — на главном две кнопки).
const ageM = computed(() => birthDate.value ? ageInMonths(birthDate.value) : null)
const pickerRows = computed(() =>
  typesForAge(MAIN_BUTTON_TYPE_LIST, ageM.value)
    .filter(t => t.id !== 'feedRight')
    .map(t => t.id === 'feedLeft'
      ? { id: 'breast', iconName: 'breast', btnLabel: 'Грудь', kind: 'point', canTime: true, combined: ['feedLeft', 'feedRight'] }
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
  // ПДР не может быть позже рождения больше чем на ~5 месяцев (22 недели беременности)
  if (dueDate.value && dayjs(dueDate.value).diff(dayjs(birthDate.value), 'week') > 22) {
    error.value = 'Проверьте предполагаемую дату родов — она слишком далеко от даты рождения'
    return
  }
  const data = {
    name: name.value.trim(),
    birthDate: birthDate.value,
    dueDate: dueDate.value || null,
    gender: gender.value,
    color: color.value,
    feeding: feeding.value,
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
      <label>Предполагаемая дата родов — если малыш родился раньше срока</label>
      <input v-model="dueDate" type="date" :min="birthDate || undefined" />
      <p class="muted small hint">Необязательно. Если малыш родился раньше срока на 2 недели и больше, нормы сна и советы до двух лет будут считаться по корректированному возрасту — от ПДР.</p>
    </div>
    <div class="field">
      <label>Пол</label>
      <div class="chips">
        <button
          v-for="g in GENDERS"
          :key="g.id"
          class="chip"
          :class="{ active: gender === g.id }"
          :aria-pressed="gender === g.id"
          @click="gender = g.id"
        >{{ g.label }}</button>
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
          :aria-pressed="feeding === f.id"
          @click="feeding = f.id"
        >{{ f.label }}</button>
      </div>
    </div>
    <div class="field">
      <label>Кнопки на главном экране</label>
      <div class="mb-list">
        <div v-for="t in pickerRows" :key="t.id" class="mb-row">
          <button
            class="chip mb-toggle"
            :class="{ active: isEnabled(t) }"
            :aria-pressed="isEnabled(t)"
            @click="toggleType(t)"
          ><Icon :name="t.iconName" :size="18" /> {{ t.btnLabel || t.label }}</button>
          <div v-if="isEnabled(t) && (t.kind === 'interval' || t.canTime)" class="mb-modes">
            <button class="chip sm" :class="{ active: modeOf(t) === 'time' }" :aria-pressed="modeOf(t) === 'time'" @click="setMode(t, 'time')">Время</button>
            <button class="chip sm" :class="{ active: modeOf(t) === 'count' }" :aria-pressed="modeOf(t) === 'count'" @click="setMode(t, 'count')">Кол-во</button>
          </div>
        </div>
      </div>
      <p class="muted small hint">Эти кнопки появятся на главном экране. «Время» — засекает длительность (старт/стоп), «Кол-во» — считает нажатия.</p>
    </div>
    <div class="field">
      <label>Подсказки</label>
      <div class="row hint-row">
        <div class="grow muted small">Скрывать все подсказки на «Сегодня» для этого ребёнка: приветствие, достижение дня, совет по настройке и карточки-подсказки. Пока переключатель включён — они не появятся; поздравления с месяцем и годом остаются.</div>
        <button
          class="chip"
          :class="{ active: hideHints }"
          :aria-pressed="hideHints"
          @click="hideHints = !hideHints"
        >{{ hideHints ? 'Скрыты' : 'Показаны' }}</button>
      </div>
    </div>
    <div class="field">
      <label>Цвет</label>
      <div class="colors">
        <button
          v-for="(c, i) in CHILD_COLORS"
          :key="c"
          class="swatch"
          :class="{ active: color === c }"
          :aria-label="`Цвет профиля ${i + 1}`"
          :aria-pressed="color === c"
          @click="color = c"
        ><span class="swatch-dot" :style="{ background: c }"></span></button>
      </div>
    </div>
    <p v-if="error" class="error small">{{ error }}</p>
    <div class="row actions">
      <button v-if="child" class="btn secondary grow" @click="emit('cancel')">Отмена</button>
      <button class="btn grow" :class="{ ok: justSaved }" @click="save">
        <template v-if="justSaved"><Icon name="check" :size="18" /> Сохранено</template>
        <template v-else>{{ child ? 'Сохранить' : 'Добавить' }}</template>
      </button>
    </div>
    <button v-if="child" class="btn danger block delete-btn" @click="emit('delete')">
      <Icon name="trash" :size="18" /> Удалить ребёнка
    </button>
  </div>
</template>

<style scoped>
/* Подтверждение сохранения прямо на кнопке */
.btn.ok {
  background: var(--c-walk);
  color: var(--c-on-primary);
}

.field { margin-bottom: var(--sp-4); }

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}

/* Чипы выбора — обводка; активный залит чернилами. Высота 44px для касания */
.chips .chip {
  min-height: 44px;
  font-size: var(--fs-sm);
  color: var(--c-text);
}

.chips .chip.active { color: var(--c-on-primary); }

.hint { margin: var(--sp-2) 0 0; line-height: 1.45; }

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

.mb-toggle { flex: 1; min-width: 140px; text-align: left; justify-content: flex-start; }

.mb-modes {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.chip.sm {
  font-size: var(--fs-xs);
  padding: 6px 12px;
  min-height: 44px;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}

.swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid transparent;
}

.swatch.active { border-color: var(--c-text); }

.swatch-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.error { color: var(--c-urgent); }

.actions { margin-top: var(--sp-2); }
.delete-btn { margin-top: var(--sp-3); }
</style>
