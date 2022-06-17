<script setup lang="ts">
import ScriptSetup from './ScriptSetup.vue'
import TestMultiplySrcImport from './src-import/TestMultiplySrcImport.vue'
import TestBlockSrcImport from './src-import/TestBlockSrcImport.vue'
import TestScopedCss from './css/TestScopedCss.vue'
import TestCssModules from './css/TestCssModules.vue'
import TestEmptyCss from './css/TestEmptyCss.vue'
import TestCustomBlock from './custom/TestCustomBlock.vue'
import TestHmr from './hmr/TestHmr.vue'
import TestAssets from './test-assets/TestAssets.vue'
import TestES2020Features from './TestES2020Features.vue'
</script>

<template>
  <div>
    <h1>Vite-Plugin-Vue2 Playground</h1>
    <ScriptSetup msg="prop from parent" />
    <TestMultiplySrcImport />
    <TestBlockSrcImport />
    <TestScopedCss />
    <TestCssModules />
    <TestCustomBlock />
    <TestEmptyCss />
    <TestHmr />
    <TestAssets />
    <TestES2020Features />
  </div>
</template>
