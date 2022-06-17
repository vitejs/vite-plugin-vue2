<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  msg: string
}>()

const count = ref(0)

const vRed = {
  bind(el: HTMLElement) {
    el.style.color = 'red'
  }
}
</script>

<template>
  <div v-red class="script-setup">
    This should be red.
    <span class="prop">{{ msg }}</span>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>
