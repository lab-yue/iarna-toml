'use strict'
const approx = require('approximate-number')
const fs = require('fs')
const results = JSON.parse(fs.readFileSync('./benchmark-results.json'))

const size = {
  overall: 1124628,
}
const testName = {
  overall: 'Overall',
  '0A-spec-01-example-v0.4.0': 'Spec Example: v0.4.0',
  '0A-spec-02-example-hard-unicode': 'Spec Example: Hard Unicode',
  '0B-types-array-inline-empty': 'Types: Array, Inline',
  '0B-types-array': 'Types: Array',
  '0B-types-scalar-bools': 'Types: Boolean,',
  '0B-types-scalar-datetimes': 'Types: Datetime',
  '0B-types-scalar-floats': 'Types: Float',
  '0B-types-scalar-ints': 'Types: Int',
  '0B-types-scalar-literal-7-char': 'Types: Literal String, 7 char',
  '0B-types-scalar-literal-92-char': 'Types: Literal String, 92 char',
  '0B-types-scalar-literal-multiline-1079-chars': 'Types: Literal String, Multiline, 1079 char',
  '0B-types-scalar-string-7-char': 'Types: Basic String, 7 char',
  '0B-types-scalar-string-92-char': 'Types: Basic String, 92 char',
  '0B-types-scalar-string-multiline-1079-chars': 'Types: Basic String, 1079 char',
  '0B-types-table-inline-empty': 'Types: Table, Inline',
  '0B-types-table': 'Types: Table',
  '0C-scaling-array-inline-1000': 'Scaling: Array, Inline, 1000 elements',
  '0C-scaling-array-inline-nested-1000': 'Scaling: Array, Nested, 1000 deep',
  '0C-scaling-literal-40kb': 'Scaling: Literal String, 40kb',
  '0C-scaling-scalar-literal-multiline-40kb': 'Scaling: Literal String, Multiline, 40kb',
  '0C-scaling-scalar-string-multiline-40kb': 'Scaling: Basic String, Multiline, 40kb',
  '0C-scaling-string-40kb': 'Scaling: Basic String, 40kb',
  '0C-scaling-table-inline-1000': 'Scaling: Table, Inline, 1000 elements',
  '0C-scaling-table-inline-nested-1000': 'Scaling: Table, Inline, Nested, 1000 deep',
}

function fileSize(name) {
  /* eslint-disable security/detect-non-literal-fs-filename */
  try {
    return fs.readFileSync('benchmark/' + name + '.toml').length
  } catch (_) {
    return fs.readFileSync('test/spec-test/' + name + '.toml').length
  }
}

function repeat(str, count) {
  let result = ''
  for (let ii = 0; ii < count; ++ii) result += str
  return result
}

function getMedal(sorted, lib) {
  const index = sorted.indexOf(lib)
  if (index < 3) return medals[index]
  return ''
}

const medals = ['🥇', '🥈', '🥉']
const avg = {}
const content = []

for (let nodev in results) {
  content.push(`### ${nodev}`)
  // overall is not reported if any errors/crashes happen,
  // excluding for now because running the benchmark again is too time consuming.
  delete results[nodev]['overall']
  const tests = Object.keys(results[nodev])
  const libs = Object.keys(results[nodev][tests[0]])
  content.push('')
  content.push('|   |' + libs.map((_) => ` [${_.replace(/[/]/, '/<wbr>')}](https://npm.im/${_}) |`).join(''))
  content.push('| - |' + libs.map((_) => ` :${repeat('-', _.length - 2)}: |`).join(''))
  content.push(
    '| **status** |' +
      libs
        .map(
          (lib) =>
            ` ${['v', 'dm', 'license', 'node', 'dependents', 'types']
              .map((badge) => `![](https://badgen.net/npm/${badge}/${lib})`)
              .join('<br>')} |`,
        )
        .join(''),
  )

  for (let test of tests) {
    if (!size[test]) {
      try {
        size[test] = fileSize(test)
      } catch (_) {
        continue
      }
    }
    const bench = results[nodev][test]
    let line = `| **${testName[test] || test}** |`
    const libsWithMb = libs.map((lib) => {
      if (!bench[lib] || bench[lib].crashed) return { mb: null, lib }
      const speed = bench[lib].opsec * size[test]
      const mb = speed / 1000000
      avg[lib] ??= []
      avg[lib].push(mb)
      return { mb, name: lib }
    })
    const sorted = [...libsWithMb].sort((la, lb) => lb.mb - la.mb).map(({ name }) => name)
    for (let { name, mb } of libsWithMb) {
      if (!mb) {
        line += ` - |`
      } else {
        line += ` ${approx(mb)}MB/s ${getMedal(sorted, name)}<br><small>${bench[name].errmargin}%</small> |`
      }
    }
    content.push(line)
  }
  content.push('')

  const avgSorted = Object.entries(avg)
    .map(([k, v]) => {
      return { k, v: v.reduce((acc, curr) => acc + curr) / v.length }
    })
    .sort((la, lb) => lb.v - la.v)
  const avgSortedNames = avgSorted.map((l) => l.k)

  content.splice(
    4,
    0,
    '| **Average** |' +
      libs
        .map((lib) => {
          const index = avgSorted.findIndex((l) => l.k === lib)
          const data = avgSorted[index]
          return ` ${approx(data.v)}MB/s ${getMedal(avgSortedNames, lib)}|`
        })
        .join(''),
  )

  fs.writeFileSync('BENCHMARK.md', content.join('\n'), 'utf8')
}
