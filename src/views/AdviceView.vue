<script setup>
import { computed, ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useChildrenStore } from '../stores/children'
import { useNow } from '../composables/useNow'
import { normsAgeM } from '../logic/norms'
import { TIPS, TIP_CATEGORIES, TIP_SOURCES, TIPS_DISCLAIMER, tipsForAge } from '../data/tips'
import Icon from '../components/Icon.vue'

const route = useRoute()
const children = useChildrenStore()
const now = useNow()

const showAllAges = ref(false)
const expandedId = ref(null)
const showSources = ref(false)

// Для недоношенных — корректированный возраст
const ageMonths = computed(() =>
  children.activeChild ? normsAgeM(children.activeChild, now.value) : null
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

    <p class="disclaimer muted">{{ TIPS_DISCLAIMER }}</p>

    <div class="row kb-head">
      <h2 class="grow kb-title">База знаний</h2>
      <button class="chip" :class="{ active: showAllAges }" @click="showAllAges = !showAllAges">
        {{ showAllAges ? 'Все возрасты' : 'По возрасту' }}
      </button>
    </div>

    <section v-for="cat in categories" :key="cat.id" class="category">
      <h3 class="cat-title">
        <Icon :name="cat.iconName || 'book'" :size="18" class="cat-ico" />
        {{ cat.label }}
      </h3>
      <div class="tip" v-for="tip in cat.tips" :key="tip.id" :id="`tip-${tip.id}`">
        <button class="tip-head" :aria-expanded="expandedId === tip.id" @click="toggle(tip.id)">
          <span class="grow">{{ tip.title }}</span>
          <Icon name="chevron-down" :size="18" class="tip-chevron" :class="{ open: expandedId === tip.id }" />
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
    </section>

    <section class="category sources">
      <div class="tip">
        <button class="tip-head" :aria-expanded="showSources" @click="showSources = !showSources">
          <Icon name="book" :size="18" class="cat-ico" />
          <span class="grow">Источники</span>
          <Icon name="chevron-down" :size="18" class="tip-chevron" :class="{ open: showSources }" />
        </button>
        <div v-if="showSources" class="tip-body">
          <p>Статьи сверены с рекомендациями педиатрических и сомнологических организаций. Окна бодрствования и распорядок дня — практические ориентиры, а не строгие медицинские нормы.</p>
          <ul>
            <li v-for="src in TIP_SOURCES" :key="src.title">
              <strong>{{ src.title }}.</strong> {{ src.ref }}
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.disclaimer {
  margin: 0 var(--sp-1) var(--sp-1);
  font-size: var(--fs-sm);
  line-height: 1.45;
}

.kb-head { margin: var(--sp-4) 0 var(--sp-1); }

.kb-title { margin: 0; }

.category { margin-top: var(--sp-4); }

.cat-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-md);
}

.cat-ico { color: var(--c-accent); }

.tip { border-top: 1px solid var(--c-border); }

.category .tip:last-child { border-bottom: 1px solid var(--c-border); }

.tip-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  width: 100%;
  text-align: left;
  padding: var(--sp-3) 0;
  font-weight: 500;
  font-size: var(--fs-base);
  min-height: 48px;
}

.tip-chevron {
  color: var(--c-text-soft);
  transition: transform 0.2s;
}

.tip-chevron.open { transform: rotate(180deg); }

.tip-body {
  padding: 0 0 var(--sp-4);
  font-size: var(--fs-base);
  line-height: 1.55;
}

.tip-body p { white-space: pre-line; }

.tip-body ul {
  margin: 0 0 var(--sp-2);
  padding-left: 18px;
}

.tip-body li { margin-bottom: var(--sp-1); }

.sources { margin-top: var(--sp-5); }

.sources .tip-body { font-size: var(--fs-sm); color: var(--c-text-soft); }
</style>
