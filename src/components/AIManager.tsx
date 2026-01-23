// AI模型管理组件
import { useState } from 'react';
import { useAI } from '../contexts/AIContext';
import './AIManager.css';

export const AIManager: React.FC = () => {
  const { apiKey, apiEndpoint, model, setApiKey, setApiEndpoint, setModel, saveSettings } = useAI();
  const [isVisible, setIsVisible] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Local state for editing - initialize from context on mount only
  // Local edits take precedence over external context changes
  const [localApiKey, setLocalApiKey] = useState(() => apiKey);
  const [localEndpoint, setLocalEndpoint] = useState(() => apiEndpoint);
  const [localModel, setLocalModel] = useState(() => model);

  const handleSaveKey = () => {
    if (!localApiKey.trim()) return;

    setSaveStatus('saving');
    setTimeout(() => {
      setApiKey(localApiKey.trim());
      saveSettings();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleClearKey = () => {
    setLocalApiKey('');
    setApiKey('');
    saveSettings();
    setSaveStatus('idle');
  };

  const handleSaveSettings = () => {
    setApiEndpoint(localEndpoint);
    setModel(localModel);
    saveSettings();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <div className="ai-manager">
      <div
        className="ai-manager-header"
        onClick={() => setIsVisible(!isVisible)}
      >
        <div className="ai-manager-title">
          <span className="ai-icon">✨</span>
          <span>AI 模型管理</span>
          {apiKey && <span className="status-indicator active"></span>}
        </div>
        <span className={`expand-icon ${isVisible ? 'expanded' : ''}`}>▼</span>
      </div>

      {isVisible && (
        <div className="ai-manager-content animate-fadeIn">
          {/* API Key 设置 */}
          <div className="api-key-section">
            <label htmlFor="ai-api-key">API Key</label>
            <div className="input-group">
              <input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                className="crystal-input"
              />
              <button
                className="toggle-visibility"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            <div className="button-group">
              <button
                className="crystal-btn crystal-btn-primary"
                onClick={handleSaveKey}
                disabled={!localApiKey.trim() || saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存 ✓' : '保存 API Key'}
              </button>
              {localApiKey && (
                <button
                  className="crystal-btn crystal-btn-secondary"
                  onClick={handleClearKey}
                >
                  清除
                </button>
              )}
            </div>

            {saveStatus === 'saved' && (
              <div className="status-message success animate-fadeIn">
                ✓ 设置已保存
              </div>
            )}
          </div>

          {/* 高级设置 */}
          <div className="advanced-settings">
            <h4 className="settings-title">⚙️ 高级设置</h4>

            <div className="setting-row">
              <label htmlFor="api-endpoint">API 端点</label>
              <input
                id="api-endpoint"
                type="text"
                value={localEndpoint}
                onChange={(e) => setLocalEndpoint(e.target.value)}
                className="crystal-input"
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>

            <div className="setting-row">
              <label htmlFor="ai-model">模型名称</label>
              <input
                id="ai-model"
                type="text"
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
                className="crystal-input"
                placeholder="gpt-3.5-turbo"
              />
            </div>

            <button
              className="crystal-btn crystal-btn-primary full-width"
              onClick={handleSaveSettings}
            >
              保存设置
            </button>
          </div>

          {/* 信息卡片 */}
          <div className="ai-info-section">
            <div className="info-card">
              <h4>📋 支持的 AI 服务</h4>
              <ul>
                <li>OpenAI (GPT-3.5/4)</li>
                <li>DeepSeek</li>
                <li>Claude (通过兼容接口)</li>
                <li>其他 OpenAI 兼容接口</li>
              </ul>
            </div>
            <div className="info-card">
              <h4>🔒 隐私说明</h4>
              <p>API Key 仅存储在本地浏览器中，不会上传到任何服务器。所有AI请求直接发送到您配置的API端点。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
