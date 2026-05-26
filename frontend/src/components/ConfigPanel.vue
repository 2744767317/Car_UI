<script setup lang="ts">
import { computed } from 'vue'
import { useRuntimeConfig } from '../composables/useRuntimeConfig'
import DataRow from './atoms/DataRow.vue'
import PanelCard from './atoms/PanelCard.vue'

const { backend, scene, bridge } = useRuntimeConfig()

const rows = computed(() => [
  { label: 'API Base', value: backend.value.apiBaseUrl || '未设置' },
  { label: 'GPS Endpoint', value: backend.value.gpsEndpoint },
  { label: 'Route Endpoint', value: backend.value.routeEndpoint },
  { label: 'GPS Source', value: backend.value.gpsSource },
  { label: 'PCD', value: scene.value.pcdFile },
  { label: 'OSM', value: scene.value.osmFile },
  { label: 'Bridge Mode', value: bridge.value.mode },
  { label: 'ROS2 Endpoint', value: bridge.value.endpoint },
  { label: 'ROS2 Route Topic', value: bridge.value.routeTopic },
  { label: 'ROS2 GPS Topic', value: bridge.value.gpsTopic },
])
</script>

<template>
  <PanelCard title="配置中心">
    <div class="grid">
      <DataRow
        v-for="row in rows"
        :key="row.label"
        :label="row.label"
        :value="row.value"
      />
    </div>
  </PanelCard>
</template>
