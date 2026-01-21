// 账号管理组件
import { useState } from 'react';
import { sendVerificationCode, login } from '../services/pocket48Api';
import type { AccountInfo } from '../types';

interface AccountManagerProps {
  accounts: AccountInfo[];
  currentAccount: AccountInfo | null;
  onAddAccount: (account: AccountInfo) => void;
  onSwitchAccount: (account: AccountInfo) => void;
  onRemoveAccount: (accountId: string) => void;
}

export const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  currentAccount,
  onAddAccount,
  onSwitchAccount,
  onRemoveAccount,
}) => {
  const [loginMode, setLoginMode] = useState<'account' | 'code'>('account');
  const [accountInput, setAccountInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSendCode = async () => {
    if (!accountInput) {
      setMessage('请输入手机号/邮箱');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const success = await sendVerificationCode(accountInput);
      setLoading(false);
      if (success) {
        setLoginMode('code');
        setMessage('验证码已发送');
      } else {
        setMessage('发送验证码失败，请稍后重试');
      }
    } catch (error) {
      setLoading(false);
      setMessage(`发送失败: ${error instanceof Error ? error.message : '网络错误'}`);
    }
  };

  const handleLogin = async () => {
    if (!accountInput || !codeInput) {
      setMessage('请输入完整信息');
      return;
    }
    setLoading(true);
    setMessage('');
    const account = await login(accountInput, codeInput);
    setLoading(false);
    if (account) {
      onAddAccount(account);
      setAccountInput('');
      setCodeInput('');
      setLoginMode('account');
      setMessage('登录成功');
    } else {
      setMessage('登录失败，请检查验证码');
    }
  };

  return (
    <div className="account-manager">
      <h3>账号管理</h3>

      {/* 当前账号显示 */}
      {currentAccount && (
        <div className="current-account">
          <div className="account-info">
            <span className="account-name">{currentAccount.username}</span>
            <span className="account-id">ID: {currentAccount.userId}</span>
          </div>
        </div>
      )}

      {/* 登录表单 */}
      <div className="login-form">
        {loginMode === 'account' ? (
          <>
            <input
              type="text"
              placeholder="手机号/邮箱"
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
            />
            <button onClick={handleSendCode} disabled={loading}>
              {loading ? '发送中...' : '获取验证码'}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="验证码"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              maxLength={6}
            />
            <button onClick={handleLogin} disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
            <button className="secondary" onClick={() => setLoginMode('account')}>
              返回
            </button>
          </>
        )}
        {message && <p className="message">{message}</p>}
      </div>

      {/* 账号列表 */}
      {accounts.length > 1 && (
        <div className="account-list">
          <h4>切换账号</h4>
          {accounts.map((account) => (
            <div
              key={account.accountId}
              className={`account-item ${account.accountId === currentAccount?.accountId ? 'active' : ''}`}
              onClick={() => onSwitchAccount(account)}
            >
              <span>{account.username}</span>
              <button onClick={(e) => {
                e.stopPropagation();
                onRemoveAccount(account.accountId);
              }}>删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
