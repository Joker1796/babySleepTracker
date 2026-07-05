<script setup>
import { computed, ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { ageInMonths } from '../logic/age'
import { TIPS, TIP_CATEGORIES, tipsForAge } from '../data/tips'

const route = useRoute()
const children = useChildrenStore()
const now = useNow()

const showAllAges = ref(false)
const expandedId = ref(null)

const ageMonths = computed(() =>
  children.activeChild ? ageInMonths(children.activeChild.birthDate, now.value) : null
)

const visibleTips = computed(() => {
  if (showAllAges.value || ageMonths.value == null) return TIPS
  return tipsForAge(ageMonths.value)
})

const categories = computed(() =>
  TIP_CATEGORIES
    .map(cat => ({ ...cat, tips: visibleTips.value.filter(t => t.category === cat.id) }))
    .filter(cat => cat.tips.length > 0)
)

// абзацы и списки из plain-текста статьи
function renderBody(body) {
  return body.split('\n\n').map(block => {
    const lines = block.split('\n')
    const isList = lines.every(l => l.startsWith('— ')) && lines.length > 0 && block.startsWith('— ')
    return { isList, lines: isList ? lines.map(l => l.slice(2)) : lines }
  })
}

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

onMounted(async () => {
  const tipId = route.query.tip
  if (tipId && TIPS.some(t => t.id === tipId)) {
    showAllAges.value = true
    expandedId.value = tipId
    await nextTick()
    document.getElementById(`tip-${tipId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})
</script>

<template>
  <div class="page">
    <h1 class="page-title">Советы</h1>

    <div class="row kb-head">
      <div class="card-title grow" style="margin: 0">База знаний</div>
      <button class="chip" :class="{ active: showAllAges }" @click="showAllAges = !showAllAges">
        {{ showAllAges ? 'Все возрасты' : 'По возрасту' }}
      </button>
    </div>

    <div v-for="cat in categories" :key="cat.id" class="category">
      <h3 class="cat-title">{{ cat.icon }} {{ cat.label }}</h3>
      <div class="card tip-card" v-for="tip in cat.tips" :key="tip.id" :id="`tip-${tip.id}`">
        <button class="tip-head" @click="toggle(tip.id)">
          <span class="grow">{{ tip.title }}</span>
          <span class="muted">{{ expandedId === tip.id ? '−' : '+' }}</span>
        </button>
        <div v-if="expandedId === tip.id" class="tip-body">
          <template v-for="(block, i) in renderBody(tip.body)" :key="i">
            <ul v-if="block.isList">
              <li v-for="(line, j) in block.lines" :key="j">{{ line }}</li>
            </ul>
            <p v-else>{{ block.lines.join('\n') }}</p>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.norms .norm-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 4px 0;
}

.kb-head { margin: 16px 0 8px; }

.cat-title {
  margin: 14px 2px 8px;
  font-size: 14px;
  color: var(--c-text-soft);
}

.tip-card {
  padding: 0;
  margin-bottom: 8px;
  overflow: hidden;
}

.tip-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 14px 16px;
  font-weight: 600;
  font-size: 14.5px;
  min-height: 48px;
}

.tip-body {
  padding: 0 16px 14px;
  font-size: 14px;
}

.tip-body p { white-space: pre-line; }

.tip-body ul {
  margin: 0 0 8px;
  padding-left: 18px;
}

.tip-body li { margin-bottom: 4px; }
</style>
