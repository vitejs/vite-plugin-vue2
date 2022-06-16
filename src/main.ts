import path from 'path'
import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import type { PluginContext, TransformPluginContext } from 'rollup'
import type { RawSourceMap } from 'source-map'
import { transformWithEsbuild } from 'vite'
import {
  createDescriptor,
  getPrevDescriptor,
  setSrcDescriptor
} from './utils/descriptorCache'
import { resolveScript } from './script'
import { transformTemplateInMain } from './template'
import { isOnlyTemplateChanged } from './handleHotUpdate'
import { createRollupError } from './utils/error'
import type { ResolvedOptions } from '.'
import { NORMALIZER_ID } from './utils/componentNormalizer'
import { HMR_RUNTIME_ID } from './utils/hmrRuntime'

export async function transformMain(
  code: string,
  filename: string,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  ssr: boolean
  // asCustomElement: boolean
) {
  const { devServer, isProduction, devToolsEnabled } = options

  // prev descriptor is only set and used for hmr
  const prevDescriptor = getPrevDescriptor(filename)
  const { descriptor, errors } = createDescriptor(filename, code, options)

  if (errors.length) {
    errors.forEach((error) =>
      pluginContext.error(createRollupError(filename, error))
    )
    return null
  }

  // feature information
  const hasScoped = descriptor.styles.some((s) => s.scoped)
  const hasCssModules = descriptor.styles.some((s) => s.module)
  const hasFunctional =
    descriptor.template && descriptor.template.attrs.functional

  // script
  const { code: scriptCode, map: scriptMap } = await genScriptCode(
    descriptor,
    options,
    pluginContext,
    ssr
  )

  // template
  const templateCode = await genTemplateCode(
    descriptor,
    options,
    pluginContext,
    ssr
  )

  // styles
  const stylesCode = await genStyleCode(descriptor, pluginContext)

  // custom blocks
  const customBlocksCode = await genCustomBlockCode(descriptor, pluginContext)

  const output: string[] = [
    scriptCode,
    templateCode,
    stylesCode,
    customBlocksCode
  ]

  output.push(
    `/* normalize component */
import __normalizer from "${NORMALIZER_ID}"
var __component__ = /*#__PURE__*/__normalizer(
  _sfc_main,
  _sfc_render,
  _sfc_staticRenderFns,
  ${hasFunctional ? 'true' : 'false'},
  ${hasCssModules ? `_sfc_injectStyles` : `null`},
  ${hasScoped ? JSON.stringify(descriptor.id) : 'null'},
  null,
  null
)`
  )

  if (devToolsEnabled || (devServer && !isProduction)) {
    // expose filename during serve for devtools to pickup
    output.push(
      `__component__.options.__file = ${JSON.stringify(
        isProduction ? path.basename(filename) : filename
      )}`
    )
  }

  // HMR
  if (
    devServer &&
    devServer.config.server.hmr !== false &&
    !ssr &&
    !isProduction
  ) {
    const id = JSON.stringify(descriptor.id)
    output.push(
      `import __VUE_HMR_RUNTIME__ from "${HMR_RUNTIME_ID}"`,
      `if (!__VUE_HMR_RUNTIME__.isRecorded(${id})) {`,
      `  __VUE_HMR_RUNTIME__.createRecord(${id}, __component__.options)`,
      `}`
    )
    // check if the template is the only thing that changed
    if (
      hasFunctional ||
      (prevDescriptor && isOnlyTemplateChanged(prevDescriptor, descriptor))
    ) {
      output.push(`export const _rerender_only = true`)
    }
    output.push(
      `import.meta.hot.accept(({ default: updated, _rerender_only }) => {`,
      `  if (_rerender_only) {`,
      `    __VUE_HMR_RUNTIME__.rerender(${id}, updated)`,
      `  } else {`,
      `    __VUE_HMR_RUNTIME__.reload(${id}, updated)`,
      `  }`,
      `})`
    )
  }

  // SSR module registration by wrapping user setup
  if (ssr) {
    // TODO
  }

  let resolvedMap: RawSourceMap | undefined = scriptMap

  output.push(`export default __component__.exports`)

  // handle TS transpilation
  let resolvedCode = output.join('\n')
  if (
    (descriptor.script?.lang === 'ts' ||
      descriptor.scriptSetup?.lang === 'ts') &&
    !descriptor.script?.src // only normal script can have src
  ) {
    const { code, map } = await transformWithEsbuild(
      resolvedCode,
      filename,
      { loader: 'ts', sourcemap: options.sourceMap },
      resolvedMap
    )
    resolvedCode = code
    resolvedMap = resolvedMap ? (map as any) : resolvedMap
  }

  return {
    code: resolvedCode,
    map: resolvedMap || {
      mappings: ''
    },
    meta: {
      vite: {
        lang: descriptor.script?.lang || descriptor.scriptSetup?.lang || 'js'
      }
    }
  }
}

