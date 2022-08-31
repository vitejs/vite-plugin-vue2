# @vitejs/plugin-vue2 [![npm](https://img.shields.io/npm/v/@vitejs/plugin-vue2.svg)](https://npmjs.com/package/@vitejs/plugin-vue2)

> Note: this plugin only works with Vue@^2.7.0.

```js
// vite.config.js
import vue from '@vitejs/plugin-vue2'

export default {
  plugins: [vue()]
}
```

## Options

```ts
export interface Options {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]

  isProduction?: boolean

  // options to pass on to vue/compiler-sfc
  script?: Partial<Pick<SFCScriptCompileOptions, 'babelParserPlugins'>>
  template?: Partial<
    Pick<
      SFCTemplateCompileOptions,
      | 'compiler'
      | 'compilerOptions'
      | 'preprocessOptions'
      | 'transpileOptions'
      | 'transformAssetUrls'
      | 'transformAssetUrlsOptions'
    >
  >
  style?: Partial<Pick<SFCStyleCompileOptions, 'trim'>>
}
```

## Asset URL handling

When `@vitejs/plugin-vue2` compiles the `<template>` blocks in SFCs, it also converts any encountered asset URLs into ESM imports.

For example, the following template snippet:

```vue
<img src="../image.png" />
```

Is the same as:

```vue
<script setup>
import _imports_0 from '../image.png'
</script>
```

```vue
<img :src="_imports_0" />
```

By default the following tag/attribute combinations are transformed, and can be configured using the `template.transformAssetUrls` option.

```js
{
  video: ['src', 'poster'],
  source: ['src'],
  img: ['src'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}
```

Note that only attribute values that are static strings are transformed. Otherwise, you'd need to import the asset manually, e.g. `import imgUrl from '../image.png'`.

## Example for passing options to `vue/compiler-sfc`:

```ts
import vue from '@vitejs/plugin-vue2'

export default {
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // ...
        },
        transformAssetUrls: {
          // ...
        }
      }
    })
  ]
}
```

## Example for transforming custom blocks

```ts
import vue from '@vitejs/plugin-vue2'

const vueI18nPlugin = {
  name: 'vue-i18n',
  transform(code, id) {
    if (!/vue&type=i18n/.test(id)) {
      return
    }
    if (/\.ya?ml$/.test(id)) {
      code = JSON.stringify(require('js-yaml').load(code.trim()))
    }
    return `export default Comp => {
      Comp.i18n = ${code}
    }`
  }
}

export default {
  plugins: [vue(), vueI18nPlugin]
}
```

## License

MIT
