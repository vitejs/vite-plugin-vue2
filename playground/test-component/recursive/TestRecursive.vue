<script>
import TestRecursiveTree from './TestRecursiveTree.vue'
import treedata from './treedata.json'

export default {
    name: 'TestRecursion',
    components: {
        TestRecursiveTree
    },
    data() {
      return {
        treedata: treedata
      }
    }
}
</script>

<template>
  <div>
    <h3>Recursive Component</h3>
    <TestRecursiveTree :treedata="treedata"></TestRecursiveTree>
  </div>
</template>
