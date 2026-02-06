import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-full flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(to bottom right, var(--t-bg-start), var(--t-bg-end))' }}
        >
          <div
            className="rounded-3xl px-10 py-10 max-w-md w-full text-center"
            style={{ backgroundColor: 'var(--t-card)', boxShadow: 'var(--t-shadow-card)' }}
          >
            <p className="text-3xl mb-4">:(</p>
            <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--t-text)' }}>
              Something went wrong
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--t-text-light)' }}>
              Don't worry, your data is safe. Try restarting the app.
            </p>
            {this.state.error && (
              <p
                className="text-xs mb-6 px-4 py-2 rounded-xl"
                style={{ backgroundColor: 'var(--t-code-bg)', color: 'var(--t-text-faint)' }}
              >
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleRestart}
                className="rounded-xl py-3 px-8 text-sm font-medium text-white transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(to right, var(--t-accent), var(--t-accent-end))',
                  boxShadow: `0 2px 12px var(--t-accent-shadow)`,
                }}
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl py-2.5 px-8 text-xs font-medium transition-all duration-200 active:scale-[0.98]"
                style={{ color: 'var(--t-text-light)' }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
