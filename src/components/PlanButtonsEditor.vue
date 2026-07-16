<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

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
  <p class="muted small">
    Свои кнопки для «Календаря»: нажатие на кнопку сразу добавляет план
    с этим названием на выбранный день. Выполнение отмечается галочкой в календаре.
  </p>

  <div v-for="btn in settings.planButtons" :key="btn.id" class="row btn-row">
    <span class="pin">📌</span>
    <input class="grow" type="text" :value="btn.name" @change="rename(btn, $event)" />
    <button class="btn danger remove" title="Удалить кнопку" @click="remove(btn)">✕</button>
  </div>

  <form class="row btn-row" @submit.prevent="add">
    <input v-model="newName" class="grow" type="text" placeholder="Например, «Бассейн с мамой»" />
    <button class="btn add" type="submit" :disabled="!newName.trim()">＋</button>
  </form>
</template>

<style scoped>
.btn-row { margin-bottom: 8px; }

.btn-row:last-child { margin-bottom: 0; }

.pin { font-size: 18px; }

.remove,
.add {
  flex-shrink: 0;
  width: 44px;
  padding: 10px 0;
}

.add:disabled { opacity: 0.5; }
</style>
