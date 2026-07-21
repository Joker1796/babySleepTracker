<script setup>
import { computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { ageInMonths } from '../logic/age'
import { complexForAge, GYMNASTICS_RULES, GYMNASTICS_NOTE } from '../data/gymnastics'

const children = useChildrenStore()
const now = useNow()

const ageMonths = computed(() =>
  children.activeChild ? ageInMonths(children.activeChild.birthDate, now.value) : null
)

const complex = computed(() => complexForAge(ageMonths.value))
</script>

<template>
  <div class="page">
    <h1 class="page-title">Гимнастика и массаж</h1>

    <template v-if="complex">
      <div class="card-title" style="margin: 12px 2px 8px">{{ complex.title }}</div>

      <!-- Памятка: общие правила занятий -->
      <div class="card rules">
        <ul>
          <li v-for="(rule, i) in GYMNASTICS_RULES" :key="i">{{ rule }}</li>
        </ul>
      </div>

      <!-- Упражнения комплекса -->
      <div class="card ex-card" v-for="(ex, i) in complex.exercises" :key="i">
        <div class="ex-head">
          <span class="ex-num">{{ i + 1 }}</span>
          <span class="ex-title grow">{{ ex.title }}</span>
          <span v-if="ex.isNew" class="badge-new">новое</span>
        </div>
        <p class="ex-text">{{ ex.text }}</p>
        <div v-if="ex.reps" class="ex-reps">{{ ex.reps }}</div>
      </div>

      <!-- Заботливая оговорка -->
      <p class="note">{{ GYMNASTICS_NOTE }}</p>
    </template>

    <div v-else class="card">
      <p>Комплекс для этого возраста пока готовится.</p>
    </div>
  </div>
</template>

<style scoped>
.rules {
  background: var(--c-info-soft);
  border: 1px solid var(--c-info);
}

.rules ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}

.rules li { margin-bottom: 4px; }
.rules li:last-child { margin-bottom: 0; }

.ex-card { margin-bottom: 8px; }

.ex-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ex-num {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--c-primary-soft);
  color: var(--c-primary);
  font-size: 12.5px;
  font-weight: 700;
}

.ex-title {
  font-weight: 600;
  font-size: 14.5px;
}

.badge-new {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--c-primary);
  color: var(--c-on-primary);
  font-size: 11px;
  font-weight: 600;
}

.ex-text {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
}

.ex-reps {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--c-text-soft);
}

.note {
  margin: 16px 2px 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--c-text-soft);
}
</style>
