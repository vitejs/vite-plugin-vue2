// @ts-ignore
import hash from 'hash-sum'
import type { SFCDescriptor, SFCTemplateCompileOptions } from 'vue/compiler-sfc'
import type { PluginContext, TransformPluginContext } from 'rollup'
import { getResolvedScript } from './script'
import { createRollupError } from './utils/error'
import type { ResolvedOptions } from '.'

export async function transformTemplateAsModule(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  ssr: boolean
): Promise<string> {
  let returnCode = compile(code, descriptor, options, pluginContext, ssr)
  if (
    options.devServer &&
    options.devServer.config.server.hmr !== false &&
    !ssr &&
    !options.isProduction
  ) {
    returnCode += `\nimport.meta.hot.accept(({ render }) => {
      __VUE_HMR_RUNTIME__.rerender(${JSON.stringify(descriptor.id)}, render)
    })`
  }

  return returnCode + `\nexport { render, staticRenderFns }`
}

/**
 * transform the template directly in the main SFC module
 */
export function transformTemplateInMain(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean
): string {
  return compile(code, descriptor, options, pluginContext, ssr)
    .replace(/var (render|staticRenderFns) =/, 'var _sfc_$1 =')
    .replace(/(render._withStripped)/, '_sfc_$1')
}

export function compile(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean
): string {
  const filename = descriptor.filename
  const result = options.compiler.compileTemplate({
    ...resolveTemplateCompilerOptions(descriptor, options, ssr)!,
    source: code
  })

  if (result.errors.length) {
    result.errors.forEach((error) =>
      pluginContext.error(
        typeof error === 'string'
          ? { id: filename, message: error }
          : createRollupError(filename, error)
      )
    )
  }

  if (result.tips.length) {
    result.tips.forEach((tip) =>
      pluginContext.warn({
        id: filename,
        message: typeof tip === 'string' ? tip : tip.msg
      })
    )
  }

  return transformRequireToImport(code)
}

function resolveTemplateCompilerOptions(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  ssr: boolean
): Omit<SFCTemplateCompileOptions, 'source'> | undefined {
  const block = descriptor.template
  if (!block) {
    return
  }
  const resolvedScript = getResolvedScript(descriptor, ssr)
  const hasScoped = descriptor.styles.some((s) => s.scoped)
  const { id, filename } = descriptor

  let preprocessOptions = block.lang && options.template?.preprocessOptions
  if (block.lang === 'pug') {
    preprocessOptions = {
      doctype: 'html',
      ...preprocessOptions
    }
  }

  return {
    ...options.template,
    filename,
    isProduction: options.isProduction,
    optimizeSSR: ssr,
    transformAssetUrls: true,
    transformAssetUrlsOptions: {
      ...options.template?.transformAssetUrlsOptions,
      includeAbsolute: true
    },
    preprocessLang: block.lang,
    preprocessOptions,
    bindings: resolvedScript ? resolvedScript.bindings : undefined,
    compilerOptions: {
      whitespace: 'condense',
      outputSourceRange: true,
      ...options.template?.compilerOptions,
      scopeId: hasScoped ? `data-v-${id}` : undefined
    }
  }
}

function transformRequireToImport(code: string): string {
  const imports: Record<string, string> = {}
  let strImports = ''

  code = code.replace(
    /require\(("(?:[^"\\]|\\.)+"|'(?:[^'\\]|\\.)+')\)/g,
    (_, name): any => {
      if (!(name in imports)) {
        // #81 compat unicode assets name
        imports[name] = `__$_require_${hash(name)}__`
        strImports += `import ${imports[name]} from ${name}\n`
      }

      return imports[name]
    }
  )

  return strImports + code
}
