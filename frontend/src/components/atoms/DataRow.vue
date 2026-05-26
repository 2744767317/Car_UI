<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>

<template>
  <p class="data-row"><span>{{ label }}</span><strong>{{ value }}</strong></p>
</template>
