<script setup>
import { ref } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettingsStore } from '../stores/settings'
import { formatChildAge } from '../logic/age'
import { getFeeding, getAid } from '../data/childOptions'
import { exportBackup, readBackupFile, importBackup } from '../utils/backup'
import { plural } from '../logic/age'
import ChildForm from '../components/ChildForm.vue'

const children = useChildrenStore()
const events = useEventsStore()
const settings = useSettingsStore()

const editingChild = ref(null) // null | 'new' | объект ребёнка
const fileInput = ref(null)
const message = ref('')
const reasons = ref([]) // причины пропуска записей при импорте
const pendingImport = ref(null) // { data, fileName } — ждёт выбора «Заменить/Добавить»
const importing = ref(false)

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
  message.value = ''
  reasons.value = []
  try {
    pendingImport.value = { data: await readBackupFile(file), fileName: file.name }
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  }
}

async function applyImport(replace) {
  const pending = pendingImport.value
  if (!pending || importing.value) return
  importing.value = true
  try {
    const res = await importBackup(pending.data, { replace })
    await children.load()
    if (children.activeChild) await events.load(children.activeChild.id)
    const skippedTotal = res.skipped.children + res.skipped.events
    message.value = `Импортировано: детей — ${res.imported.children}, событий — ${res.imported.events}` +
      (skippedTotal ? `. Пропущено некорректных записей: ${skippedTotal}` : '')
    reasons.value = res.reasons
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  } finally {
    importing.value = false
    pendingImport.value = null
  }
}

function cancelImport() {
  if (!importing.value) pendingImport.value = null
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
              {{ formatChildAge(child) }} · {{ child.birthDate }}
              <template v-if="getFeeding(child.feeding)"> · {{ getFeeding(child.feeding).icon }} {{ getFeeding(child.feeding).short }}</template>
            </div>
            <div v-if="child.aids?.length" class="muted small aids">
              {{ child.aids.map(id => getAid(id)?.icon).filter(Boolean).join(' ') }}
            </div>
          </div>
          <button class="btn secondary sm" @click="editingChild = child" :aria-label="`Изменить профиль: ${child.name}`">✏️</button>
          <button class="btn danger sm" @click="removeChild(child)" :aria-label="`Удалить профиль: ${child.name}`">🗑</button>
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
      <details v-if="reasons.length" class="small reasons">
        <summary>Подробнее</summary>
        <ul>
          <li v-for="(r, i) in reasons.slice(0, 20)" :key="i">{{ r }}</li>
          <li v-if="reasons.length > 20">…и ещё {{ reasons.length - 20 }}</li>
        </ul>
      </details>
    </div>

    <div class="card">
      <div class="card-title">О приложении</div>
      <p class="muted small">
        «Режим малыша» — трекер сна и режима ребёнка с подсказками на основе возрастных норм.
        Подсказки носят информационный характер и не заменяют консультацию педиатра.
      </p>
      <p class="muted small">Работает офлайн · можно установить на домашний экран</p>
    </div>

    <!-- Выбор способа импорта -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="pendingImport" class="sheet-backdrop" @click.self="cancelImport">
          <div class="sheet">
            <div class="sheet-handle"></div>
            <h2>Импорт данных</h2>
            <p class="muted small">
              В файле «{{ pendingImport.fileName }}»:
              {{ pendingImport.data.children.length }} {{ plural(pendingImport.data.children.length, 'профиль', 'профиля', 'профилей') }},
              {{ pendingImport.data.events.length }} {{ plural(pendingImport.data.events.length, 'событие', 'события', 'событий') }}.
            </p>
            <p class="small">
              <b>Заменить</b> — удалить текущие данные и загрузить из файла.<br />
              <b>Добавить</b> — дописать к текущим (записи с теми же id обновятся).
            </p>
            <div class="import-actions">
              <button class="btn danger block" :disabled="importing" @click="applyImport(true)">Заменить всё</button>
              <button class="btn block" :disabled="importing" @click="applyImport(false)">Добавить к текущим</button>
              <button class="btn secondary block" :disabled="importing" @click="cancelImport">Отмена</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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

.reasons { margin-top: 6px; color: var(--c-text-soft); }
.reasons ul { margin: 6px 0 0; padding-left: 18px; }

/* Шторка выбора импорта — в стиле EventEditSheet */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 24, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 560px;
  background: var(--c-surface);
  border-radius: 20px 20px 0 0;
  padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px));
  max-height: 88dvh;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--c-border);
  margin: 6px auto 14px;
}

.import-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}
</style>
