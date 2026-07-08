<script setup>
import { computed } from 'vue'

// Схема 20 молочных зубов: верхний и нижний ряд по 10. Тап отмечает
// прорезавшийся зуб; v-model — массив id выбранных зубов.
const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const ROWS = [
  { key: 'upper', label: 'Верхние', ids: ['ur5', 'ur4', 'ur3', 'ur2', 'ur1', 'ul1', 'ul2', 'ul3', 'ul4', 'ul5'] },
  { key: 'lower', label: 'Нижние', ids: ['lr5', 'lr4', 'lr3', 'lr2', 'lr1', 'll1', 'll2', 'll3', 'll4', 'll5'] }
]

const N = 10
const VW = 300
const TW = 24
const GAP = (VW - N * TW) / (N + 1)
function xOf(i) { return GAP + i * (TW + GAP) }

const selected = computed(() => new Set(props.modelValue))
function isOn(id) { return selected.value.has(id) }
function toggle(id) {
  const s = new Set(props.modelValue)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  emit('update:modelValue', [...s])
}
</script>

<template>
  <div class="tooth-chart">
    <svg viewBox="0 0 300 150" class="tc-svg">
      <template v-for="(row, r) in ROWS" :key="row.key">
        <text :x="150" :y="r === 0 ? 12 : 92" class="tc-cap" text-anchor="middle">{{ row.label }}</text>
        <g
          v-for="(id, i) in row.ids"
          :key="id"
          class="tc-tooth"
          :class="{ on: isOn(id) }"
          @click="toggle(id)"
        >
          <rect
            :x="xOf(i)"
            :y="r === 0 ? 20 : 100"
            :width="TW"
            :height="34"
            rx="8"
          />
        </g>
      </template>
    </svg>
    <p class="muted small tc-hint">Тапните по зубу, который прорезался.</p>
  </div>
</template>

<style scoped>
.tooth-chart { margin-top: 4px; }

.tc-svg {
  width: 100%;
  height: auto;
  display: block;
}

.tc-cap {
  font-size: 10px;
  font-weight: 700;
  fill: var(--c-text-soft);
}

.tc-tooth rect {
  fill: var(--c-surface-2);
  stroke: var(--c-border);
  stroke-width: 1.5;
  cursor: pointer;
  transition: fill 0.12s;
}

.tc-tooth.on rect {
  fill: var(--c-info);
  stroke: var(--c-info);
}

.tc-hint { margin: 6px 0 0; }
</style>
