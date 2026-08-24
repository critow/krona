import envRightSample from './.env.right.sample?raw'
import envSample from './.env.sample?raw'
import appIni from './app.ini?raw'
import appJson from './app.json?raw'
import appRightIni from './app.right.ini?raw'
import appRightJson from './app.right.json?raw'
import { bigJson, mostlyUnchanged } from './big'
import cargoRightToml from './Cargo.right.toml?raw'
import cargoToml from './Cargo.toml?raw'
import composeRightYaml from './compose.right.yaml?raw'
import composeYaml from './compose.yaml?raw'
import reorderedJson from './reordered.json?raw'
import reorderedRightJson from './reordered.right.json?raw'
import unrelatedLeftYaml from './unrelated.left.yaml?raw'
import unrelatedRightYaml from './unrelated.right.yaml?raw'

/**
 * Every sample carries both versions, so switching to the diff mode is never a
 * dead end whichever sample is selected.
 */
export interface Sample {
  id: string
  label: string
  format: 'json' | 'yaml' | 'toml' | 'ini'
  left: string
  right: string
}

export const SAMPLES: Sample[] = [
  { id: 'json', label: 'app.json (JSONC)', format: 'json', left: appJson, right: appRightJson },
  { id: 'yaml', label: 'compose.yaml', format: 'yaml', left: composeYaml, right: composeRightYaml },
  { id: 'toml', label: 'Cargo.toml', format: 'toml', left: cargoToml, right: cargoRightToml },
  { id: 'ini', label: 'app.ini', format: 'ini', left: appIni, right: appRightIni },
  { id: 'env', label: '.env', format: 'ini', left: envSample, right: envRightSample },
  {
    id: 'reordered',
    label: 'Reordered keys',
    format: 'json',
    left: reorderedJson,
    right: reorderedRightJson,
  },
  {
    id: 'unrelated',
    label: 'Unrelated files',
    format: 'yaml',
    left: unrelatedLeftYaml,
    right: unrelatedRightYaml,
  },
  {
    id: 'big',
    label: 'Large lockfile (28k lines)',
    format: 'json',
    left: bigJson(),
    right: bigJson(4000, 1),
  },
  {
    id: 'collapsed',
    label: 'One change in a long file',
    format: 'json',
    left: mostlyUnchanged('left'),
    right: mostlyUnchanged('right'),
  },
]
