<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import Icon from './Icon.vue'

const settings = useSettingsStore()
const newName = ref('')

function add() {
  settings.addPlanButton(newName.value)
  newName.value = ''
}

// Пустое имя не сохраняем — возвращаем в поле прежнее название
function rename(btn, e) {
  const name = e.target.value.trim()
  if (name) settings.renamePlanButton(btn.id, name)
  else e.target.value = btn.name
}

function remove(btn) {
  if (!confirm(`Удалить кнопку «${btn.name}»? Уже добавленные планы останутся.`)) return
  settings.removePlanButton(btn.id)
}
</script>

<template>
  <p class="muted small intro">
    Свои кнопки для «Календаря»: нажатие на кнопку сразу добавляет план
    с этим названием на выбранный день. Выполнение отмечается галочкой в календаре.
  </p>

  <div v-for="btn in settings.planButtons" :key="btn.id" class="row btn-row">
    <Icon name="pin" :size="18" class="pin" />
    <input class="grow" type="text" :value="btn.name" :aria-label="`Название кнопки «${btn.name}»`" @change="rename(btn, $event)" />
    <button class="icon-btn danger" :aria-label="`Удалить кнопку «${btn.name}»`" @click="remove(btn)">
      <Icon name="trash" :size="20" />
    </button>
  </div>

  <form class="row btn-row" @submit.prevent="add">
    <input v-model="newName" class="grow" type="text" placeholder="Например, «Бассейн с мамой»" aria-label="Название новой кнопки" />
    <button class="icon-btn add" type="submit" :disabled="!newName.trim()" aria-label="Добавить кнопку">
      <Icon name="plus" :size="20" />
    </button>
  </form>
</template>

<style scoped>
.intro { line-height: 1.45; margin-bottom: var(--sp-3); }

.btn-row { margin-bottom: var(--sp-2); }

.btn-row:last-child { margin-bottom: 0; }

.pin { color: var(--c-text-soft); flex-shrink: 0; }

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border);
  color: var(--c-text);
}

.icon-btn.danger { color: var(--c-urgent); }

.add:disabled { opacity: 0.4; }
</style>
