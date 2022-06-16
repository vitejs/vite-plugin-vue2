import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { ExistingRawSourceMap, TransformPluginContext } from 'rollup'
import type { RawSourceMap } from 'source-map'
import { formatPostcssSourceMap } from 'vite'
import type { ResolvedOptions } from '.'

export async function transformStyle(
  code: string,
  descriptor: SFCDescriptor,
  index: number,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  filename: string
) {
  const block = descriptor.styles[index]
  // vite already handles pre-processors and CSS module so this is only
  // applying SFC-specific transforms like scoped mode and CSS vars rewrite (v-bind(var))
  const result = await options.compiler.compileStyleAsync({
    ...options.style,
    filename: descriptor.filename,
    id: `data-v-${descriptor.id}`,
    // isProd: options.isProduction,
    source: code,
    scoped: !!block.scoped,
    ...(options.cssDevSourcemap
      ? {
          postcssOptions: {
            map: {
              from: filename,
              inline: false,
              annotation: false
            }
          }
        }
      : {})
  })

  if (result.errors.length) {
    result.errors.forEach((error: any) => {
      if (error.line && error.column) {
        error.loc = {
          file: descriptor.filename,
          line: error.line + getLine(descriptor.source, block.start),
          column: error.column
        }
      }
      pluginContext.error(error)
    })
    return null
  }

  const map = result.map
    ? await formatPostcssSourceMap(
        // version property of result.map is declared as string
        // but actually it is a number
        result.map as Omit<RawSourceMap, 'version'> as ExistingRawSourceMap,
        filename
      )
    : ({ mappings: '' } as any)

  return {
    code: result.code,
    map: map
  }
}

function getLine(source: string, start: number) {
  const lines = source.split(/\r?\n/g)
  let cur = 0
  for (let i = 0; i < lines.length; i++) {
    cur += lines[i].length
    if (cur >= start) {
      return i
    }
  }
}
