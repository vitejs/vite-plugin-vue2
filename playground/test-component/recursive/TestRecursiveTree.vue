<script>
export default {
  name: 'TestRecursiveTree',
  props: ['treedata'],
  methods: {
    isEmpty(data) {
      return !data || !data.length
    }
  }
}
</script>

<template>
  <div class="test-recursive-tree">
    <div class="test-recursive-item" v-for="item in treedata" :key="item.label">
      <h5>{{ item.label }}</h5>

      <TestRecursiveTree
        v-if="!isEmpty(item.children)"
        :treedata="item.children"
      >
      </TestRecursiveTree>
    </div>
  </div>
</template>

<style scoped>
.test-recursive-item {
  padding-left: 10px;
}
</style>
