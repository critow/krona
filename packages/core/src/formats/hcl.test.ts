import { describe, expect, it } from 'vitest'
import { parseDocument } from '../model/document'
import { detectFormat } from '../model/registry'
import '../index'
import './hcl'

const doc = (source: string) => parseDocument(source, 'hcl')

const SOURCE = [
  '# the edge instance',
  'resource "aws_instance" "web" {',
  '  ami           = "ami-0123"',
  '  instance_type = var.size',
  '',
  '  tags = {',
  '    Name = "web"',
  '  }',
  '}',
  '',
  'variable "size" {',
  '  default = "t3.micro"',
  '}',
].join('\n')

describe('hcl provider', () => {
  it('folds blocks and the objects inside them', () => {
    const model = doc(SOURCE)
    expect(model.foldingRanges).toEqual([
      { startLine: 1, endLine: 8, level: 0, kind: 'block', summary: '{…}', childCount: 3 },
      { startLine: 5, endLine: 7, level: 1, kind: 'object', summary: '{…}', childCount: 1 },
      { startLine: 10, endLine: 12, level: 0, kind: 'block', summary: '{…}', childCount: 1 },
    ])
  })

  it('names a block by its type and its labels together', () => {
    const model = doc(SOURCE)
    expect(model.pathAt(1)).toBe('resource.aws_instance.web')
    expect(model.pathAt(2)).toBe('resource.aws_instance.web.ami')
    expect(model.pathAt(6)).toBe('resource.aws_instance.web.tags.Name')
  })

  it('paints a header, an attribute and a reference each as what it is', () => {
    const model = doc(SOURCE)
    expect(model.tokensAt(1)).toEqual([
      { type: 'section', start: 0, end: 8 },
      { type: 'string', start: 9, end: 23 },
      { type: 'string', start: 24, end: 29 },
      { type: 'punctuation', start: 30, end: 31 },
    ])
    expect(model.tokensAt(2)).toEqual([
      { type: 'key', start: 2, end: 5 },
      { type: 'punctuation', start: 16, end: 17 },
      { type: 'string', start: 18, end: 28 },
    ])
    // `var.size` declares nothing, so nothing on it is painted as a key: the
    // name and the attribute it reaches into are both left as plain text.
    expect(model.tokensAt(3).map((token) => token.type)).toEqual([
      'key',
      'punctuation',
      'punctuation',
    ])
  })

  it('takes a heredoc whole, folds it, and paints every line of it', () => {
    const model = doc(
      ['user_data = <<-EOT', '  #!/bin/sh', '  echo "hello"', 'EOT', 'other = 1'].join('\n'),
    )
    expect(model.foldingRanges).toEqual([{ startLine: 0, endLine: 3, level: 0, kind: 'scalar' }])
    // A `#` inside a heredoc is a shebang, not a comment, and `"hello"` there is
    // not a string of the language.
    expect(model.tokensAt(1)).toEqual([{ type: 'string', start: 2, end: 11 }])
    expect(model.tokensAt(2)).toEqual([{ type: 'string', start: 2, end: 14 }])
    expect(model.tokensAt(4).at(0)).toEqual({ type: 'key', start: 0, end: 5 })
  })

  it('marks all three kinds of comment, and keeps a brace inside one out', () => {
    const model = doc(['# one', '// two', '/* three', '   { */', 'a = 1'].join('\n'))
    expect(model.tokensAt(0)).toEqual([{ type: 'comment', start: 0, end: 5 }])
    expect(model.tokensAt(1)).toEqual([{ type: 'comment', start: 0, end: 6 }])
    expect(model.tokensAt(3)).toEqual([{ type: 'comment', start: 0, end: 7 }])
    expect(model.foldingRanges).toEqual([])
  })

  it('folds a list over several lines', () => {
    const model = doc(['ports = [', '  80,', '  443,', ']'].join('\n'))
    expect(model.foldingRanges).toEqual([
      { startLine: 0, endLine: 3, level: 0, kind: 'array', summary: '[…]', childCount: 0 },
    ])
  })

  it('says what was left open', () => {
    expect(doc('resource "a" "b" {\n  x = 1\n').diagnostics[0]).toMatchObject({
      code: 'hcl-unclosed',
      line: 0,
    })
    expect(doc('x = <<EOT\nnever ends\n').diagnostics[0]).toMatchObject({
      code: 'hcl-unterminated-heredoc',
      line: 0,
    })
    expect(doc('}\n').diagnostics[0]).toMatchObject({ code: 'hcl-unexpected-close', line: 0 })
  })

  it('is recognised by a block header, and takes nothing else from anyone', () => {
    const lines = (source: string) => source.split('\n')
    expect(detectFormat(SOURCE, lines(SOURCE))).toBe('hcl')
    expect(detectFormat('{\n  "a": 1\n}', lines('{\n  "a": 1\n}'))).toBe('json')
    expect(detectFormat('[a]\nb = 2', lines('[a]\nb = 2'))).toBe('toml')
  })

  it('degrades gracefully on garbage', () => {
    const model = doc('{{{{\n====\n"unclosed\n<<\n}}}}')
    for (let line = 0; line < model.lines.length; line++) {
      expect(() => model.tokensAt(line)).not.toThrow()
    }
  })
})
