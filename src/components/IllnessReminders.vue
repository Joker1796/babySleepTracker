<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useNow } from '../composables/useNow'
import { buildReminders } from '../logic/illness'
import Icon from './Icon.vue'

// Панель «Напоминания»: показывает, что пора сделать сейчас и что дальше.
// В веб-прототипе это список на экране (звук/вибро добавим в приложении).
const props = defineProps({
  illness: { type: Object, required: true },
  events: { type: Array, default: () => [] }
})
const emit = defineEmits(['log'])
const now = useNow()

const reminders = computed(() =>
  buildReminders({ illness: props.illness, events: props.events, now: now.value })
)

// Линейная иконка по источнику напоминания (эмодзи из логики в UI не выводим)
const SOURCE_ICONS = { medicine: 'pill', water: 'cup', food: 'bowl', temp: 'thermometer' }
function iconOf(r) { return SOURCE_ICONS[r.source] || 'clock' }

const dueNow = computed(() => reminders.value.filter(r => r.overdue))
const upcoming = computed(() => reminders.value.filter(r => !r.overdue))

// «в 14:30» сегодня, иначе «завтра 09:00» или «12.07 09:00»
function whenLabel(ts) {
  const d = dayjs(ts)
  const today = dayjs(now.value)
  if (d.isSame(today, 'day')) return `в ${d.format('HH:mm')}`
  if (d.isSame(today.add(1, 'day'), 'day')) return `завтра ${d.format('HH:mm')}`
  return d.format('DD.MM HH:mm')
}

// «уже 40 мин назад» — насколько просрочено
function overdueLabel(ts) {
  const min = Math.round((now.value - ts) / 60000)
  if (min < 1) return 'сейчас'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} ч ${m} мин назад` : `${h} ч назад`
}
</script>

<template>
  <div class="card reminders">
    <div class="card-title">Напоминания</div>

    <p v-if="!reminders.length" class="muted small empty">
      Заполните данные о болезни выше — и здесь появятся напоминания.
    </p>

    <template v-else>
      <div v-if="dueNow.length" class="group">
        <div class="group-title now">Пора сейчас</div>
        <button
          v-for="r in dueNow"
          :key="r.key"
          class="rem-row due"
          :aria-label="`${r.label}: отметить выполненным`"
          @click="emit('log', r)"
        >
          <Icon :name="iconOf(r)" :size="20" class="rem-icon" />
          <span class="grow">
            <span class="rem-label">{{ r.label }}</span>
            <span class="rem-sub small num">{{ overdueLabel(r.dueAt) }}</span>
          </span>
          <span class="rem-check"><Icon name="check" :size="18" /></span>
        </button>
      </div>

      <div v-if="upcoming.length" class="group">
        <div class="group-title">Дальше</div>
        <div v-for="r in upcoming" :key="r.key" class="rem-row">
          <Icon :name="iconOf(r)" :size="20" class="rem-icon" />
          <span class="grow">
            <span class="rem-label">{{ r.label }}</span>
            <span class="rem-sub muted small num">{{ whenLabel(r.dueAt) }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reminders { padding-bottom: var(--sp-2); }
.empty { margin: var(--sp-1) 0 6px; line-height: 1.45; }

.group { margin-bottom: 6px; }
.group + .group { margin-top: var(--sp-3); }

.group-title {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}
.group-title.now { color: var(--c-urgent); }

/* Строки со сплошным разделителем, как в дневнике */
.rem-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  min-height: 52px;
  text-align: left;
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--c-border);
}
.rem-row:last-child { border-bottom: none; }

/* Просроченное — контурная строка с акцентом «срочно», без заливки */
.rem-row.due {
  border: 1px solid var(--c-urgent);
  border-radius: var(--radius-sm);
  padding: 10px var(--sp-3);
  margin-bottom: 6px;
}
.rem-row.due:last-child { border-bottom: 1px solid var(--c-urgent); }

.rem-icon { flex-shrink: 0; color: var(--c-text-soft); }
.rem-row.due .rem-icon { color: var(--c-urgent); }

.rem-label { display: block; font-size: var(--fs-base); font-weight: 500; }
.rem-sub { display: block; }
.rem-row.due .rem-sub { color: var(--c-urgent); }

.rem-check {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--c-urgent);
  color: var(--c-urgent);
}
</style>
