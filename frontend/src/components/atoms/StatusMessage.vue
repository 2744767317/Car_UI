<script setup lang="ts">
defineProps<{
  text?: string
  tone?: 'default' | 'error' | 'success'
}>()
</script>

<template>
  <p v-if="text" class="status-msg" :class="`tone-${tone || 'default'}`">{{ text }}</p>
</template>
