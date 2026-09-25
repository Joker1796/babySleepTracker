<script setup>
import { computed, ref } from 'vue'
import { QUICK_TOPICS } from '../data/quickTopics'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { ageInMonths } from '../logic/age'

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
      <button
        v-for="t in topics"
        :key="t.id"
        class="tag"
        :class="{ active: openId === t.id }"
        :aria-expanded="openId === t.id"
        @click="toggle(t.id)"
      >{{ t.tag }}</button>
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
  padding: 7px 14px;
  min-height: 36px;
  border-radius: 999px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 600;
}

.tag.active {
  background: var(--c-primary-soft);
  border-color: var(--c-primary);
}

.topic-text {
  margin-top: 8px;
  margin-bottom: 0;
  font-size: 14px;
  line-height: 1.5;
}
</style>
