/**
 * A large document for the virtualization reference screenshot. Generated so
 * the repository does not carry a multi-megabyte fixture.
 */
export function bigJson(entries = 4000): string {
  const lines: string[] = ['{', '  "generated": true,', '  "packages": {']
  for (let i = 0; i < entries; i++) {
    lines.push(
      `    "pkg-${i}": {`,
      `      "version": "1.${i % 30}.${i % 7}",`,
      '      "license": "MIT",',
      '      "dependencies": {',
      `        "pkg-${(i + 1) % entries}": "^1.0.0"`,
      '      }',
      i === entries - 1 ? '    }' : '    },',
    )
  }
  lines.push('  }', '}')
  return lines.join('\n')
}

/**
 * A long file with a single change in the middle: the case where collapsing
 * unchanged runs earns its place.
 */
export function mostlyUnchanged(side: 'left' | 'right', entries = 120): string {
  const lines: string[] = ['{', '  "service": "api",']
  for (let i = 0; i < entries; i++) {
    const value = i === Math.floor(entries / 2) && side === 'right' ? 'changed' : `value-${i}`
    lines.push(`  "setting-${i}": "${value}",`)
  }
  lines.push('  "tail": true', '}')
  return lines.join('\n')
}
