import React from 'react';
import { AlertTriangle, RefreshCw, Download, Settings } from 'lucide-react';
import { resetConfig } from './config/configManager.js';
import { DEFAULT_QUEUE_CONFIG } from './config/defaultConfig.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      resetAttempts: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleHardReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('清理 localStorage 失败:', e);
    }
    try {
      resetConfig();
    } catch (e) {
      console.warn('重置配置失败:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null, resetAttempts: this.state.resetAttempts + 1 });
    setTimeout(() => window.location.reload(), 300);
  };

  handleSoftReset = () => {
    try {
      resetConfig();
    } catch (e) {
      console.warn('重置配置失败:', e);
    }
    this.setState({ hasError: false, error: null, errorInfo: null, resetAttempts: this.state.resetAttempts + 1 });
  };

  handleExportError = () => {
    const errorDump = {
      timestamp: new Date().toISOString(),
      error: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        name: this.state.error?.name
      },
      componentStack: this.state.errorInfo?.componentStack,
      resetAttempts: this.state.resetAttempts,
      userAgent: navigator.userAgent,
      defaultConfig: DEFAULT_QUEUE_CONFIG
    };
    const blob = new Blob([JSON.stringify(errorDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #fecaca',
            boxShadow: '0 20px 60px rgba(220, 38, 38, 0.15)',
            padding: '32px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              background: 'linear-gradient(90deg, #ef4444, #f97316, #f59e0b)'
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #fee2e2, #fed7aa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={32} color="#dc2626" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1f2937' }}>
                  页面出现错误
                </h2>
                <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                  请尝试下方的修复方案，您的病例数据不会丢失
                </p>
              </div>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '13px',
                color: '#991b1b',
                fontWeight: 600,
                marginBottom: '6px'
              }}>
                错误详情
              </div>
              <div style={{
                fontSize: '13px',
                color: '#7f1d1d',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                lineHeight: 1.5,
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                {this.state.error?.message || '未知错误'}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '10px' }}>
                推荐修复步骤（按顺序尝试）
              </div>
              <ol style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '13px',
                color: '#4b5563',
                lineHeight: 1.8
              }}>
                <li>点击「重置配置到默认」（仅影响队列配置，保留您的病例数据）</li>
                <li>如果仍有问题，点击「全部重置并刷新」（清空所有本地数据后重新加载）</li>
                <li>如仍无法解决，请导出错误报告联系技术支持</li>
              </ol>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <button
                onClick={this.handleSoftReset}
                style={{
                  flex: '1 1 auto',
                  minWidth: '160px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '2px solid #5f69c8',
                  background: '#ffffff',
                  color: '#5f69c8',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eef2ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                }}
              >
                <Settings size={16} />
                重置配置到默认
              </button>

              <button
                onClick={this.handleHardReset}
                style={{
                  flex: '1 1 auto',
                  minWidth: '160px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #5f69c8, #7c3aed)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <RefreshCw size={16} />
                全部重置并刷新
              </button>

              <button
                onClick={this.handleExportError}
                style={{
                  flex: '1 1 100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  background: '#f9fafb',
                  color: '#4b5563',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} />
                导出错误报告
              </button>
            </div>

            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #f3f4f6',
              fontSize: '12px',
              color: '#9ca3af',
              textAlign: 'center'
            }}>
              重试次数：{this.state.resetAttempts} · 所有操作均在浏览器本地执行
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
