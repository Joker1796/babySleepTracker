<script setup>
import Icon from './Icon.vue'

defineProps({
  greeting: { type: Object, required: true }
})
defineEmits(['close'])
</script>

<template>
  <div class="card greeting">
    <button class="greet-close" aria-label="Закрыть" @click="$emit('close')"><Icon name="close" :size="16" /></button>
    <div class="greet-head">
      <Icon name="sunrise" class="greet-icon" />
      <p class="greet-line">{{ greeting.line }}</p>
    </div>

    <div v-if="greeting.achievements.length" class="block">
      <div class="block-title">Достижения вчера</div>
      <ul>
        <li v-for="(a, i) in greeting.achievements" :key="i">{{ a }}</li>
      </ul>
    </div>

    <div class="block">
      <div class="block-title">На что обратить внимание сегодня</div>
      <ul>
        <li v-for="(r, i) in greeting.attention" :key="i">{{ r }}</li>
      </ul>
    </div>

    <div v-if="greeting.progress" class="block progress">
      <div class="block-title">Как далеко вы продвинулись</div>
      <p>{{ greeting.progress }}</p>
    </div>
  </div>
</template>

<style scoped>
.greeting {
  position: relative;

}

.greet-close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-soft);
}

.greet-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.greet-icon { color: var(--c-accent); margin-top: 2px; }

.greet-line { margin: 0; font-family: var(--font-serif); font-size: var(--fs-md); line-height: 1.4; }

.block { margin-top: 12px; }

.block-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}

.block ul {
  margin: 0;
  padding-left: 18px;
  font-size: var(--fs-base);
}

.block li { margin-bottom: 5px; }

.progress p { margin: 0; font-size: var(--fs-base); line-height: 1.5; }
</style>
