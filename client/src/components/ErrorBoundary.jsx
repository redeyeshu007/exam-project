import { Component } from 'react';
import logger from '../services/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    logger.error('React ErrorBoundary caught', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #FAF7F9 0%, #FEF9FB 100%)',
        padding: '24px',
      }}>
        <div style={{
          background: 'white', borderRadius: '20px', padding: '40px 32px', textAlign: 'center',
          maxWidth: '440px', width: '100%',
          boxShadow: '0 8px 40px rgba(27,10,18,0.10)',
          border: '1px solid #F0EDF0',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(220,38,38,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
          }}>
            <span style={{ fontSize: '26px' }}>⚠</span>
          </div>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '22px', fontWeight: '800', color: '#1B0A12', marginBottom: '10px',
          }}>
            Something went wrong
          </h2>
          <p style={{ color: '#9B8F94', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
            An unexpected error occurred. The error has been logged automatically.
            {import.meta.env.DEV && (
              <span style={{ display: 'block', marginTop: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#DC2626', wordBreak: 'break-word' }}>
                {this.state.errorMessage}
              </span>
            )}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: 'linear-gradient(135deg, #B42B6A, #9A2259)',
              color: 'white', border: 'none', borderRadius: '50px',
              padding: '11px 32px', fontWeight: '700', fontSize: '14px',
              cursor: 'pointer', boxShadow: '0 4px 14px rgba(180,43,106,0.3)',
            }}
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
