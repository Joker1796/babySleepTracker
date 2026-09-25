<script setup>
import { computed, ref } from 'vue'
import { QUICK_TOPICS } from '../data/quickTopics'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { ageInMonths } from '../logic/age'
import Icon from './Icon.vue'

const children = useChildrenStore()
const now = useNow()

// Темы по возрасту активного ребёнка; без профиля — все.
const topics = computed(() => {
  const child = children.activeChild
  if (!child?.birthDate) return QUICK_TOPICS
  const m = ageInMonths(child.birthDate, now.value)
  return QUICK_TOPICS.filter(t => m >= (t.ageMin ?? 0) && m <= (t.ageMax ?? Infinity))
})

const openId = ref(null)
const openTopic = computed(() => topics.value.find(t => t.id === openId.value) || null)

function toggle(id) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <div v-if="topics.length" class="quick">
    <div class="tags">
      <router-link to="/advice" class="tag tag-advice"><Icon name="bulb" :size="16" />Советы</router-link>
      <button
        v-for="t in topics"
        :key="t.id"
        class="tag"
        :class="{ active: openId === t.id }"
        :aria-expanded="openId === t.id"
        @click="toggle(t.id)"
      >{{ t.tag.replace(/^#/, '') }}</button>
    </div>
    <Transition name="fade">
      <div v-if="openTopic" class="topic-text card">
        {{ openTopic.text }}
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
  gap: 6px;
  padding: 7px 14px;
  min-height: 40px;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  color: var(--c-text);
  font-size: var(--fs-sm);
  font-weight: 500;
  text-decoration: none;
}

.tag.active {
  background: var(--c-primary);
  border-color: var(--c-primary);
  color: var(--c-on-primary);
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
  font-size: var(--fs-base);
  line-height: 1.5;
}
</style>
