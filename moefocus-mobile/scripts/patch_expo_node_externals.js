const fs = require('fs')
const path = require('path')

const target_file = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'metro',
  'externals.js'
)

if (!fs.existsSync(target_file))
{
  process.exit(0)
}

const source = fs.readFileSync(target_file, 'utf8')
const old_text = '].includes(x)'
const new_text = '].includes(x) && !x.startsWith("node:")'

if (source.includes(new_text))
{
  process.exit(0)
}

if (!source.includes(old_text))
{
  console.warn('[patch_expo_node_externals] Expo externals pattern not found; skipping patch.')
  process.exit(0)
}

fs.writeFileSync(target_file, source.replace(old_text, new_text), 'utf8')
console.log('[patch_expo_node_externals] Patched Expo Node externals for Windows + new Node.')