async function genTemplateCode(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean
) {
  const template = descriptor.template!
  const hasScoped = descriptor.styles.some((style) => style.scoped)

  // If the template is not using pre-processor AND is not using external src,
  // compile and inline it directly in the main module. When served in vite this
  // saves an extra request per SFC which can improve load performance.
  if (!template.lang && !template.src) {
    return transformTemplateInMain(
      template.content,
      descriptor,
      options,
      pluginContext,
      ssr
    )
  } else {
    if (template.src) {
      await linkSrcToDescriptor(
        template.src,
        descriptor,
        pluginContext,
        hasScoped
      )
    }
    const src = template.src || descriptor.filename
    const srcQuery = template.src
      ? hasScoped
        ? `&src=${descriptor.id}`
        : '&src=true'
      : ''
    const scopedQuery = hasScoped ? `&scoped=${descriptor.id}` : ``
    const attrsQuery = attrsToQuery(template.attrs, 'js', true)
    const query = `?vue&type=template${srcQuery}${scopedQuery}${attrsQuery}`
    const request = JSON.stringify(src + query)
    const renderFnName = ssr ? 'ssrRender' : 'render'
    return `import { ${renderFnName} as _sfc_${renderFnName} } from ${request}`
  }
}

async function genScriptCode(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean
): Promise<{
  code: string
  map: RawSourceMap | undefined
}> {
  let scriptCode = `const _sfc_main = {}`
  let map: RawSourceMap | undefined

  const script = resolveScript(descriptor, options, ssr)
  if (script) {
    // If the script is js/ts and has no external src, it can be directly placed
    // in the main module.
    if (
      (!script.lang || (script.lang === 'ts' && options.devServer)) &&
      !script.src
    ) {
      scriptCode = options.compiler.rewriteDefault(
        script.content,
        '_sfc_main',
        script.lang === 'ts' ? ['typescript'] : undefined
      )
      map = script.map
    } else {
      if (script.src) {
        await linkSrcToDescriptor(script.src, descriptor, pluginContext, false)
      }
      const src = script.src || descriptor.filename
      const langFallback = (script.src && path.extname(src).slice(1)) || 'js'
      const attrsQuery = attrsToQuery(script.attrs, langFallback)
      const srcQuery = script.src ? `&src=true` : ``
      const query = `?vue&type=script${srcQuery}${attrsQuery}`
      const request = JSON.stringify(src + query)
      scriptCode =
        `import _sfc_main from ${request}\n` + `export * from ${request}` // support named exports
    }
  }
  return {
    code: scriptCode,
    map
  }
}

