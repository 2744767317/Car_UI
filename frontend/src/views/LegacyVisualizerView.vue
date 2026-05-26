<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { runtimeAppConfig } from '../config/app-config'

declare global {
  interface Window {
    __CAR_RUNTIME_APP_CONFIG__?: unknown
  }
}

onMounted(() => {
  window.__CAR_RUNTIME_APP_CONFIG__ = runtimeAppConfig
})

onBeforeUnmount(() => {
  delete window.__CAR_RUNTIME_APP_CONFIG__
})
</script>

<template>
  <section class="legacy-page">
    <header class="top-bar">
      <RouterLink class="back-link" to="/">返回工程首页</RouterLink>
      <span class="tip">Legacy 已降级为只读视觉层。配置和业务操作请回到 Vue Workbench。</span>
    </header>
    <div class="readonly-banner">READ ONLY VISUAL LAYER</div>
    <iframe
      class="legacy-frame"
      src="/legacy/index.html"
      title="legacy visualizer"
      loading="lazy"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin"
    />
  </section>
</template>

<style scoped>
.legacy-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0d1117;
}

.top-bar {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  border-bottom: 1px solid #30363d;
  color: #9fb3c8;
  font-size: 0.9rem;
}

.back-link {
  color: #58a6ff;
  text-decoration: none;
  font-weight: 600;
}

.back-link:hover {
  text-decoration: underline;
}

.legacy-frame {
  border: 0;
  width: 100%;
  height: calc(100vh - 84px);
  pointer-events: none;
}

.readonly-banner {
  height: 32px;
  display: grid;
  place-items: center;
  background: rgba(255, 184, 0, 0.14);
  color: #ffd15c;
  border-bottom: 1px solid rgba(255, 209, 92, 0.25);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  font-weight: 700;
}
</style>
