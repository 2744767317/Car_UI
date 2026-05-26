<script setup lang="ts">
import ActionButton from './ActionButton.vue'

defineProps<{
  actions: Array<{ key: string; label: string; disabled?: boolean }>
}>()

const emit = defineEmits<{
  action: [key: string]
}>()
</script>

<template>
  <div class="actions">
    <ActionButton
      v-for="action in actions"
      :key="action.key"
      :label="action.label"
      :disabled="action.disabled"
      @click="emit('action', action.key)"
    />
  </div>
</template>
