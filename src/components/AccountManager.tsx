// 账号管理组件 - 水晶胶囊风格
import { useState, useEffect } from 'react';
import { sendVerificationCode, login } from '../services/pocket48Api';
import type { AccountInfo } from '../types';
import { AIManager } from './AIManager';
import './AccountManager.css';

// 用户详细信息接口
interface UserInfoDetail {
  nickName?: string;
  nickname?: string;
  avatar?: string;
  level?: number;
  exp?: number;
  gender?: number;
  birthday?: string;
  money?: number;
  support?: number;
  vip?: boolean;
  badgeCount?: number;
  friends?: number;
  followers?: number;
  [key: string]: unknown;
}

interface AccountManagerProps {
  accounts: AccountInfo[];
  currentAccount: AccountInfo | null;
  onAddAccount: (account: AccountInfo) => void;
  onSwitchAccount: (account: AccountInfo) => void;
  onRemoveAccount: (accountId: string) => void;
  onLogout: () => void;
}

const DEFAULT_AVATAR = 'https://source.48.cn/images/default_avatar.png';

// 头像加载失败缓存
const failedAvatars = new Set<string>();

// 处理头像加载失败，缓存已失败的URL
const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, avatarUrl?: string) => {
  if (avatarUrl && !failedAvatars.has(avatarUrl)) {
    failedAvatars.add(avatarUrl);
  }
  e.currentTarget.src = DEFAULT_AVATAR;
};

// 检查头像URL是否已失败
const getAvatarUrl = (avatarUrl?: string) => {
  if (!avatarUrl || failedAvatars.has(avatarUrl)) {
    return DEFAULT_AVATAR;
  }
  // 处理相对路径，添加完整的域名前缀
  if (avatarUrl.startsWith('/')) {
    return `https://source.48.cn${avatarUrl}`;
  }
  return avatarUrl;
};

