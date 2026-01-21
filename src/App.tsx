import { useState, useCallback, useEffect } from 'react';
import { AccountManager } from './components/AccountManager';
import { AnswerQuery } from './components/AnswerQuery';
import { StatisticsPanel } from './components/StatisticsPanel';
import { YearReport } from './components/YearReport';
import { useAccount } from './hooks/useAccount';
import { getAllIdolAnswers } from './services/pocket48Api';
import type { IdolAnswer } from './types';
import './App.css';

function App() {
  const {
    accounts,
    currentAccount,
    addAccount,
    removeAccount,
    switchAccount,
  } = useAccount();

  const [answers, setAnswers] = useState<IdolAnswer[]>(() => {
    try {
      const saved = localStorage.getItem('pocket48_answers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load answers from localStorage', e);
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'account' | 'query' | 'stats' | 'report'>('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 监听 answers 变化并保存到 localStorage
  useEffect(() => {
    if (answers.length > 0) {
      try {
        localStorage.setItem('pocket48_answers', JSON.stringify(answers));
      } catch (e) {
        console.error('Failed to save answers to localStorage', e);
        // Use setTimeout to avoid synchronous state update in effect
        setTimeout(() => setMessage('数据量过大，无法保存到本地缓存'), 0);
      }
    }
  }, [answers]);

  const handleLoadData = useCallback(async () => {
    if (!currentAccount) {
      setMessage('请先登录账号');
      return;
    }
    setLoading(true);
    setMessage('正在加载翻牌数据...');
    try {
      const allAnswers = await getAllIdolAnswers(currentAccount.token);
      setAnswers(allAnswers);
      setMessage(`成功加载 ${allAnswers.length} 条翻牌数据`);
    } catch (error) {
      setMessage('加载失败，请重试');
    }
    setLoading(false);
  }, [currentAccount]);

  const handleFileImport = useCallback((data: IdolAnswer[]) => {
    setAnswers(data);
    setMessage(`成功导入 ${data.length} 条翻牌数据`);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>口袋48 数据助手</h1>
        <nav className="tab-nav">
          <button
            className={activeTab === 'account' ? 'active' : ''}
            onClick={() => setActiveTab('account')}
          >
            账号管理
          </button>
          <button
            className={activeTab === 'query' ? 'active' : ''}
            onClick={() => setActiveTab('query')}
            disabled={answers.length === 0}
          >
            翻牌查询
          </button>
          {/* <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
            disabled={answers.length === 0}
          >
            统计分析
          </button> */}
          <button
            className={activeTab === 'report' ? 'active' : ''}
            onClick={() => setActiveTab('report')}
          >
            年报
          </button>
        </nav>
      </header>

      <main className="app-main">
        {message && <div className="message-bar">{message}</div>}

        {activeTab === 'account' && (
          <section className="account-section">
            <AccountManager
              accounts={accounts}
              currentAccount={currentAccount}
              onAddAccount={addAccount}
              onSwitchAccount={switchAccount}
              onRemoveAccount={removeAccount}
            />
            <div className="data-actions">
              <h4>数据操作</h4>
              <div className="action-buttons">
                <button onClick={handleLoadData} disabled={loading || !currentAccount}>
                  {loading ? '加载中...' : '获取翻牌数据'}
                </button>
                <label className="import-btn">
                  导入数据
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const result = event.target?.result;
                            if (typeof result === 'string') {
                              const data = JSON.parse(result);
                              if (Array.isArray(data)) {
                                handleFileImport(data);
                              }
                            }
                          } catch (error) {
                            console.error('File parse error:', error);
                            setMessage('文件解析失败');
                          }
                        };
                        reader.readAsText(file);
                      }
                    }}
                    hidden
                  />
                </label>
                {answers.length > 0 && (
                  <button onClick={() => {
                    const blob = new Blob([JSON.stringify(answers, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'pocket48_answers.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    导出数据
                  </button>
                )}
              </div>
              {answers.length > 0 && (
                <p className="data-info">已加载 {answers.length} 条翻牌数据</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'query' && (
          <section className="query-section">
            <AnswerQuery answers={answers} />
          </section>
        )}

        {activeTab === 'stats' && (
          <section className="stats-section">
            <StatisticsPanel answers={answers} />
          </section>
        )}

        {activeTab === 'report' && (
          <section className="report-section">
            <YearReport token={currentAccount?.token || ''} />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
