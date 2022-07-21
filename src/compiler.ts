// extend the descriptor so we can store the scopeId on it
declare module 'vue/compiler-sfc' {
  interface SFCDescriptor {
    id: string
  }
}

import { createRequire } from 'node:module'
import type * as _compiler from 'vue/compiler-sfc'

export function resolveCompiler(root: string): typeof _compiler {
  // resolve from project root first, then fallback to peer dep (if any)
  const compiler = tryRequire('vue/compiler-sfc', root)

  if (!compiler) {
    throw new Error(
      `Failed to resolve vue/compiler-sfc.\n` +
        `@vitejs/plugin-vue2 requires vue (>=2.7.0) ` +
        `to be present in the dependency tree.`
    )
  }

  return compiler
}

const _require = createRequire(import.meta.url)

function tryRequire(id: string, from?: string) {
  try {
    return from
      ? _require(_require.resolve(id, { paths: [from] }))
      : _require(id)
  } catch (e) {}
}
