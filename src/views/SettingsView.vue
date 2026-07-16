<script setup>
import { ref, computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettingsStore } from '../stores/settings'
import { exportBackup, importBackup } from '../utils/backup'
import ChildForm from '../components/ChildForm.vue'
import PlanButtonsEditor from '../components/PlanButtonsEditor.vue'

const children = useChildrenStore()
const events = useEventsStore()
const settings = useSettingsStore()

const tab = ref(children.activeChildId)  // child.id | 'new' | null (авто → активный ребёнок)
const formKey = ref(0)  // ремоунт формы: смена вкладки / сброс правок
const fileInput = ref(null)
const message = ref('')
const savedFlash = ref(false)
let savedTimer = null

const themes = [
  { id: 'auto', label: 'Как в системе' },
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Тёмная' }
]

const showNew = computed(() => tab.value === 'new' || children.children.length === 0)
const selectedChild = computed(() =>
  children.children.find(c => c.id === tab.value) || children.activeChild
)

function tabStyle(child) {
  const active = !showNew.value && selectedChild.value?.id === child.id
  return active ? { background: child.color, borderColor: child.color, color: '#fff' } : {}
}

async function removeChild(child) {
  if (!confirm(`Удалить профиль «${child.name}» и все его события? Это действие необратимо.`)) return
  await children.remove(child.id)
  if (children.activeChild) await events.load(children.activeChild.id)
}

async function onDelete(child) {
  await removeChild(child)
  tab.value = null
}

function onSaved() {
  if (tab.value === 'new') {
    tab.value = children.children[children.children.length - 1]?.id ?? null
  }
  savedFlash.value = true
  clearTimeout(savedTimer)
  savedTimer = setTimeout(() => { savedFlash.value = false }, 1600)
}

function onCancel() {
  formKey.value++ // ремоунт → сброс несохранённых правок
}

// Режим расчёта активного профиля: 'auto' (движок по возрасту) / 'custom' (свои параметры)
const regimeMode = computed(() => selectedChild.value?.regime?.mode || 'auto')
function toggleRegime() {
  const id = selectedChild.value?.id
  if (id) children.setRegimeMode(id, regimeMode.value === 'custom' ? 'auto' : 'custom')
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
      <div class="tabs">
        <button
          v-for="child in children.children"
          :key="child.id"
          class="tab"
          :class="{ active: !showNew && selectedChild?.id === child.id }"
          :style="tabStyle(child)"
          @click="tab = child.id"
        >{{ child.name }}</button>
        <button class="tab tab-add" :class="{ active: showNew }" @click="tab = 'new'">＋</button>
      </div>

      <div class="panel">
        <template v-if="showNew">
          <h3 class="panel-title">Новый ребёнок</h3>
          <ChildForm :key="'new-' + formKey" @saved="onSaved" />
          <button v-if="children.children.length" class="btn secondary block" style="margin-top: 8px" @click="tab = null">Отмена</button>
        </template>
        <template v-else-if="selectedChild">
          <div class="panel-head">
            <span class="dot" :style="{ background: selectedChild.color }"></span>
            <b>Профиль: {{ selectedChild.name }}</b>
            <Transition name="fade">
              <span v-if="savedFlash" class="saved-flash">✓ Сохранено</span>
            </Transition>
          </div>
          <ChildForm
            :key="selectedChild.id + '-' + formKey"
            :child="selectedChild"
            @saved="onSaved"
            @cancel="onCancel"
            @delete="onDelete(selectedChild)"
          />
        </template>
      </div>
    </div>

    <div v-if="selectedChild && !showNew" class="card">
      <div class="card-title">Режим расчёта</div>
      <button class="btn block regime-btn" :class="{ custom: regimeMode === 'custom' }" @click="toggleRegime">
        {{ regimeMode === 'custom' ? '🎛️ Свой режим' : '✨ Авто' }}
      </button>
      <p class="muted small" style="margin-top: 8px">
        {{ regimeMode === 'custom'
          ? 'Подсказки считаются по вашим параметрам (окна бодрствования, число снов). Настроить — во вкладке «Мой режим».'
          : 'Подсказки считаются автоматически по возрасту ребёнка. Нажмите, чтобы задать свои параметры.' }}
      </p>
    </div>

    <div class="card">
      <div class="card-title">Кнопки планов</div>
      <PlanButtonsEditor />
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
.tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--c-border);
}

.tab {
  flex-shrink: 0;
  padding: 8px 14px;
  min-height: 40px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background: var(--c-surface-2);
  color: var(--c-text-soft);
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.tab-add.active {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: #fff;
}

.panel { padding-top: 12px; }

.panel-title { margin: 0 0 8px; }

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.saved-flash {
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--c-walk-soft);
  color: var(--c-walk);
  font-size: 12px;
  font-weight: 700;
}

.panel-head .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hidden-input { display: none; }

.regime-btn {
  min-height: 52px;
  font-size: 16px;
}

.regime-btn.custom {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border: 1px solid var(--c-primary);
}
</style>
