<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="panel">
    <h2>{{ title }}</h2>
    <slot />
  </section>
</template>
