import { createRouter, createWebHistory } from 'vue-router'
import WorkbenchView from './views/workbench/WorkbenchView.vue'
import LegacyVisualizerView from './views/LegacyVisualizerView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'workbench', component: WorkbenchView },
    { path: '/legacy', name: 'legacy', component: LegacyVisualizerView },
  ],
})

export default router
