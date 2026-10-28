// Static contract check for the built bundle and package manifest. Run before
// installing: `node scripts/check.mjs`.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(join(root, relative), 'utf8')
const problems = []
const expect = (condition, message) => { if (!condition) problems.push(message) }

const manifest = JSON.parse(read('package.json'))
const bundle = read('lib/client.js')
const host = read('index.js')

expect(manifest.name === 'dsh-ui-we2', `package name is ${String(manifest.name)}, expected dsh-ui-we2`)
expect(manifest.type === 'module', 'package must be an ES module')
expect(manifest.dsh?.client?.platform === 'web', 'dsh.client.platform must be "web"')
expect(manifest.exports?.['./client'] === './lib/client.js', 'exports["./client"] must point at ./lib/client.js')
expect(manifest.exports?.['.'] === './index.js', 'exports["."] must point at ./index.js')
expect((manifest.dependencies ?? {}) === undefined || Object.keys(manifest.dependencies ?? {}).length === 0,
  'the skin must not declare runtime dependencies')
expect(manifest.peerDependencies === undefined, 'the skin must not declare peer dependencies')

expect(/^window\.__ModuleLoader__\.load\(\{/m.test(bundle), 'bundle must register through window.__ModuleLoader__.load')
expect((bundle.match(/__ModuleLoader__\.load\(/g) ?? []).length === 1, 'bundle must register exactly once')
expect(bundle.includes(`id: 'dsh-ui-we2'`), 'bundle id must equal the package name')
expect(!bundle.includes('__WE2_CSS__'), 'stylesheet placeholder was not substituted')
expect(bundle.includes('function apply(ctx)'), 'bundle must export an apply function')
expect(bundle.includes("typeof document === 'undefined'"), 'apply must guard a document-less environment')
expect(bundle.trimEnd().endsWith('})'), 'bundle must close the module-table registration')
expect(bundle.endsWith('\n'), 'bundle must end with exactly one newline')
expect(/export const name = 'dsh-ui-we2'/.test(host), 'host half must export its plugin name')
expect(/export function apply\(/.test(host), 'host half must export apply')

// The host half must not import anything: a broken or missing dependency could
// otherwise fail the Loader entry (and with it the whole profile boot).
expect(!/^\s*import\s/m.test(host), 'host half must have no imports')

if (problems.length > 0) {
  console.error('dsh-ui-we2 check failed:')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log('dsh-ui-we2 check passed: manifest, bundle registration, and host entry are consistent')
