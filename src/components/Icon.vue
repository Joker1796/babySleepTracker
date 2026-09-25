<script setup>
// Линейные иконки приложения (24×24, штрих 1.6, цвет — currentColor).
// Единый набор вместо эмодзи: одинаково выглядят на iOS и Android и
// подстраиваются под тему. Декоративные по умолчанию — подпись даёт кнопка.
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 22 },
  label: { type: String, default: '' }
})

// Каждая иконка — список элементов SVG: [тег, атрибуты]
const ICONS = {
  moon: [['path', { d: 'M15 3.5A8.5 8.5 0 1 0 20.5 15 6.8 6.8 0 0 1 15 3.5Z' }]],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 3.5 }],
    ['path', { d: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4' }]
  ],
  star: [['path', { d: 'M12 3.5 13.9 10.1 20.5 12 13.9 13.9 12 20.5 10.1 13.9 3.5 12 10.1 10.1Z' }]],
  sunrise: [
    ['path', { d: 'M7 16a5 5 0 0 1 10 0M3 19h18M12 5v3M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4' }]
  ],
  bath: [['path', { d: 'M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2ZM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2' }]],
  tummy: [
    ['circle', { cx: 7, cy: 13, r: 3 }],
    ['path', { d: 'M10 14h8a3 3 0 0 0 3-3M11 17l-2 3M17 17l1 3' }]
  ],
  diaper: [['path', { d: 'M4 7h16l-1.5 6.5A6 6 0 0 1 12.7 18h-1.4a6 6 0 0 1-5.8-4.5L4 7ZM9 7v3M15 7v3' }]],
  stroller: [
    ['path', { d: 'M4 5h3l2 8h9l2-6H8.2' }],
    ['circle', { cx: 9, cy: 18, r: 1.8 }],
    ['circle', { cx: 17, cy: 18, r: 1.8 }]
  ],
  pill: [
    ['rect', { x: 3.5, y: 8.5, width: 17, height: 7, rx: 3.5, transform: 'rotate(-45 12 12)' }],
    ['path', { d: 'm9.5 9.5 5 5' }]
  ],
  drop: [['path', { d: 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z' }]],
  home: [['path', { d: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z' }]],
  calendar: [
    ['rect', { x: 4, y: 5, width: 16, height: 15, rx: 2 }],
    ['path', { d: 'M4 10h16M9 3v4M15 3v4' }]
  ],
  book: [['path', { d: 'M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5ZM12 6v13' }]],
  chart: [['path', { d: 'M5 20V11M10 20V6M15 20v-7M20 20V9' }]],
  sliders: [
    ['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }],
    ['circle', { cx: 15, cy: 7, r: 2 }],
    ['circle', { cx: 9, cy: 17, r: 2 }]
  ],
  more: [
    ['circle', { cx: 6, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 12, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 18, cy: 12, r: 1.4, fill: 'currentColor', stroke: 'none' }]
  ],
  menu: [['path', { d: 'M4 7h16M4 12h16M4 17h10' }]],
  close: [['path', { d: 'M6 6l12 12M18 6 6 18' }]],
  'chevron-left': [['path', { d: 'M15 6l-6 6 6 6' }]],
  'chevron-right': [['path', { d: 'M9 6l6 6-6 6' }]],
  'chevron-down': [['path', { d: 'M6 9l6 6 6-6' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  edit: [['path', { d: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4' }]],
  trash: [['path', { d: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13' }]],
  download: [['path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }]],
  upload: [['path', { d: 'M12 20V9M7 14l5-5 5 5M5 4h14' }]],
  alert: [
    ['path', { d: 'M12 4 21 19H3L12 4Z' }],
    ['path', { d: 'M12 10v4M12 16.8v.2' }]
  ],
  heart: [['path', { d: 'M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19Z' }]],
  bulb: [['path', { d: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z' }]],
  clock: [
    ['circle', { cx: 12, cy: 12, r: 8 }],
    ['path', { d: 'M12 8v4l3 2' }]
  ],
  hourglass: [['path', { d: 'M7 4h10M7 20h10M8 4c0 4 8 4 8 8s-8 4-8 8M16 4c0 4-8 4-8 8s8 4 8 8' }]],
  check: [['path', { d: 'M5 12.5 10 17l9-10' }]],
  repeat: [['path', { d: 'M4 12a7 7 0 0 1 12-5l2 2M20 12a7 7 0 0 1-12 5l-2-2M18 4v5h-5M6 20v-5h5' }]],
  play: [['path', { d: 'M8 5v14l11-7L8 5Z' }]],
  shield: [['path', { d: 'M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z' }]],
  bottle: [
    ['path', { d: 'M10 3h4M10.5 3v3L9 8.5V19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V8.5L13.5 6V3M9 12h6M9 15.5h6' }]
  ],
  suitcase: [
    ['rect', { x: 4, y: 7, width: 16, height: 12, rx: 2 }],
    ['path', { d: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 12h16' }]
  ],
  cross: [['path', { d: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z' }]],
  bed: [['path', { d: 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M6.5 11.5h.01' }]],
  baby: [
    ['circle', { cx: 12, cy: 10, r: 6 }],
    ['path', { d: 'M9.5 11.5h.01M14.5 11.5h.01M10.5 14a2 2 0 0 0 3 0M12 4c1 0 1.5.8 1.5 1.5' }]
  ]
}

const shapes = computed(() => ICONS[props.name] || ICONS.star)
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <component :is="tag" v-for="([tag, attrs], i) in shapes" :key="i" v-bind="attrs" />
  </svg>
</template>

<style scoped>
.icon {
  flex-shrink: 0;
  display: block;
}
</style>
