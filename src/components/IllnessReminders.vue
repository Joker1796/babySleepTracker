<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useNow } from '../composables/useNow'
import { buildReminders } from '../logic/illness'

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
    <div class="card-title">🔔 Напоминания</div>

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
          @click="emit('log', r)"
        >
          <span class="rem-icon">{{ r.icon }}</span>
          <span class="grow">
            <span class="rem-label">{{ r.label }}</span>
            <span class="rem-sub muted small">{{ overdueLabel(r.dueAt) }}</span>
          </span>
          <span class="rem-check">✓</span>
        </button>
      </div>

      <div v-if="upcoming.length" class="group">
        <div class="group-title">Дальше</div>
        <div v-for="r in upcoming" :key="r.key" class="rem-row">
          <span class="rem-icon">{{ r.icon }}</span>
          <span class="grow">
            <span class="rem-label">{{ r.label }}</span>
            <span class="rem-sub muted small">{{ whenLabel(r.dueAt) }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reminders { padding-bottom: 8px; }
.empty { margin: 4px 0 6px; }

.group { margin-bottom: 6px; }
.group + .group { margin-top: 10px; }

.group-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}
.group-title.now { color: var(--c-urgent); }

.rem-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 8px 4px;
  border-bottom: 1px solid var(--c-border);
}
.rem-row:last-child { border-bottom: none; }

.rem-row.due {
  border-radius: var(--radius-sm);
  border-bottom: none;
  background: var(--c-urgent-soft);
  padding: 10px 12px;
  margin-bottom: 6px;
}

.rem-icon { font-size: 20px; }

.rem-label { display: block; font-size: 14px; font-weight: 600; }
.rem-sub { display: block; }

.rem-check {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--c-surface);
  color: var(--c-urgent);
  font-weight: 700;
}
</style>
