import envRightSample from './.env.right.sample?raw'
import envSample from './.env.sample?raw'
import appIni from './app.ini?raw'
import appJson from './app.json?raw'
import appJson5 from './app.json5?raw'
import appRightIni from './app.right.ini?raw'
import appRightJson from './app.right.json?raw'
import appRightJson5 from './app.right.json5?raw'
import applicationProperties from './application.properties?raw'
import applicationRightProperties from './application.right.properties?raw'
import { bigJson, mostlyUnchanged } from './big'
import cargoRightToml from './Cargo.right.toml?raw'
import cargoToml from './Cargo.toml?raw'
import composeRightYaml from './compose.right.yaml?raw'
import composeYaml from './compose.yaml?raw'
import mainRightTf from './main.right.tf?raw'
import mainTf from './main.tf?raw'
import pomRightXml from './pom.right.xml?raw'
import pomXml from './pom.xml?raw'
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
  format: 'json' | 'json5' | 'yaml' | 'toml' | 'ini' | 'xml' | 'hcl' | 'properties'
  /** One line on what this sample is here to show. */
  note: string
  left: string
  right: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'json',
    note: 'Comments and trailing commas survive; objects and arrays fold.',
    label: 'app.json (JSONC)',
    format: 'json',
    left: appJson,
    right: appRightJson,
  },
  {
    id: 'yaml',
    note: 'Block scalars and anchors, folded by indentation.',
    label: 'compose.yaml',
    format: 'yaml',
    left: composeYaml,
    right: composeRightYaml,
  },
  {
    id: 'toml',
    note: 'Tables nest by dotted path; arrays of tables stay siblings.',
    label: 'Cargo.toml',
    format: 'toml',
    left: cargoToml,
    right: cargoRightToml,
  },
  {
    id: 'ini',
    note: 'Sections fold, dotted names nest.',
    label: 'app.ini',
    format: 'ini',
    left: appIni,
    right: appRightIni,
  },
  {
    id: 'env',
    note: 'Flat by design — nothing to fold, only highlighting.',
    label: '.env',
    format: 'ini',
    left: envSample,
    right: envRightSample,
  },
  {
    id: 'json5',
    note: 'Unquoted keys, single quotes, hex numbers and comments.',
    label: 'app.json5',
    format: 'json5',
    left: appJson5,
    right: appRightJson5,
  },
  {
    id: 'xml',
    note: 'Elements fold from their opening tag to their closing one.',
    label: 'pom.xml',
    format: 'xml',
    left: pomXml,
    right: pomRightXml,
  },
  {
    id: 'hcl',
    note: 'Blocks fold with their labels; a heredoc is one entry.',
    label: 'main.tf',
    format: 'hcl',
    left: mainTf,
    right: mainRightTf,
  },
  {
    id: 'properties',
    note: 'A value continued over several lines folds to one row.',
    label: 'application.properties',
    format: 'properties',
    left: applicationProperties,
    right: applicationRightProperties,
  },
  {
    id: 'reordered',
    note: 'Moving a key is a real difference, exactly as in git.',
    label: 'Reordered keys',
    format: 'json',
    left: reorderedJson,
    right: reorderedRightJson,
  },
  {
    id: 'unrelated',
    note: 'Two files with nothing in common.',
    label: 'Unrelated files',
    format: 'yaml',
    left: unrelatedLeftYaml,
    right: unrelatedRightYaml,
  },
  {
    id: 'big',
    note: '28k lines, virtualized; a scattered dependency bump.',
    label: 'Large lockfile (28k lines)',
    format: 'json',
    left: bigJson(),
    right: bigJson(4000, 1),
  },
  {
    id: 'collapsed',
    note: 'One change buried in a long file, unchanged runs folded away.',
    label: 'One change in a long file',
    format: 'json',
    left: mostlyUnchanged('left'),
    right: mostlyUnchanged('right'),
  },
]
