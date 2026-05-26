<script setup lang="ts">
defineProps<{
  label: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button :disabled="disabled" @click="emit('click')">{{ label }}</button>
</template>
