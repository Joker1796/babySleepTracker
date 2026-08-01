<script setup>
import { ref } from 'vue'
import { QUICK_TOPICS } from '../data/quickTopics'

const openId = ref(null)
function toggle(id) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <div class="quick">
    <div class="tags">
      <router-link to="/advice" class="tag tag-advice">💡 Советы</router-link>
      <button
        v-for="t in QUICK_TOPICS"
        :key="t.id"
        class="tag"
        :class="{ active: openId === t.id }"
        @click="toggle(t.id)"
      >{{ t.tag }}</button>
    </div>
    <Transition name="fade">
      <div v-if="openId" class="topic-text card">
        {{ QUICK_TOPICS.find(t => t.id === openId).text }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.quick { margin-bottom: 12px; }

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  min-height: 32px;
  border-radius: 999px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-primary);
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
}

.tag.active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

/* Выделенный чип «Советы» — ведёт на страницу базы знаний */
.tag-advice {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: var(--c-on-primary);
}

.topic-text {
  margin-top: 8px;
  margin-bottom: 0;
  font-size: 14px;
  line-height: 1.5;
}
</style>
