import { registerHooks } from 'node:module'

// I sorgenti Vite usano import relativi senza estensione.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error
      return nextResolve(`${specifier}.ts`, context)
    }
  },
})
