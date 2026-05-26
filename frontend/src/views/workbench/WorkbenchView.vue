<script setup lang="ts">
import { unref } from 'vue'
import ConfigPanel from '../../components/ConfigPanel.vue'
import GpsPanel from '../../components/GpsPanel.vue'
import RoutePanel from '../../components/RoutePanel.vue'
import { useLegacySnapshot } from '../../composables/useLegacySnapshot'

const legacy = useLegacySnapshot()
const legacySnapshot = () => unref(legacy.snapshot)
</script>

<template>
  <main class="workbench">
    <header class="hero">
      <h1>CAR Vue Workbench</h1>
      <p>主交互入口已切到 Vue 面板，Legacy iframe 仅保留为只读视觉参考层。</p>
      <RouterLink to="/legacy">查看 Legacy 视觉层</RouterLink>
    </header>

    <section class="cards">
      <ConfigPanel />
      <GpsPanel />
      <RoutePanel />
    </section>

    <section class="snapshot" v-if="legacySnapshot()">
      <h2>Legacy Snapshot</h2>
      <pre>{{ legacySnapshot() }}</pre>
    </section>
  </main>
</template>
