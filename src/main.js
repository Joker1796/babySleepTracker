import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import App from './App.vue'
import router from './router'
import './style.css'

dayjs.locale('ru')

createApp(App).use(createPinia()).use(router).mount('#app')
