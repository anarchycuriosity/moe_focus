import { Component, type ReactNode } from 'react'

interface Props
{
  children: ReactNode
}

interface State
{
  has_error: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State>
{
  constructor(props: Props)
  {
    super(props)
    this.state = { has_error: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State
  {
    return { has_error: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void
  {
    console.error('MoeFocus Error:', error, info.componentStack)
  }

  render(): ReactNode
  {
    if (this.state.has_error)
    {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'var(--moe-font), sans-serif',
          color: 'var(--moe-text)',
          backgroundColor: '#FFF5EE',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h2 style={{ color: '#E892A3', marginBottom: '16px' }}>发生了点小问题</h2>
          <p style={{ color: '#8B7B89', fontSize: '14px', marginBottom: '24px', maxWidth: '500px' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => this.setState({ has_error: false, error: null })}
            style={{
              padding: '10px 28px',
              border: 'none',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #FFB7C5, #C9A9DC)',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--moe-font), sans-serif'
            }}
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