async function genStyleCode(
  descriptor: SFCDescriptor,
  pluginContext: PluginContext
) {
  let stylesCode = ``
  let cssModulesMap: Record<string, string> | undefined
  if (descriptor.styles.length) {
    for (let i = 0; i < descriptor.styles.length; i++) {
      const style = descriptor.styles[i]
      if (style.src) {
        await linkSrcToDescriptor(
          style.src,
          descriptor,
          pluginContext,
          style.scoped
        )
      }
      const src = style.src || descriptor.filename
      // do not include module in default query, since we use it to indicate
      // that the module needs to export the modules json
      const attrsQuery = attrsToQuery(style.attrs, 'css')
      const srcQuery = style.src
        ? style.scoped
          ? `&src=${descriptor.id}`
          : '&src=true'
        : ''
      const directQuery = `` // asCustomElement ? `&inline` : ``
      const scopedQuery = style.scoped ? `&scoped=${descriptor.id}` : ``
      const query = `?vue&type=style&index=${i}${srcQuery}${directQuery}${scopedQuery}`
      const styleRequest = src + query + attrsQuery
      if (style.module) {
        const [importCode, nameMap] = genCSSModulesCode(
          i,
          styleRequest,
          style.module
        )
        stylesCode += importCode
        Object.assign((cssModulesMap ||= {}), nameMap)
      } else {
        stylesCode += `\nimport ${JSON.stringify(styleRequest)}`
      }
      // TODO SSR critical CSS collection
    }
  }
  if (cssModulesMap) {
    const mappingCode =
      Object.entries(cssModulesMap).reduce(
        (code, [key, value]) => code + `"${key}":${value},\n`,
        '{\n'
      ) + '}'
    stylesCode += `\nconst __cssModules = ${mappingCode}`
    stylesCode += `\nfunction _sfc_injectStyles(ctx) {
      for (var key in __cssModules) {
        this[key] = __cssModules[key]
      }
    }`
  }
  return stylesCode
}

function genCSSModulesCode(
  index: number,
  request: string,
  moduleName: string | boolean
): [importCode: string, nameMap: Record<string, string>] {
  const styleVar = `style${index}`
  const exposedName = typeof moduleName === 'string' ? moduleName : '$style'
  // inject `.module` before extension so vite handles it as css module
  const moduleRequest = request.replace(/\.(\w+)$/, '.module.$1')
  return [
    `\nimport ${styleVar} from ${JSON.stringify(moduleRequest)}`,
    { [exposedName]: styleVar }
  ]
}

async function genCustomBlockCode(
  descriptor: SFCDescriptor,
  pluginContext: PluginContext
) {
  let code = ''
  for (let index = 0; index < descriptor.customBlocks.length; index++) {
    const block = descriptor.customBlocks[index]
    if (block.src) {
      await linkSrcToDescriptor(block.src, descriptor, pluginContext, false)
    }
    const src = block.src || descriptor.filename
    const attrsQuery = attrsToQuery(block.attrs, block.type)
    const srcQuery = block.src ? `&src=true` : ``
    const query = `?vue&type=${block.type}&index=${index}${srcQuery}${attrsQuery}`
    const request = JSON.stringify(src + query)
    code += `import block${index} from ${request}\n`
    code += `if (typeof block${index} === 'function') block${index}(_sfc_main)\n`
  }
  return code
}

/**
 * For blocks with src imports, it is important to link the imported file
 * with its owner SFC descriptor so that we can get the information about
 * the owner SFC when compiling that file in the transform phase.
 */
async function linkSrcToDescriptor(
  src: string,
  descriptor: SFCDescriptor,
  pluginContext: PluginContext,
  scoped?: boolean
) {
  const srcFile =
    (await pluginContext.resolve(src, descriptor.filename))?.id || src
  // #1812 if the src points to a dep file, the resolved id may contain a
  // version query.
  setSrcDescriptor(srcFile.replace(/\?.*$/, ''), descriptor, scoped)
}

// these are built-in query parameters so should be ignored
// if the user happen to add them as attrs
const ignoreList = ['id', 'index', 'src', 'type', 'lang', 'module', 'scoped']

function attrsToQuery(
  attrs: SFCBlock['attrs'],
  langFallback?: string,
  forceLangFallback = false
): string {
  let query = ``
  for (const name in attrs) {
    const value = attrs[name]
    if (!ignoreList.includes(name)) {
      query += `&${encodeURIComponent(name)}${
        value ? `=${encodeURIComponent(value)}` : ``
      }`
    }
  }
  if (langFallback || attrs.lang) {
    query +=
      `lang` in attrs
        ? forceLangFallback
          ? `&lang.${langFallback}`
          : `&lang.${attrs.lang}`
        : `&lang.${langFallback}`
  }
  return query
}
