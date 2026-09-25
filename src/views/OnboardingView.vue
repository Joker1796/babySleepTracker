<script setup>
import { ref } from 'vue'
import ChildForm from '../components/ChildForm.vue'
import { useChildrenStore } from '../stores/children'
import { readBackupFile, importBackup } from '../utils/backup'
import Icon from '../components/Icon.vue'

const children = useChildrenStore()
const fileInput = ref(null)
const message = ref('')
const isError = ref(false)

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  isError.value = false
  try {
    const res = await importBackup(await readBackupFile(file), { replace: false })
    await children.load()
    if (children.children[0]) children.setActive(children.children[0].id)
    // После загрузки данных App сам переключится на главный экран
    message.value = `Импортировано: детей — ${res.imported.children}, событий — ${res.imported.events}`
  } catch (err) {
    isError.value = true
    message.value = `Ошибка импорта: ${err.message}`
  }
}
</script>

<template>
  <div class="page onboarding">
    <div class="hero">
      <Icon name="moon" :size="56" class="hero-icon" />
      <h1 class="hero-title">Режим малыша</h1>
      <p class="muted hero-text">
        Отмечайте сон, прогулки и купание — приложение подскажет, когда укладывать
        в следующий раз, и поможет наладить режим. Все данные хранятся только на вашем устройстве.
      </p>
    </div>
    <div class="card">
      <h2>Расскажите о малыше</h2>
      <ChildForm />
    </div>

    <div class="import-block">
      <div class="or"><span>или</span></div>
      <button class="btn secondary block" @click="fileInput.click()">
        <Icon name="upload" :size="18" /> Импортировать данные
      </button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden-input" @change="onImportFile" />
      <p v-if="message" class="small import-msg" :class="{ error: isError }" role="status">{{ message }}</p>
      <p class="muted small import-hint">Есть резервная копия (.json)? Восстановите данные без ручного ввода.</p>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  padding-top: var(--sp-6);
  padding-bottom: var(--sp-5);
}

.hero {
  text-align: center;
  margin-bottom: var(--sp-5);
}

.hero-icon {
  margin: 0 auto var(--sp-3);
  color: var(--c-accent);
}

.hero-title {
  font-size: var(--fs-xl);
  margin-bottom: var(--sp-2);
}

.hero-text {
  max-width: 330px;
  margin: 0 auto;
  line-height: 1.55;
}

.import-block { margin-top: var(--sp-4); }

.or {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--c-text-soft);
  font-size: var(--fs-sm);
  margin: var(--sp-1) 0 var(--sp-3);
}

.or::before, .or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--c-border);
}

.or span { padding: 0 var(--sp-3); }

.hidden-input { display: none; }

.import-hint {
  text-align: center;
  margin: var(--sp-2) 0 0;
}

.import-msg {
  text-align: center;
  margin: var(--sp-2) 0 0;
}

.import-msg.error { color: var(--c-urgent); }
</style>
