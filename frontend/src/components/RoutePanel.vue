<script setup lang="ts">
import { computed, unref } from 'vue'
import { useRouteSubmission } from '../composables/useRouteSubmission'
import ActionButton from './atoms/ActionButton.vue'
import DataRow from './atoms/DataRow.vue'
import PanelCard from './atoms/PanelCard.vue'
import StatusMessage from './atoms/StatusMessage.vue'

const route = useRouteSubmission()

const routeState = computed(() => unref(route.routeState))
const startText = computed(() => {
  const point = routeState.value.start
  return point ? `${point.x}, ${point.y}` : '未设置'
})
const endText = computed(() => {
  const point = routeState.value.end
  return point ? `${point.x}, ${point.y}` : '未设置'
})
const pathCountText = computed(() => routeState.value.pathPoints.length)
const distanceText = computed(() => routeState.value.pathDistance.toFixed(2))
</script>

<template>
  <PanelCard title="路径提交">
    <DataRow label="Provider" :value="route.providerKind.value" />
    <DataRow label="起点" :value="startText" />
    <DataRow label="终点" :value="endText" />
    <DataRow label="路径点" :value="pathCountText" />
    <DataRow label="距离" :value="distanceText" />
    <ActionButton
      label="提交路径"
      :disabled="route.busy.value || !routeState.canSubmit"
      @click="route.submitRoute"
    />
    <StatusMessage :text="route.lastResult.value" tone="success" />
    <StatusMessage :text="route.error.value" tone="error" />
  </PanelCard>
</template>
