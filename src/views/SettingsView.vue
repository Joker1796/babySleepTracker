<script setup>
import { ref } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettingsStore } from '../stores/settings'
import { formatAge } from '../logic/age'
import { getFeeding, getAid } from '../data/childOptions'
import { exportBackup, importBackup } from '../utils/backup'
import ChildForm from '../components/ChildForm.vue'

const children = useChildrenStore()
const events = useEventsStore()
const settings = useSettingsStore()

const editingChild = ref(null) // null | 'new' | объект ребёнка
const fileInput = ref(null)
const message = ref('')

const themes = [
  { id: 'auto', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' }
]

async function removeChild(child) {
  if (!confirm(`Удалить профиль «${child.name}» и все его события? Это действие необратимо.`)) return
  await children.remove(child.id)
  if (children.activeChild) await events.load(children.activeChild.id)
}

function onSaved() {
  editingChild.value = null
}

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const replace = confirm('Заменить текущие данные данными из файла?\n\n«ОК» — заменить всё.\n«Отмена» — добавить к существующим.')
  try {
    const res = await importBackup(file, { replace })
    await children.load()
    if (children.activeChild) await events.load(children.activeChild.id)
    message.value = `Импортировано: детей — ${res.children}, событий — ${res.events}`
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">Настройки</h1>

    <div class="card">
      <div class="card-title">Дети</div>
      <div v-for="child in children.children" :key="child.id">
        <div v-if="editingChild !== child" class="row child-row">
          <span class="dot" :style="{ background: child.color }"></span>
          <div class="grow">
            <b>{{ child.name }}</b>
            <div class="muted small">
              {{ formatAge(child.birthDate) }} · {{ child.birthDate }}
              <template v-if="getFeeding(child.feeding)"> · {{ getFeeding(child.feeding).icon }} {{ getFeeding(child.feeding).short }}</template>
            </div>
            <div v-if="child.aids?.length" class="muted small aids">
              {{ child.aids.map(id => getAid(id)?.icon).filter(Boolean).join(' ') }}
            </div>
          </div>
          <button class="btn secondary sm" @click="editingChild = child">✏️</button>
          <button class="btn danger sm" @click="removeChild(child)">🗑</button>
        </div>
        <div v-else class="edit-box">
          <ChildForm :child="child" @saved="onSaved" @cancel="editingChild = null" />
        </div>
      </div>

      <div v-if="editingChild === 'new'" class="edit-box">
        <h3>Новый ребёнок</h3>
        <ChildForm @saved="onSaved" />
        <button class="btn secondary block" style="margin-top: 8px" @click="editingChild = null">Отмена</button>
      </div>
      <button v-else class="btn secondary block" style="margin-top: 10px" @click="editingChild = 'new'">
        + Добавить ребёнка
      </button>
    </div>

    <div class="card">
      <div class="card-title">Тема</div>
      <div class="row">
        <button
          v-for="t in themes"
          :key="t.id"
          class="chip"
          :class="{ active: settings.theme === t.id }"
          @click="settings.setTheme(t.id)"
        >{{ t.label }}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Данные</div>
      <p class="muted small">
        Все данные хранятся только на этом устройстве, в браузере. Делайте резервные копии,
        чтобы не потерять историю и переносить её между устройствами.
      </p>
      <div class="row">
        <button class="btn secondary grow" @click="exportBackup">⬇️ Экспорт</button>
        <button class="btn secondary grow" @click="fileInput.click()">⬆️ Импорт</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden-input" @change="onImportFile" />
      <p v-if="message" class="small" style="margin-top: 8px">{{ message }}</p>
    </div>

    <div class="card">
      <div class="card-title">О приложении</div>
      <p class="muted small">
        «Режим малыша» — трекер сна и режима ребёнка с подсказками на основе возрастных норм.
        Подсказки носят информационный характер и не заменяют консультацию педиатра.
      </p>
      <p class="muted small">Работает офлайн · можно установить на домашний экран</p>
    </div>
  </div>
</template>

<style scoped>
.child-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--c-border);
}

.child-row:last-child { border-bottom: none; }

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.btn.sm {
  min-height: 40px;
  padding: 6px 10px;
}

.edit-box {
  padding: 10px 0;
  border-bottom: 1px solid var(--c-border);
}

.hidden-input { display: none; }
</style>
