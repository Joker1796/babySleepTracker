<script setup>
import { ref, watch, computed } from 'vue'
import dayjs from 'dayjs'
import { simNow } from '../composables/useNow'
import { useIllnessStore } from '../stores/illness'
import { FREQUENCY_HOURS, frequencyLabel, newMedication, TEMP_NIGHT_EVERY_HOURS } from '../data/illness'

// Форма данных о болезни. После сохранения сворачивается в шапку с названием и
// датой начала; по клику разворачивается для правки. Пишет в стор целиком.
const props = defineProps({
  illness: { type: Object, required: true }
})

const illness = useIllnessStore()

// Локальная редактируемая копия — сохраняем в стор по кнопке.
const form = ref(makeForm(props.illness))
// Свежая болезнь (без названия) открыта сразу; заполненная — свёрнута.
const expanded = ref(!props.illness.name)

function tsToLocal(ts) {
  return ts == null ? '' : dayjs(ts).format('YYYY-MM-DDTHH:mm')
}
function localToTs(str) {
  return str ? dayjs(str).valueOf() : null
}

function makeForm(ill) {
  return {
    name: ill.name || '',
    doctorNote: ill.doctorNote || '',
    doctorAt: tsToLocal(ill.doctorAt),
    medications: (ill.medications || []).map(m => ({ ...m })),
    waterEveryHours: ill.waterEveryHours ?? null,
    foodEveryHours: ill.foodEveryHours ?? null,
    tempDayEveryHours: ill.tempDayEveryHours ?? null
  }
}

// Если болезнь сменилась (другой ребёнок) — пересобираем форму.
watch(() => props.illness.id, () => {
  form.value = makeForm(props.illness)
  expanded.value = !props.illness.name
})

const startedLabel = computed(() => dayjs(props.illness.startedAt).format('D MMMM'))

function addMed() {
  form.value.medications.push({ ...newMedication(), startedAt: simNow() })
}
function removeMed(id) {
  form.value.medications = form.value.medications.filter(m => m.id !== id)
}

async function save() {
  const f = form.value
  await illness.save({
    ...props.illness,
    name: f.name.trim(),
    doctorNote: f.doctorNote.trim(),
    doctorAt: localToTs(f.doctorAt),
    medications: f.medications.map(m => ({
      ...m,
      name: (m.name || '').trim(),
      everyHours: Number(m.everyHours),
      days: Number(m.days),
      startedAt: m.startedAt ?? simNow()
    })),
    waterEveryHours: f.waterEveryHours == null ? null : Number(f.waterEveryHours),
    foodEveryHours: f.foodEveryHours == null ? null : Number(f.foodEveryHours),
    tempDayEveryHours: f.tempDayEveryHours == null ? null : Number(f.tempDayEveryHours)
  })
  expanded.value = false
}
</script>

<template>
  <div class="card setup">
    <!-- Свёрнутая шапка -->
    <button class="head" @click="expanded = !expanded">
      <span class="grow">
        <span class="head-title">{{ props.illness.name || 'Новая болезнь' }}</span>
        <span class="head-sub muted small">болеем с {{ startedLabel }}</span>
      </span>
      <span class="chevron" :class="{ open: expanded }">›</span>
    </button>

    <Transition name="fade">
      <div v-if="expanded" class="body">
        <div class="field">
          <label>Название заболевания</label>
          <input v-model="form.name" type="text" placeholder="Например, ОРВИ" />
        </div>

        <div class="field">
          <label>Рекомендации врача</label>
          <textarea v-model="form.doctorNote" rows="2" placeholder="Что назначил врач"></textarea>
        </div>
        <div class="field">
          <label>Когда были у врача</label>
          <input v-model="form.doctorAt" type="datetime-local" />
        </div>

        <!-- Лекарства -->
        <div class="field">
          <label>Назначенные лекарства</label>
          <div v-for="med in form.medications" :key="med.id" class="med">
            <input v-model="med.name" type="text" class="med-name" placeholder="Название лекарства" />
            <div class="med-row">
              <select v-model.number="med.everyHours" class="med-freq">
                <option v-for="h in FREQUENCY_HOURS" :key="h" :value="h">{{ frequencyLabel(h) }}</option>
              </select>
              <div class="med-days">
                <input v-model.number="med.days" type="number" min="1" max="60" inputmode="numeric" />
                <span class="unit muted small">дней</span>
              </div>
              <button class="med-del" aria-label="Удалить лекарство" @click="removeMed(med.id)">✕</button>
            </div>
          </div>
          <button class="btn secondary add-med" @click="addMed">＋ Добавить лекарство</button>
        </div>

        <!-- Напоминания пить / есть -->
        <div class="field">
          <label>Напоминать пить воду</label>
          <select v-model="form.waterEveryHours">
            <option :value="null">не напоминать</option>
            <option v-for="h in FREQUENCY_HOURS" :key="h" :value="h">{{ frequencyLabel(h) }}</option>
          </select>
        </div>
        <div class="field">
          <label>Напоминать кормить</label>
          <select v-model="form.foodEveryHours">
            <option :value="null">не напоминать</option>
            <option v-for="h in FREQUENCY_HOURS" :key="h" :value="h">{{ frequencyLabel(h) }}</option>
          </select>
        </div>

        <!-- Температура -->
        <div class="field">
          <label>Измерять температуру днём</label>
          <select v-model="form.tempDayEveryHours">
            <option :value="null">не напоминать днём</option>
            <option v-for="h in FREQUENCY_HOURS" :key="h" :value="h">{{ frequencyLabel(h) }}</option>
          </select>
          <p class="muted small hint">Ночью напомним измерить каждые {{ TEMP_NIGHT_EVERY_HOURS }} часа.</p>
        </div>

        <button class="btn block" @click="save">Сохранить</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.setup { padding: 8px 14px 12px; }

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 2px;
}

.head-title { display: block; font-size: 17px; font-weight: 700; }
.head-sub { display: block; }

.chevron {
  font-size: 22px;
  color: var(--c-text-soft);
  transition: transform 0.2s;
}
.chevron.open { transform: rotate(90deg); }

.body { padding-top: 6px; }

.field { margin-bottom: 12px; }

.med {
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  padding: 8px;
  margin-bottom: 8px;
  background: var(--c-surface-2);
}
.med-name { margin-bottom: 8px; }

.med-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.med-freq { flex: 1; }

.med-days {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.med-days input { width: 64px; text-align: center; }

.med-del {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  color: var(--c-text-soft);
  font-size: 16px;
}

.add-med { width: 100%; }

.hint { margin: 6px 0 0; }
</style>
