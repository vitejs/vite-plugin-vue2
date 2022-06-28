<script setup>
import { ref } from 'vue'

const color = ref('red')
</script>

<template>
  <div>
    <h2>CSS v-bind</h2>
    <span class="css-v-bind" @click="color = color === 'red' ? 'green' : 'red'"
      >This should be {{ color }}</span
    >
  </div>
</template>

<style scoped>
span {
  color: v-bind(color);
}
</style>
