<script setup>
import { ref } from 'vue'
import ChildForm from '../components/ChildForm.vue'
import { useChildrenStore } from '../stores/children'
import { importBackup } from '../utils/backup'

const children = useChildrenStore()
const fileInput = ref(null)
const message = ref('')

async function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const res = await importBackup(file, { replace: false })
    await children.load()
    if (children.children[0]) children.setActive(children.children[0].id)
    // После загрузки данных App сам переключится на главный экран
    message.value = `Импортировано: детей — ${res.children}, событий — ${res.events}`
  } catch (err) {
    message.value = `Ошибка импорта: ${err.message}`
  }
}
</script>

<template>
  <div class="page onboarding">
    <div class="hero">
      <div class="hero-icon">🌙</div>
      <h1>Режим малыша</h1>
      <p class="muted">
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
      <button class="btn secondary block" @click="fileInput.click()">⬆️ Импортировать данные</button>
      <input ref="fileInput" type="file" accept="application/json,.json" class="hidden-input" @change="onImportFile" />
      <p v-if="message" class="small import-msg">{{ message }}</p>
      <p class="muted small import-hint">Есть резервная копия (.json)? Восстановите данные без ручного ввода.</p>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  padding-top: 40px;
  padding-bottom: 24px;
}

.hero {
  text-align: center;
  margin-bottom: 24px;
}

.hero-icon {
  font-size: 56px;
  margin-bottom: 8px;
}

.hero p {
  max-width: 320px;
  margin: 0 auto;
}

.import-block {
  margin-top: 16px;
}

.or {
  display: flex;
  align-items: center;
  text-align: center;
  color: var(--c-text-soft);
  font-size: 13px;
  margin: 4px 0 12px;
}

.or::before, .or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--c-border);
}

.or span { padding: 0 12px; }

.hidden-input { display: none; }

.import-hint {
  text-align: center;
  margin: 8px 0 0;
}

.import-msg {
  text-align: center;
  margin: 8px 0 0;
  color: var(--c-urgent);
}
</style>
