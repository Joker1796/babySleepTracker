<script setup>
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useSettingsStore } from '../stores/settings'
import { formatChildAge } from '../logic/age'
import { getFeeding, getAid } from '../data/childOptions'
import { exportBackup, readBackupFile, importBackup } from '../utils/backup'
import { plural } from '../logic/age'
import ChildForm from '../components/ChildForm.vue'
import Icon from '../components/Icon.vue'

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
            <div class="child-name">{{ child.name }}</div>
            <div class="muted small">
              {{ formatChildAge(child) }} · <span class="num">{{ dayjs(child.birthDate).format('D.MM.YYYY') }}</span>
              <template v-if="getFeeding(child.feeding)"> · {{ getFeeding(child.feeding).short }}</template>
            </div>
            <div v-if="child.aids?.length" class="muted small aids">
              {{ child.aids.map(id => getAid(id)?.label).filter(Boolean).join(', ') }}
            </div>
          </div>
          <button class="icon-btn" @click="editingChild = child" :aria-label="`Изменить профиль: ${child.name}`">
            <Icon name="edit" :size="20" />
          </button>
          <button class="icon-btn danger" @click="removeChild(child)" :aria-label="`Удалить профиль: ${child.name}`">
            <Icon name="trash" :size="20" />
          </button>
        </div>
        <div v-else class="edit-box">
          <ChildForm :child="child" @saved="onSaved" @cancel="editingChild = null" />
        </div>
      </div>

      <div v-if="editingChild === 'new'" class="edit-box">
        <h3>Новый ребёнок</h3>
        <ChildForm @saved="onSaved" />
        <button class="btn secondary block cancel-new" @click="editingChild = null">Отмена</button>
      </div>
      <button v-else class="btn secondary block add-child" @click="editingChild = 'new'">
        <Icon name="plus" :size="18" /> Добавить ребёнка
      </button>
    </div>

    <div class="card">
      <div class="card-title">Тема</div>
      <div class="row theme-row">
        <button
          v-for="t in themes"
          :key="t.id"
          class="chip"
          :class="{ active: settings.theme === t.id }"
          @click="settings.setTheme(t.id)"
        >{{ t.label }}</button>
      </div>
      <label class="night-row">
        <input
          type="checkbox"
          class="night-check"
          :checked="settings.nightMode === 'auto'"
          @change="settings.setNightMode($event.target.checked ? 'auto' : 'off')"
        />
        <span class="grow">
          Ночной режим
          <span class="muted small night-hint">С 22:00 до 6:00 или после ночного засыпания экран сам становится тёмным и тёплым — не слепит при кормлении.</span>
        </span>
      </label>
    </div>

    <div class="card">
      <div class="card-title">Данные</div>
      <p class="muted small data-note">
        Все данные хранятся только на этом устройстве, в браузере. Делайте резервные копии,
        чтобы не потерять историю и переносить её между устройствами.
      </p>
      <div class="row">
        <button class="btn secondary grow" @click="exportBackup"><Icon name="download" :size="18" /> Экспорт</button>
        <button class="btn secondary grow" @click="fileInput.click()"><Icon name="upload" :size="18" /> Импорт</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden-input" @change="onImportFile" />
      <p v-if="message" class="small import-message" role="status">{{ message }}</p>
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
  padding: var(--sp-2) 0;
  border-top: 1px solid var(--c-border);
  min-height: 60px;
}

.child-row:first-child,
.edit-box:first-child { border-top: none; }

.child-name {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  font-weight: 500;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.aids { margin-top: 2px; }

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  color: var(--c-text-soft);
}

.icon-btn.danger { color: var(--c-urgent); }

.edit-box {
  padding: var(--sp-3) 0;
  border-top: 1px solid var(--c-border);
}

.cancel-new { margin-top: var(--sp-2); }

.add-child { margin-top: var(--sp-3); }

.theme-row { flex-wrap: wrap; gap: var(--sp-2); }

.theme-row .chip { min-height: 44px; }

.data-note { line-height: 1.45; margin-bottom: var(--sp-3); }

.import-message { margin: var(--sp-2) 0 0; }

.hidden-input { display: none; }

.reasons { margin-top: var(--sp-2); color: var(--c-text-soft); }
.reasons ul { margin: var(--sp-2) 0 0; padding-left: 18px; }

/* Шторка выбора импорта — в стиле EventEditSheet */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: var(--c-overlay);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 560px;
  background: var(--c-surface);
  border-radius: var(--radius) var(--radius) 0 0;
  border-top: 1px solid var(--c-border);
  padding: var(--sp-2) var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
  max-height: 88dvh;
  overflow-y: auto;
}

.sheet-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--c-border);
  margin: 6px auto var(--sp-3);
}

.import-actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.night-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  margin-top: var(--sp-4);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border);
  font-size: var(--fs-base);
  color: var(--c-text);
  cursor: pointer;
}

.night-check {
  width: 22px;
  min-height: 22px;
  height: 22px;
  margin: 2px 0 0;
  padding: 0;
  flex-shrink: 0;
  accent-color: var(--c-primary);
}

.night-hint {
  display: block;
  margin-top: 2px;
}
</style>
