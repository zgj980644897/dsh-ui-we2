// Reconstruct src/ files from the shipped bundle so the source tree and the
// installed artifact can be proven identical.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const installed = join(process.env.USERPROFILE, '.dsh/profiles/desktop/node_modules/dsh-ui-we2/lib/client.js')
const bundle = readFileSync(installed, 'utf8')

const marker = 'const WE2_CSS = '
const start = bundle.indexOf(marker)
const literalStart = start + marker.length
if (bundle[literalStart] !== '"') throw new Error('bundle does not start the stylesheet literal with a quote')
let literalEnd = 0
let escaped = false
for (let i = literalStart + 1; i < bundle.length; i += 1) {
  const ch = bundle[i]
  if (escaped) { escaped = false; continue }
  if (ch === '\\') { escaped = true; continue }
  if (ch === '"') { literalEnd = i + 1; break }
}
if (literalEnd === 0) throw new Error('unterminated stylesheet literal')
const css = JSON.parse(bundle.slice(literalStart, literalEnd))

const factoryStart = bundle.indexOf('factory: (require) => {\n') + 'factory: (require) => {\n'.length
const factoryEnd = bundle.lastIndexOf('\n  },\n})')
const body = bundle.slice(factoryStart, factoryEnd)
const source = body.replace(bundle.slice(start, literalEnd), 'const WE2_CSS = __WE2_CSS__')

mkdirSync(join(root, 'src'), { recursive: true })
writeFileSync(join(root, 'src/theme.css'), css)
writeFileSync(join(root, 'src/client.js'), source.endsWith('\n') ? source : `${source}\n`)
console.log(`theme.css ${css.length} bytes, client.js ${source.length} bytes`)
