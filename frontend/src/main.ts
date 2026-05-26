import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { runtimeAppConfig } from './config/app-config'
import { carApi } from './services/car-api'

window.__CAR_RUNTIME_APP_CONFIG__ = runtimeAppConfig
window.__CAR_SERVICES__ = { carApi }
window.CARServices = { carApi }

createApp(App).use(router).mount('#app')
