<script>
import TestRecursive from './recursive/TestRecursive.vue'
import TestAsyncComponent from './async/TestAsyncComponent.vue'

export default {
    name: 'TestRecursion',
    components: {
        TestRecursive,
        TestAsyncComponent
    }
}
</script>

<template>
  <div>
    <h2>Vue Component</h2>

    <TestRecursive />
    <TestAsyncComponent />
  </div>
</template>
