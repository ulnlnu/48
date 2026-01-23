import { useState, useCallback, useEffect } from 'react';
import { AccountManager } from './components/AccountManager';
import { AnswerQuery } from './components/AnswerQuery';
import { StatisticsPanel } from './components/StatisticsPanel';
import { YearReport } from './components/YearReport';
import { ApiTester } from './components/ApiTester';
import { PocketRoom } from './components/PocketRoom';
import { LiveList } from './components/LiveList';
import { PerformanceList } from './components/PerformanceList';
import { JsonConverter } from './components/JsonConverter';
import { useAccount } from './hooks/useAccount';
import { getAllIdolAnswers } from './services/pocket48Api';
import type { IdolAnswer } from './types';
import { ThemeProvider, ThemeSwitcher } from './themes';
import { AIProvider } from './contexts/AIContext';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AIProvider>
        <AppContent />
      </AIProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const {
    accounts,
    currentAccount,
    addAccount,
    removeAccount,
    switchAccount,
    logout,
  } = useAccount();

  const [answers, setAnswers] = useState<IdolAnswer[] | null>(() => {
    try {
      const saved = localStorage.getItem('pocket48_answers');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to load answers from localStorage', e);
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'account' | 'query' | 'stats' | 'report' | 'api' | 'pocket' | 'live' | 'performance' | 'json'>('account');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 监听 answers 变化并保存到 localStorage
  useEffect(() => {
    if (answers && answers.length > 0) {
      try {
        localStorage.setItem('pocket48_answers', JSON.stringify(answers));
      } catch (e) {
        console.error('Failed to save answers to localStorage', e);
        // Use setTimeout to avoid synchronous state update in effect
        setTimeout(() => setMessage('数据量过大，无法保存到本地缓存'), 0);
      }
    }
  }, [answers]);

  // 监听从PocketRoom切换到JSON转换器的事件
  useEffect(() => {
    const handleSwitchToJsonTab = () => {
      setActiveTab('json');
    };
    window.addEventListener('switch-to-json-tab', handleSwitchToJsonTab);
    return () => {
      window.removeEventListener('switch-to-json-tab', handleSwitchToJsonTab);
    };
  }, []);

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
    } catch {
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
        <ThemeSwitcher position="header" />
        <nav className="tab-nav">
          <button
            className={activeTab === 'account' ? 'active' : ''}
            onClick={() => setActiveTab('account')}
          >
            助手主页
          </button>
          <button
            className={activeTab === 'query' ? 'active' : ''}
            onClick={() => setActiveTab('query')}
            disabled={!answers || answers.length === 0}
          >
            翻牌记录
          </button>
          {/* <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
            disabled={!answers || answers.length === 0}
          >
            统计分析
          </button> */}
          {/* <button
            className={activeTab === 'report' ? 'active' : ''}
            onClick={() => setActiveTab('report')}
          >
            年报
          </button> */}
          <button
            className={activeTab === 'api' ? 'active' : ''}
            onClick={() => setActiveTab('api')}
          >
            API测试
          </button>
          <button
            className={activeTab === 'pocket' ? 'active' : ''}
            onClick={() => setActiveTab('pocket')}
          >
            口袋房间
          </button>
          <button
            className={activeTab === 'live' ? 'active' : ''}
            onClick={() => setActiveTab('live')}
          >
            成员直播
          </button>
          <button
            className={activeTab === 'performance' ? 'active' : ''}
            onClick={() => setActiveTab('performance')}
          >
            公演列表
          </button>
          <button
            className={activeTab === 'json' ? 'active' : ''}
            onClick={() => setActiveTab('json')}
          >
            JSON转换器
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
              onLogout={logout}
            />
          </section>
        )}

        {activeTab === 'query' && (
          <section className="query-section">
            <AnswerQuery
              answers={answers || []}
              currentAccount={currentAccount}
              onLoadData={handleLoadData}
              onFileImport={handleFileImport}
              loading={loading}
              message={message}
              setMessage={setMessage}
            />
          </section>
        )}

        {activeTab === 'stats' && (
          <section className="stats-section">
            <StatisticsPanel answers={answers || []} />
          </section>
        )}

        {activeTab === 'report' && (
          <section className="report-section">
            <YearReport 
              token={currentAccount?.token || ''} 
              answers={answers}
              onAnswersLoaded={(data) => {
                setAnswers(data);
                setMessage(`成功加载 ${data.length} 条翻牌数据`);
              }}
            />
          </section>
        )}

        {activeTab === 'api' && (
          <section className="api-section">
            <ApiTester
              currentAccount={currentAccount}
            />
          </section>
        )}

        {activeTab === 'pocket' && (
          <section className="pocket-section">
            <PocketRoom
              currentAccount={currentAccount}
            />
          </section>
        )}

        {activeTab === 'live' && (
          <section className="live-section">
            <LiveList
              currentAccount={currentAccount}
            />
          </section>
        )}

        {activeTab === 'performance' && (
          <section className="performance-section">
            <PerformanceList
              currentAccount={currentAccount}
            />
          </section>
        )}

        {activeTab === 'json' && (
          <section className="json-section">
            <JsonConverter />
          </section>
        )}

      </main>
    </div>
  );
}

export default App;
