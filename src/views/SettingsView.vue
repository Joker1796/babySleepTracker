<script setup>
import { ref, computed } from 'vue'
import { useChildrenStore } from '../stores/children'
import { useEventsStore } from '../stores/events'
import { useIllnessStore } from '../stores/illness'
import { useSettingsStore } from '../stores/settings'
import { exportBackup, readBackupFile, importBackup } from '../utils/backup'
import { plural } from '../logic/age'
import ChildForm from '../components/ChildForm.vue'
import PlanButtonsEditor from '../components/PlanButtonsEditor.vue'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const events = useEventsStore()
const illness = useIllnessStore()
const settings = useSettingsStore()

const tab = ref(children.activeChildId)  // child.id | 'new' | null (авто → активный ребёнок)
const formKey = ref(0)  // ремоунт формы: смена вкладки / сброс правок
const fileInput = ref(null)
const message = ref('')
const reasons = ref([]) // причины пропуска записей при импорте
const pendingImport = ref(null) // { data, fileName } — ждёт выбора «Заменить/Добавить»
const importing = ref(false)
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
    if (children.activeChild) {
      await events.load(children.activeChild.id)
      await illness.load(children.activeChild.id)
    }
    const skippedTotal = res.skipped.children + res.skipped.events + (res.skipped.illnesses || 0)
    message.value = `Импортировано: детей — ${res.imported.children}, событий — ${res.imported.events}` +
      (res.imported.illnesses ? `, болезней — ${res.imported.illnesses}` : '') +
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
      <div class="tabs" role="tablist" aria-label="Профили детей">
        <button
          v-for="child in children.children"
          :key="child.id"
          class="chip tab"
          :class="{ active: !showNew && selectedChild?.id === child.id }"
          role="tab"
          :aria-selected="!showNew && selectedChild?.id === child.id"
          @click="tab = child.id"
        ><span class="dot" :style="{ background: child.color }"></span>{{ child.name }}</button>
        <button
          class="chip tab tab-add"
          :class="{ active: showNew }"
          role="tab"
          :aria-selected="showNew"
          aria-label="Добавить ребёнка"
          @click="tab = 'new'"
        ><Icon name="plus" :size="18" /></button>
      </div>

      <div class="panel">
        <template v-if="showNew">
          <h3 class="panel-title">Новый ребёнок</h3>
          <ChildForm :key="'new-' + formKey" @saved="onSaved" />
          <button v-if="children.children.length" class="btn secondary block cancel-new" @click="tab = null">Отмена</button>
        </template>
        <template v-else-if="selectedChild">
          <div class="panel-head">
            <span class="dot" :style="{ background: selectedChild.color }"></span>
            <span class="panel-name">{{ selectedChild.name }}</span>
            <Transition name="fade">
              <span v-if="savedFlash" class="saved-flash" role="status"><Icon name="check" :size="14" /> Сохранено</span>
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
        <Icon :name="regimeMode === 'custom' ? 'sliders' : 'star'" :size="18" />
        {{ regimeMode === 'custom' ? 'Свой режим' : 'Авто' }}
      </button>
      <p class="muted small regime-note">
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
              {{ pendingImport.data.events.length }} {{ plural(pendingImport.data.events.length, 'событие', 'события', 'событий') }}<template v-if="pendingImport.data.illnesses?.length">,
              {{ pendingImport.data.illnesses.length }} {{ plural(pendingImport.data.illnesses.length, 'болезнь', 'болезни', 'болезней') }}</template>.
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
/* Вкладки детей — контурные чипы, активная залита чернилами */
.tabs {
  display: flex;
  gap: var(--sp-2);
  overflow-x: auto;
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--c-border);
}

.tab {
  flex-shrink: 0;
  min-height: 44px;
  font-size: var(--fs-sm);
  color: var(--c-text);
}

.tab.active { color: var(--c-on-primary); }

.tab .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-add { min-width: 44px; justify-content: center; padding: 6px 12px; }

.panel { padding-top: var(--sp-3); }

.panel-title { margin: 0 0 var(--sp-2); }

.panel-head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}

.panel-name {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  font-weight: 500;
}

.saved-flash {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--c-walk);
  color: var(--c-walk);
  font-size: var(--fs-xs);
  font-weight: 500;
}

.panel-head .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cancel-new { margin-top: var(--sp-2); }

.regime-btn { min-height: 52px; }

.regime-btn.custom {
  background: transparent;
  color: var(--c-text);
  border: 1px solid var(--c-primary);
}

.regime-note { margin: var(--sp-2) 0 0; }

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
