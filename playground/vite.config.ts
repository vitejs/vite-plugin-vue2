import { defineConfig } from 'vite'
import vue from '../src/index'

const config = defineConfig({
  resolve: {
    alias: {
      '@': __dirname
    }
  },
  build: {
    sourcemap: true,
    minify: false
  },
  plugins: [
    vue(),
    {
      name: 'customBlock',
      transform(code, id) {
        if (/type=custom/i.test(id)) {
          const transformedAssignment = code
            .trim()
            .replace(/export default/, 'const __customBlock =')
          return {
            code: `${transformedAssignment}
            export default function (Comp) {
              if (!Comp.__customBlock) {
                Comp.__customBlock = {};
              }
              Object.assign(Comp.__customBlock, __customBlock);
            }`,
            map: null
          }
        }
      }
    }
  ]
})

export default config
