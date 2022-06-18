<script>
export default {
    components: {
        componentA: () =>import('./componentA.vue')
    },
    beforeCreate() {
        this.$options.components.componentB = () =>import('./componentB.vue')
    }
}
</script>

<template>
    <div>
        <h3>Async Component</h3>
        <componentA />
        <componentB />

        <pre>
export default {
    components: {
        componentA: () =>import('./componentA.vue')
    },
    beforeCreate() {
        this.$options.components.componentB = () =>import('./componentB.vue')
    }
}
        </pre>
    </div>
</template>