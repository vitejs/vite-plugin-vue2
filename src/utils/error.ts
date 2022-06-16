import type { RollupError } from 'rollup'
import { WarningMessage } from 'vue/compiler-sfc'

export function createRollupError(
  id: string,
  error: Error | WarningMessage
): RollupError {
  if ('msg' in error) {
    return {
      id,
      plugin: 'vue',
      message: error.msg,
      name: 'vue-compiler-error'
    }
  } else {
    return {
      id,
      plugin: 'vue',
      message: error.message,
      name: error.name,
      stack: error.stack
    }
  }
}
