<script setup>
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore, CHILD_COLORS } from '../stores/children'
import { GENDERS, FEEDING_TYPES, SLEEP_AIDS } from '../data/childOptions'

const props = defineProps({
  child: { type: Object, default: null }
})
const emit = defineEmits(['saved', 'cancel'])

const store = useChildrenStore()

const name = ref(props.child?.name || '')
const birthDate = ref(props.child?.birthDate || '')
const dueDate = ref(props.child?.dueDate || '')
const gender = ref(props.child?.gender || null)
const color = ref(props.child?.color || CHILD_COLORS[store.children.length % CHILD_COLORS.length])
const feeding = ref(props.child?.feeding || 'breast')
const aids = ref([...(props.child?.aids || [])])
const error = ref('')

const today = dayjs().format('YYYY-MM-DD')

function toggleAid(id) {
  const i = aids.value.indexOf(id)
  if (i === -1) aids.value.push(id)
  else aids.value.splice(i, 1)
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
    aids: [...aids.value]
  }
  if (props.child) {
    await store.update({ ...props.child, ...data })
  } else {
    await store.add(data)
  }
  emit('saved')
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
          :aria-pressed="feeding === f.id"
          @click="feeding = f.id"
        >{{ f.icon }} {{ f.label }}</button>
      </div>
    </div>
    <div class="field">
      <label>Что используете для сна</label>
      <div class="chips">
        <button
          v-for="a in SLEEP_AIDS"
          :key="a.id"
          class="chip"
          :class="{ active: aids.includes(a.id) }"
          :aria-pressed="aids.includes(a.id)"
          @click="toggleAid(a.id)"
        >{{ a.icon }} {{ a.label }}</button>
      </div>
      <p class="muted small hint">Подсказки будут учитывать выбранное — например, напомнят, когда пора уходить от пеленания.</p>
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
      <button class="btn grow" @click="save">{{ child ? 'Сохранить' : 'Добавить' }}</button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
