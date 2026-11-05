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
        <div className="app-bg flex items-center justify-center p-6">
          <div className="glass-card px-10 py-10 max-w-md w-full text-center">
            <p className="text-4xl mb-4" aria-hidden="true">{'\u{1F327}\u{FE0F}'}</p>
            <h2 className="font-display text-[22px] font-medium mb-2">
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
              <button onClick={this.handleRestart} className="btn btn-primary h-11 px-8 text-sm">
                Try again
              </button>
              <button onClick={() => window.location.reload()} className="btn btn-ghost h-10 px-8 text-xs">
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
