<script setup lang="ts">
import { runtimeAppConfig } from '../config/app-config'
</script>

<template>
  <main class="home">
    <h1>CAR Frontend Engineering Workspace</h1>
    <p>第一步已完成：Vue3 + Vite 工程骨架已建立，并已接入现有可视化页面。</p>
    <RouterLink class="enter-link" to="/legacy">进入现有可视化页面 (Legacy)</RouterLink>
    <pre class="config-preview">{{ runtimeAppConfig }}</pre>
  </main>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
  background: #0d1117;
  color: #e6edf3;
}

h1 {
  margin: 0;
  font-size: 1.8rem;
}

p {
  margin: 0;
  color: #9fb3c8;
}

.enter-link {
  justify-self: center;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #238636;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
}

.enter-link:hover {
  background: #2ea043;
}

.config-preview {
  margin: 0;
  padding: 0.75rem;
  max-width: 900px;
  overflow: auto;
  border: 1px solid #2f3843;
  border-radius: 0.5rem;
  background: #121821;
  color: #9fb3c8;
  text-align: left;
  font-size: 0.8rem;
}
</style>
