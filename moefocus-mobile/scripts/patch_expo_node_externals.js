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
const patterns = [
  {
    old_text: '].includes(x)',
    new_text: '].includes(x) && !x.startsWith("node:")'
  },
  {
    old_text: '].includes(x)\n            //',
    new_text: '].includes(x) && !x.startsWith("node:")\n            //'
  }
]

if (source.includes('!x.startsWith("node:")'))
{
  process.exit(0)
}

const matched_pattern = patterns.find((pattern) => source.includes(pattern.old_text))

if (!matched_pattern)
{
  console.warn('[patch_expo_node_externals] Expo externals pattern not found; skipping patch.')
  process.exit(0)
}

fs.writeFileSync(target_file, source.replace(matched_pattern.old_text, matched_pattern.new_text), 'utf8')
console.log('[patch_expo_node_externals] Patched Expo Node externals for Windows + new Node.')
