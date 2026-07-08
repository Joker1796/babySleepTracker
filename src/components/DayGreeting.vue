<script setup>
defineProps({
  greeting: { type: Object, required: true }
})
defineEmits(['close'])
</script>

<template>
  <div class="card greeting">
    <button class="greet-close" aria-label="Закрыть" @click="$emit('close')">×</button>
    <div class="greet-head">
      <span class="greet-icon">☀️</span>
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
      <div class="block-title">Как далеко вы продвинулись 💪</div>
      <p>{{ greeting.progress }}</p>
    </div>
  </div>
</template>

<style scoped>
.greeting {
  position: relative;
  background: linear-gradient(135deg, var(--c-primary-soft), var(--c-surface));
}

.greet-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 32px;
  height: 32px;
  font-size: 22px;
  line-height: 1;
  color: var(--c-text-soft);
}

.greet-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.greet-icon { font-size: 26px; }

.greet-line { margin: 0; font-size: 15px; font-weight: 600; }

.block { margin-top: 12px; }

.block-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-text-soft);
  margin-bottom: 6px;
}

.block ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}

.block li { margin-bottom: 5px; }

.progress p { margin: 0; font-size: 14px; line-height: 1.5; }
</style>
