import { describe, expect, it } from 'vitest'
import '../formats/ini'
import '../formats/json'
import '../formats/toml'
import '../formats/yaml'
import { parseDocument } from './document'

const DOC = [
  '{',
  '  "name": "krona",',
  '  "server": {',
  '    "host": "0.0.0.0",',
  '    "tls": {',
  '      "ciphers": [',
  '        "TLS_AES_128",',
  '        "TLS_AES_256"',
  '      ]',
  '    }',
  '  },',
  '  "replicas": [',
  '    { "host": "db-1" },',
  '    { "host": "db-2" }',
  '  ],',
  '  "odd key.with dots": 1',
  '}',
].join('\n')

function pathsOf(source: string, format = 'json'): (string | undefined)[] {
  const model = parseDocument(source, format)
  return model.lines.map((line) => model.pathAt(line.index))
}

describe('pathAt', () => {
  it('names each line by its container chain', () => {
    expect(pathsOf(DOC)).toEqual([
      undefined,
      'name',
      'server',
      'server.host',
      'server.tls',
      'server.tls.ciphers',
      'server.tls.ciphers[0]',
      'server.tls.ciphers[1]',
      // A line that introduces nothing of its own still sits inside something,
      // and answers with what that is — a closing bracket names its block.
      'server.tls.ciphers',
      'server.tls',
      'server',
      'replicas',
      'replicas[0]',
      'replicas[1]',
      'replicas',
      '["odd key.with dots"]',
      undefined,
    ])
  })

  it('answers with the first entry on a line that holds several', () => {
    const paths = pathsOf(['{', '  "t": { "read": 30, "write": 60 }', '}'].join('\n'))
    expect(paths[1]).toBe('t')
  })

  it('says nothing for a format that reports no segments', () => {
    const model = parseDocument('plain text', 'text')
    expect(model.pathAt(0)).toBeUndefined()
    expect(model.pathSegments).toBeUndefined()
  })

  it('follows YAML indentation, and numbers sequence entries', () => {
    const yaml = [
      'server:',
      '  host: 0.0.0.0',
      '  tls:',
      '    ciphers:',
      '      - TLS_AES_128',
      '      - TLS_AES_256',
      'replicas:',
      '  - host: db-1',
      '    weight: 1',
      '  - host: db-2',
    ].join('\n')
    expect(pathsOf(yaml, 'yaml')).toEqual([
      'server',
      'server.host',
      'server.tls',
      'server.tls.ciphers',
      'server.tls.ciphers[0]',
      'server.tls.ciphers[1]',
      'replicas',
      // The dash line names the entry; the block it opens is that entry, so
      // what nests under it hangs off the index rather than off the inline key.
      'replicas[0]',
      'replicas[0].weight',
      'replicas[1]',
    ])
  })

  it('takes TOML paths from headers and dotted keys alike', () => {
    const toml = [
      '[server]',
      'host = "0.0.0.0"',
      '',
      '[server.tls]',
      'enabled = true',
      '',
      '[database]',
      'pool.min = 2',
    ].join('\n')
    expect(pathsOf(toml, 'toml')).toEqual([
      'server',
      'server.host',
      // A blank line inside a section still sits in it.
      'server',
      'server.tls',
      'server.tls.enabled',
      // The blank line after a section's last content is outside every range.
      undefined,
      'database',
      'database.pool.min',
    ])
  })

  it('reads INI sections and keys', () => {
    const ini = ['[core]', 'editor = vim', '', '[core.remote]', 'url = git@example.com'].join('\n')
    expect(pathsOf(ini, 'ini')).toEqual([
      'core',
      'core.editor',
      'core',
      'core.remote',
      'core.remote.url',
    ])
  })
})
