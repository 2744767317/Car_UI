<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGpsControl } from '../composables/useGpsControl'
import ActionList from './atoms/ActionList.vue'
import DataRow from './atoms/DataRow.vue'
import PanelCard from './atoms/PanelCard.vue'
import StatusMessage from './atoms/StatusMessage.vue'

const gps = useGpsControl()

const currentPointText = computed(() => {
  const point = unref(gps.currentPoint)
  return point ? `${point.x}, ${point.y}` : '未读取'
})

const calibrationText = computed(() => (unref(gps.calibration) ? '已完成' : '未完成'))

const actions = computed(() => [
  { key: 'syncStartPoint', label: '同步起点', disabled: unref(gps.busy) },
  { key: 'calibrateAtCurrentPoint', label: '校准GPS', disabled: unref(gps.busy) },
  { key: 'toggleTracking', label: '切换跟踪', disabled: unref(gps.busy) },
])

const onAction = (key: string) => {
  if (key === 'syncStartPoint') {
    void gps.syncStartPoint()
    return
  }
  if (key === 'calibrateAtCurrentPoint') {
    void gps.calibrateAtCurrentPoint()
    return
  }
  if (key === 'toggleTracking') {
    void gps.toggleTracking()
  }
}
</script>

<template>
  <PanelCard title="GPS">
    <DataRow label="Provider" :value="gps.providerKind.value" />
    <DataRow label="来源" :value="gps.gpsSource.value" />
    <DataRow label="当前点" :value="currentPointText" />
    <DataRow label="校准" :value="calibrationText" />
    <DataRow label="跟踪" :value="gps.trackingEnabled.value ? '开启' : '关闭'" />
    <ActionList :actions="actions" @action="onAction" />
    <StatusMessage :text="gps.lastAction.value" tone="success" />
    <StatusMessage :text="gps.error.value" tone="error" />
  </PanelCard>
</template>
