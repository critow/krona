import {
  Krona,
  useKronaConfig,
  useKronaDiff,
  useKronaSearch,
  useKronaViewer,
  useLineSource,
} from 'kronajs'
import { Component, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

/**
 * Every public hook says in its docs where it may be called, and throws a named
 * error when it is called anywhere else. That message is the first thing a
 * consumer composing their own parts will see, so it is part of the API.
 */
class Catch extends Component<
  { onError: (message: string) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error.message)
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}

/** The message a component throws when rendered where it does not belong. */
async function messageFrom(children: ReactNode): Promise<string> {
  let message = ''
  // React reports the error itself as well, on top of handing it to the
  // boundary; the test is about the message, not about React's logging.
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <Catch
        onError={(text) => {
          message = text
        }}
      >
        {children}
      </Catch>,
    )
    // The boundary is handed the error after the failed render commits, not
    // during it, so the message is not there the moment render() returns.
    await vi.waitFor(() => expect(message).not.toBe(''))
  } finally {
    error.mockRestore()
  }
  return message
}

const Uses = ({ hook }: { hook: () => unknown }) => {
  hook()
  return null
}

describe('hooks called outside what provides them', () => {
  it.for([
    ['useKronaConfig', useKronaConfig, 'must be rendered inside <Krona>'],
    ['useLineSource', useLineSource, '<Krona.Viewer> or <Krona.Panel>'],
    ['useKronaSearch', useKronaSearch, 'useKronaSearch() must be called inside'],
    ['useKronaDiff', useKronaDiff, 'useKronaDiff() must be called inside <Krona.Diff>'],
    ['useKronaViewer', useKronaViewer, 'useKronaViewer() must be called inside <Krona.Viewer>'],
  ] as const)('%s says where it belongs', async ([, hook, expected]) => {
    const message = await messageFrom(<Uses hook={hook} />)
    expect(message).toContain('Krona:')
    expect(message).toContain(expected)
  })

  it('a panel outside a diff says so, rather than rendering half a diff', async () => {
    const message = await messageFrom(
      <Krona format="json">
        <Krona.Panel side="left" />
      </Krona>,
    )
    expect(message).toContain('<Krona.Panel> must be rendered inside <Krona.Diff>')
  })
})