export const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  currentAccount,
  onAddAccount,
  onSwitchAccount,
  onRemoveAccount,
  onLogout,
}) => {
  const [loginMode, setLoginMode] = useState<'account' | 'code'>('account');
  const [accountInput, setAccountInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfoDetail | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(false);


  // 获取用户详细信息
  useEffect(() => {
    if (currentAccount?.token) {
      fetchUserInfo(currentAccount.token);
    }
  }, [currentAccount]);

  const fetchUserInfo = async (token: string) => {
    setLoadingUserInfo(true);
    try {
      const response = await fetch('/pocketapi/user/api/v1/user/info/reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'pa': 'MTY5MjY1MzQwODAwMCwyNDExLDIwNzc2MUQxM0E2NjE1MjFCNkE0NkM4QTY4NTVCNjM3LA==',
          'User-Agent': 'PocketFans201807/7.1.0 (iPad; iOS 16.6; Scale/2.00)',
          'Accept-Language': 'zh-Hans-CN;q=1, zh-Hant-TW;q=0.9',
          'Origin': 'https://pocket.48.cn',
          'Referer': 'https://pocket.48.cn/',
          'AppInfo': JSON.stringify({
            vendor: 'Huawei',
            deviceId: 'F2BA149C-06DB-9843-31DE-36BF375E36F2',
            appVersion: '7.1.0',
            appBuild: '23051902',
            osVersion: '16.6.0',
            osType: 'ios',
            deviceName: 'Huawei',
            os: 'ios',
          }),
          'token': token,
        },
        body: JSON.stringify({ from: 'appstart' }),
      });

      const result = await response.json();
      if (result.status === 200 && result.content) {
        setUserInfo(result.content);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setLoadingUserInfo(false);
    }
  };

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
      // 登录成功后获取用户信息
      fetchUserInfo(account.token);
    } else {
      setMessage('登录失败，请检查验证码');
    }
  };

  return (
    <div className="account-manager-crystal">
      {/* 当前账号显示卡片 */}
      {currentAccount && (
        <div className="current-account-card animate-scaleIn">
          <div className="card-glow"></div>
          <div className="account-header">
            <div className="avatar-section">
              {loadingUserInfo ? (
                <div className="avatar-skeleton"></div>
              ) : (
                <img 
                  src={getAvatarUrl(userInfo?.avatar || currentAccount.avatar)}
                  alt="头像"
                  className="user-avatar"
                  onError={(e) => handleAvatarError(e, userInfo?.avatar || currentAccount.avatar)}
                />
              )}
              <div className="level-badge">
                {userInfo?.level || '?'}
              </div>
            </div>
            <div className="account-details">
              <div className="name-row">
                <h3 className="user-nickname">{userInfo?.nickName || userInfo?.nickname || currentAccount.username}</h3>
                <span className="user-phone">
                  {currentAccount.username}
                  {userInfo?.vip && <span className="vip-badge">VIP</span>}
                </span>
              </div>
              <div className="user-stats-inline">
                <p className="user-id">ID: {currentAccount.userId || '加载中...'}</p>
                <div className="user-stats-compact">
                  {userInfo?.money !== undefined && (
                    <span className="stat-item-compact" title="鸡腿">
                      鸡腿 {userInfo.money}
                    </span>
                  )}
                  {userInfo?.support !== undefined && (
                    <span className="stat-item-compact" title="鸡翅">
                      鸡翅 {userInfo.support.toLocaleString()}
                    </span>
                  )}
                  {userInfo?.exp !== undefined && (
                    <span className="stat-item-compact" title="经验值">
                      经验值 {userInfo.exp.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="action-buttons">
            <button className="checkin-btn-purple" onClick={() => console.log('签到API预留')}>
              <span>签到</span>
            </button>
            <button className="logout-btn-purple" onClick={onLogout}>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}

      {/* 登录表单 */}
      {!currentAccount && (
        <div className="login-card crystal-card animate-fadeIn">
          <div className="card-glow"></div>
          <h3 className="card-title">
            <span className="title-icon">🔐</span>
            登录口袋48
          </h3>

          <div className="login-form">
            {loginMode === 'account' ? (
              <>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="手机号/邮箱"
                    value={accountInput}
                    onChange={(e) => setAccountInput(e.target.value)}
                    className="crystal-input"
                  />
                </div>
                <button
                  className="crystal-btn crystal-btn-primary"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="btn-loading">
                      <span className="spinner"></span>
                      发送中...
                    </span>
                  ) : '获取验证码'}
                </button>
              </>
            ) : (
              <>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="验证码"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    maxLength={6}
                    className="crystal-input"
                  />
                </div>
                <div className="button-group">
                  <button
                    className="crystal-btn crystal-btn-primary"
                    onClick={handleLogin}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
                        登录中...
                      </span>
                    ) : '登录'}
                  </button>
                  <button
                    className="crystal-btn crystal-btn-secondary"
                    onClick={() => setLoginMode('account')}
                  >
                    返回
                  </button>
                </div>
              </>
            )}
            {message && (
              <p className={`message ${message.includes('成功') ? 'success' : message.includes('失败') ? 'error' : ''}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 账号列表 */}
      {accounts.length > 1 && currentAccount && (
        <div className="account-list-card crystal-card animate-fadeIn">
          <div className="card-glow"></div>
          <h4 className="list-title">
            <span className="title-icon">👥</span>
            切换账号
          </h4>
          <div className="account-items">
            {accounts.map((account, index) => (
              <div
                key={account.accountId}
                className={`account-item-crystal ${account.accountId === currentAccount?.accountId ? 'active' : ''}`}
                onClick={() => onSwitchAccount(account)}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="account-avatar">
                  <img
                    src={getAvatarUrl(account.avatar)}
                    alt={account.username}
                    onError={(e) => handleAvatarError(e, account.avatar)}
                  />
                </div>
                <div className="account-info-item">
                  <span className="account-username">{account.username}</span>
                  <span className="account-userid">ID: {account.userId}</span>
                </div>
                {account.accountId === currentAccount?.accountId && (
                  <span className="active-badge">当前</span>
                )}
                {account.accountId !== currentAccount?.accountId && (
                  <button
                    className="remove-account-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAccount(account.accountId);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI模型管理 */}
      <AIManager />
    </div>
  );
};
