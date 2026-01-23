import React, { useState, useEffect } from 'react';
import {
  // 用户认证
  verifyToken,
  sendVerificationCode,
  login,
  getUserInfo,
  getUserInfoById,
  // 翻牌数据
  getAllIdolAnswers,
  // 房间列表
  getRoomList,
  getRoomInfo,
  fetchRoomMessages,
  fetchRoomOwnerMessages,
  // 团队
  getTeamRoomInfo,
  fetchTeamMessages,
  fetchTeamOwnerMessages,
  // 直播相关 API
  getLiveList,
  getLiveOne,
  getOpenLiveMessages,
  getOpenLiveOne,
  getOpenLiveList,
  // 成员档案
  getStarArchives,
  getStarHistory,
  getMemberList,
  // 礼物
  getGiftList,
} from '../services/pocket48Api';
import type { AccountInfo } from '../types';
import './ApiTester.css';

interface ApiTesterProps {
  currentAccount: AccountInfo | null;
}

// API信息配置
interface ApiConfig {
  name: string;
  endpoint: string;
  description: string;
  params?: { key: string; label: string; type: 'string' | 'number' | 'boolean'; default?: string; required?: boolean }[];
  needsToken: boolean;
  category: string;
  // 可用性标记
  isAvailable?: boolean;
  // 自定义名称和描述（用户编辑后保存）
  customName?: string;
  customDescription?: string;
}

const API_LIST: ApiConfig[] = [
  // ========== 用户认证与信息 ==========
  {
    name: '发送验证码',
    endpoint: 'POST /user/api/v1/sms/send2',
    description: '向用户手机发送短信验证码',
    params: [{ key: 'mobile', label: '手机号', type: 'string', required: true }],
    needsToken: false,
    category: 'auth',
  },
  {
    name: '验证码登录',
    endpoint: 'POST /user/api/v1/login/app/mobile/code',
    description: '使用短信验证码验证用户',
    params: [
      { key: 'mobile', label: '手机号', type: 'string', required: true },
      { key: 'code', label: '验证码', type: 'string', required: true },
    ],
    needsToken: false,
    category: 'auth',
  },
  {
    name: '验证令牌',
    endpoint: 'POST /user/api/v1/user/info/reload',
    description: '验证token是否有效，返回用户信息',
    params: [{ key: 'from', label: '来源标识', type: 'string', default: 'appstart' }],
    needsToken: true,
    category: 'auth',
  },
  {
    name: '获取用户信息(Home)',
    endpoint: 'POST /user/api/v1/user/info/home',
    description: '获取用户详细信息',
    params: [{ key: 'userId', label: '用户ID', type: 'number', required: true }],
    needsToken: true,
    category: 'auth',
  },
  {
    name: '获取用户信息(Small)',
    endpoint: 'POST /user/api/v1/user/info/home/small',
    description: '获取简略用户信息',
    params: [
      { key: 'userId', label: '用户ID', type: 'number', required: true },
      { key: 'needMuteInfo', label: '需要静音信息', type: 'number', default: '0' },
    ],
    needsToken: true,
    category: 'auth',
  },
  {
    name: '获取当前用户信息',
    endpoint: 'POST /user/api/v1/user/info/reload',
    description: '获取当前登录用户信息（无需userId参数）',
    params: [],
    needsToken: true,
    category: 'auth',
  },

  // ========== 翻牌 API ==========
  {
    name: '获取翻牌列表(分页)',
    endpoint: 'POST /idolanswer/api/idolanswer/v1/user/question/list',
    description: '获取分页的翻牌问答记录',
    params: [
      { key: 'status', label: '状态', type: 'number', default: '0' },
      { key: 'beginLimit', label: '起始偏移', type: 'number', default: '0' },
      { key: 'limit', label: '数量限制', type: 'number', default: '20' },
      { key: 'memberId', label: '成员ID(可选)', type: 'string' },
      { key: 'roomId', label: '房间ID(可选)', type: 'string' },
    ],
    needsToken: true,
    category: 'idol',
  },
  {
    name: '获取所有翻牌记录',
    endpoint: 'POST /idolanswer/.../list (二分查找)',
    description: '使用二分探测+批量获取所有翻牌记录',
    params: [],
    needsToken: true,
    category: 'idol',
  },
  {
    name: '生成年报数据',
    endpoint: '本地函数 generateYearReportFromData',
    description: '从翻牌数据生成年度统计报告',
    params: [{ key: 'year', label: '年份', type: 'number', required: true }],
    needsToken: true,
    category: 'idol',
  },

  // ========== 房间与消息 API ==========
  {
    name: '获取房间列表',
    endpoint: 'POST /im/api/v1/conversation/page',
    description: '获取已关注/会话的房间列表',
    params: [{ key: 'targetType', label: '目标类型', type: 'number', default: '0' }],
    needsToken: true,
    category: 'room',
  },
  {
    name: '获取房间信息',
    endpoint: 'POST /im/api/v1/im/room/info',
    description: '获取特定房间的详细信息',
    params: [
      { key: 'roomId', label: '房间ID', type: 'string', required: true },
      { key: 'targetType', label: '目标类型', type: 'number', default: '0' },
    ],
    needsToken: true,
    category: 'room',
  },
  {
    name: '获取房间所有消息',
    endpoint: 'POST /im/api/v1/chatroom/msg/list/all',
    description: '获取房间的所有消息（分页）',
    params: [
      { key: 'roomId', label: '房间ID', type: 'string', required: true },
      { key: 'nextTime', label: '下一页时间戳', type: 'string', default: '0' },
      { key: 'needTop1Msg', label: '需要置顶消息', type: 'boolean', default: 'true' },
    ],
    needsToken: true,
    category: 'room',
  },
  {
    name: '获取房间主人消息',
    endpoint: 'POST /im/api/v1/chatroom/msg/list/homeowner',
    description: '仅获取房间主人的消息',
    params: [
      { key: 'roomId', label: '房间ID', type: 'string', required: true },
      { key: 'ownerId', label: '主人ID', type: 'string', required: true },
      { key: 'nextTime', label: '下一页时间戳', type: 'string', default: '0' },
      { key: 'needTop1Msg', label: '需要置顶消息', type: 'boolean', default: 'false' },
    ],
    needsToken: true,
    category: 'room',
  },

  // ========== 团队/频道 API ==========
  {
    name: '获取团队房间信息',
    endpoint: 'POST /im/api/v1/im/team/room/info',
    description: '获取团队房间频道信息(serverId等)',
    params: [{ key: 'channelId', label: '频道ID', type: 'string', required: true }],
    needsToken: true,
    category: 'team',
  },
  {
    name: '获取团队所有消息',
    endpoint: 'POST /im/api/v1/team/message/list/all',
    description: '获取团队频道的所有消息',
    params: [
      { key: 'channelId', label: '频道ID', type: 'number', required: true },
      { key: 'serverId', label: '服务器ID', type: 'number', required: true },
      { key: 'nextTime', label: '下一页时间戳', type: 'number', default: '0' },
      { key: 'limit', label: '数量限制', type: 'number', default: '50' },
    ],
    needsToken: true,
    category: 'team',
  },
  {
    name: '获取团队主人消息',
    endpoint: 'POST /im/api/v1/team/message/list/homeowner',
    description: '仅获取团队频道主人的消息',
    params: [
      { key: 'channelId', label: '频道ID', type: 'number', required: true },
      { key: 'serverId', label: '服务器ID', type: 'number', required: true },
      { key: 'nextTime', label: '下一页时间戳', type: 'number', default: '0' },
      { key: 'limit', label: '数量限制', type: 'number', default: '50' },
    ],
    needsToken: true,
    category: 'team',
  },

  // ========== 直播 API ==========
  {
    name: '获取直播列表',
    endpoint: 'POST /live/api/v1/live/getLiveList',
    description: '获取成员直播列表（直播和录播）',
    params: [
      { key: 'next', label: '分页偏移', type: 'number', default: '0' },
      { key: 'record', label: 'true=录播 false=直播', type: 'boolean', default: 'false' },
      { key: 'groupId', label: '团队ID(可选)', type: 'number' },
      { key: 'userId', label: '成员ID(可选)', type: 'number' },
      { key: 'debug', label: '调试模式', type: 'boolean', default: 'true' },
    ],
    needsToken: true,
    category: 'live',
  },
  {
    name: '获取成员房间直播详情',
    endpoint: 'POST /live/api/v1/live/getLiveOne',
    description: '获取单个成员房间直播详情（返回单个流URL）',
    params: [{ key: 'liveId', label: '直播ID', type: 'string', required: true }],
    needsToken: false,
    category: 'live',
  },
  {
    name: '获取公演推送消息',
    endpoint: 'POST /im/api/v1/chatroom/msg/list/aim/type',
    description: '获取公演/官方直播推送通知',
    params: [
      { key: 'ownerId', label: '成员ID', type: 'string', required: true },
      { key: 'nextTime', label: '下一页时间戳', type: 'number', default: '0' },
      { key: 'extMsgType', label: '消息类型', type: 'string', default: 'OPEN_LIVE' },
      { key: 'roomId', label: '房间ID(可选)', type: 'string' },
    ],
    needsToken: true,
    category: 'live',
  },
  {
    name: '获取公演详情(多清晰度)',
    endpoint: 'POST /live/api/v1/live/getOpenLiveOne',
    description: '获取官方公演直播/录播详情（返回标清/高清/超清）',
    params: [{ key: 'liveId', label: '公演ID', type: 'string', required: true }],
    needsToken: true,
    category: 'live',
  },
  {
    name: '获取公演录播列表',
    endpoint: 'POST /live/api/v1/live/getLiveList',
    description: '获取官方团队公演录播列表',
    params: [
      { key: 'groupId', label: '团队ID(必填)', type: 'number', required: true },
      { key: 'record', label: 'true=录播 false=直播', type: 'boolean', default: 'true' },
      { key: 'next', label: '分页偏移', type: 'number', default: '0' },
      { key: 'debug', label: '调试模式', type: 'boolean', default: 'true' },
    ],
    needsToken: false,
    category: 'live',
  },

  // ========== 成员/明星信息 API ==========
  {
    name: '获取成员列表',
    endpoint: 'GET (CDN外部资源)',
    description: '从外部CDN获取完整成员列表用于搜索',
    params: [],
    needsToken: false,
    category: 'member',
  },
  {
    name: '获取成员档案',
    endpoint: 'POST /user/api/v1/user/star/archives',
    description: '获取成员详细信息（头像、团队等）',
    params: [{ key: 'memberId', label: '成员ID', type: 'number', required: true }],
    needsToken: true,
    category: 'member',
  },
  {
    name: '获取成员历史动态',
    endpoint: 'POST /user/api/v1/user/star/history',
    description: '获取成员活动历史/动态',
    params: [
      { key: 'memberId', label: '成员ID', type: 'number', required: true },
      { key: 'limit', label: '数量限制', type: 'number', default: '100' },
      { key: 'lastTime', label: '最后时间戳', type: 'number', default: '0' },
    ],
    needsToken: true,
    category: 'member',
  },

  // ========== 礼物 API ==========
  {
    name: '获取礼物列表',
    endpoint: 'POST /gift/api/v1/gift/list',
    description: '获取成员可赠送的礼物列表',
    params: [
      { key: 'businessCode', label: '业务代码', type: 'number', default: '0' },
      { key: 'memberId', label: '成员ID', type: 'string', required: true },
    ],
    needsToken: true,
    category: 'gift',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  auth: { label: '用户认证', icon: '🔐' },
  idol: { label: '翻牌互动', icon: '💬' },
  room: { label: '房间消息', icon: '🏠' },
  team: { label: '团队频道', icon: '👥' },
  live: { label: '直播公演', icon: '🎬' },
  member: { label: '成员信息', icon: '⭐' },
  gift: { label: '礼物系统', icon: '🎁' },
};

// 本地存储键
const API_CONFIG_STORAGE_KEY = 'pocket48_api_configs';

// 从本地存储加载API配置
const loadStoredApiConfigs = (): Record<string, { customName?: string; customDescription?: string; isAvailable?: boolean }> => {
  try {
    const stored = localStorage.getItem(API_CONFIG_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load API configs:', e);
  }
  return {};
};

// 保存API配置到本地存储
const saveApiConfig = (endpoint: string, config: { customName?: string; customDescription?: string; isAvailable?: boolean }) => {
  try {
    const stored = loadStoredApiConfigs();
    stored[endpoint] = config;
    localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.error('Failed to save API config:', e);
  }
};

export const ApiTester: React.FC<ApiTesterProps> = ({ currentAccount }) => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeApi, setActiveApi] = useState<string>('');
  const [paramModal, setParamModal] = useState<{
    open: boolean;
    api: ApiConfig | null;
    handler: ((params: Record<string, string | number | boolean | undefined>) => Promise<unknown>) | null;
  }>({ open: false, api: null, handler: null });

  // API配置编辑状态
  const [storedConfigs, setStoredConfigs] = useState<Record<string, { customName?: string; customDescription?: string; isAvailable?: boolean }>>({});
  const [editingApi, setEditingApi] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvailable, setEditAvailable] = useState(false);

  // 加载存储的API配置
  useEffect(() => {
    const configs = loadStoredApiConfigs();
    setStoredConfigs(configs);
  }, []);

  // 开始编辑API
  const startEditing = (api: ApiConfig) => {
    const config = storedConfigs[api.endpoint] || {};
    setEditingApi(api.endpoint);
    setEditName(config.customName || api.name);
    setEditDescription(config.customDescription || api.description);
    setEditAvailable(config.isAvailable ?? false);
  };

  // 保存编辑
  const saveEdit = (api: ApiConfig) => {
    const newConfig: { customName?: string; customDescription?: string; isAvailable?: boolean } = {
      isAvailable: editAvailable,
    };
    if (editName !== api.name) {
      newConfig.customName = editName;
    }
    if (editDescription !== api.description) {
      newConfig.customDescription = editDescription;
    }
    saveApiConfig(api.endpoint, newConfig);

    // 更新本地状态
    setStoredConfigs(prev => ({
      ...prev,
      [api.endpoint]: newConfig,
    }));
    setEditingApi(null);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingApi(null);
    setEditName('');
    setEditDescription('');
    setEditAvailable(false);
  };

  // 获取显示的名称和描述
  const getDisplayName = (api: ApiConfig) => {
    return storedConfigs[api.endpoint]?.customName || api.name;
  };

  const getDisplayDescription = (api: ApiConfig) => {
    return storedConfigs[api.endpoint]?.customDescription || api.description;
  };

  const isAvailable = (api: ApiConfig) => {
    return storedConfigs[api.endpoint]?.isAvailable ?? false;
  };

  // 根据分类分组API
  const groupedApis = API_LIST.reduce<Record<string, ApiConfig[]>>((acc, api) => {
    if (!acc[api.category]) acc[api.category] = [];
    acc[api.category].push(api);
    return acc;
  }, {});

  const openParamModal = (api: ApiConfig, handler: (params: Record<string, string | number | boolean | undefined>) => Promise<unknown>) => {
    // 如果不需要参数，直接调用
    if (api.params?.length === 0) {
      handler({});
      return;
    }
    setParamModal({ open: true, api, handler });
  };

  const executeWithParams = async (params: Record<string, string | number | boolean | undefined>) => {
    if (!paramModal.handler || !paramModal.api) return;

    // 验证必填参数
    const requiredParams = paramModal.api.params?.filter(p => p.required) || [];
    for (const p of requiredParams) {
      if (!params[p.key] || params[p.key] === '') {
        setResult(`错误: 缺少必填参数 "${p.label}"`);
        setParamModal({ open: false, api: null, handler: null });
        return;
      }
    }

    setParamModal({ open: false, api: null, handler: null });

    // 检查token要求
    if (paramModal.api.needsToken && !currentAccount) {
      setResult('请先登录账号');
      return;
    }

    setLoading(true);
    setActiveApi(paramModal.api!.name);
    setResult('正在请求...');

    try {
      const data = await paramModal.handler!(params);

      // 验证响应数据
      const responseStr = JSON.stringify(data, null, 2);

      // 检查是否返回了有效数据
      const hasValidData = data !== null && data !== undefined &&
        !(typeof data === 'object' && Object.keys(data).length === 0);

      if (hasValidData) {
        // 自动标记为可用（如果用户没手动编辑过）
        const apiEndpoint = paramModal.api!.endpoint;
        if (!storedConfigs[apiEndpoint]) {
          saveApiConfig(apiEndpoint, { isAvailable: true });
          setStoredConfigs(prev => ({
            ...prev,
            [apiEndpoint]: { isAvailable: true },
          }));
        }
        setResult(responseStr);
      } else {
        setResult(responseStr || '空响应');
      }
    } catch (error) {
      setResult(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
      // 标记为不可用
      const apiEndpoint = paramModal.api!.endpoint;
      if (!storedConfigs[apiEndpoint]) {
        saveApiConfig(apiEndpoint, { isAvailable: false });
        setStoredConfigs(prev => ({
          ...prev,
          [apiEndpoint]: { isAvailable: false },
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="api-tester">
        <h3>API 测试</h3>
        <p className="error-message">请先在账号管理页登录</p>
      </div>
    );
  }

  return (
    <div className="api-tester">
      <h3>API 测试面板</h3>

      <div className="user-info-card">
        <h4>当前上下文</h4>
        <div className="info-row">
          <span className="label">用户ID:</span>
          <span className="value highlight">{currentAccount.userId}</span>
        </div>
        <div className="info-row">
          <span className="label">用户名:</span>
          <span className="value">{currentAccount.username}</span>
        </div>
        <div className="info-row">
          <span className="label">Token:</span>
          <span className="value token" title={currentAccount.token}>
            {currentAccount.token.substring(0, 10)}...{currentAccount.token.substring(currentAccount.token.length - 10)}
          </span>
        </div>
      </div>

      {/* 按分类显示API */}
      {Object.entries(groupedApis).map(([category, apis]) => (
        <div key={category} className="api-category">
          <h4 className="category-title">
            <span className="category-icon">{CATEGORY_LABELS[category]?.icon}</span>
            {CATEGORY_LABELS[category]?.label}
            <span className="api-count">({apis.length})</span>
          </h4>
          <div className="api-grid">
            {apis.map((api, index) => (
              <div key={`${api.endpoint}-${index}`} className={`api-card ${editingApi === api.endpoint ? 'editing' : ''} ${isAvailable(api) ? 'available' : ''}`}>
                {/* 编辑模式 */}
                {editingApi === api.endpoint ? (
                  <>
                    <input
                      type="text"
                      className="api-name-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="API名称"
                    />
                    <span className="api-tag">{api.endpoint}</span>
                    <textarea
                      className="api-desc-input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="API描述"
                      rows={2}
                    />
                    <label className="availability-checkbox">
                      <input
                        type="checkbox"
                        checked={editAvailable}
                        onChange={(e) => setEditAvailable(e.target.checked)}
                      />
                      <span>经测试可用</span>
                    </label>
                    <div className="edit-actions">
                      <button
                        className="save-btn"
                        onClick={() => saveEdit(api)}
                      >
                        保存
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={cancelEdit}
                      >
                        取消
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="api-card-header">
                      <h5 className="api-name">{getDisplayName(api)}</h5>
                      <button
                        className="edit-icon-btn"
                        onClick={() => startEditing(api)}
                        title="编辑名称和描述"
                      >
                        ✏️
                      </button>
                    </div>
                    <span className="api-tag">{api.endpoint}</span>
                    <p className="api-desc">{getDisplayDescription(api)}</p>
                    {api.needsToken && <span className="token-badge">需要Token</span>}
                    {isAvailable(api) && <span className="available-badge">✓ 可用</span>}

                    <button
                      className="test-btn"
                      onClick={() => {
                    let handler: ((params: Record<string, string | number | boolean | undefined>) => Promise<unknown>) | null = null;

                    // 根据API名称匹配对应的处理函数
                    switch (api.name) {
                      case '发送验证码':
                        handler = async (p) => sendVerificationCode(p.mobile as string);
                        break;
                      case '验证码登录':
                        handler = async (p) => login(p.mobile as string, p.code as string);
                        break;
                      case '验证令牌':
                        handler = async () => verifyToken(currentAccount.token);
                        break;
                      case '获取用户信息(Home)':
                        handler = async (p) => getUserInfo(currentAccount.token, String(p.userId));
                        break;
                      case '获取用户信息(Small)':
                        handler = async (p) => getUserInfoById(currentAccount.token, String(p.userId));
                        break;
                      case '获取当前用户信息':
                        handler = async () => {
                          // 使用POST方法，GET方法返回404
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
                              'token': currentAccount.token,
                            },
                            body: JSON.stringify({ from: 'appstart' }),
                          });
                          return await response.json();
                        };
                        break;
                      case '获取翻牌列表(分页)':
                        handler = async (p) => {
                          const { fetchIdolAnswerList } = await import('../services/pocket48Api');
                          return fetchIdolAnswerList(
                            currentAccount.token,
                            Number(p.beginLimit) || 0,
                            Number(p.limit) || 20,
                            p.roomId as string
                          );
                        };
                        break;
                      case '获取所有翻牌记录':
                        handler = async () => getAllIdolAnswers(currentAccount.token);
                        break;
                      case '生成年报数据':
                        handler = async (p) => {
                          const answers = await getAllIdolAnswers(currentAccount.token);
                          const { generateYearReportFromData } = await import('../services/pocket48Api');
                          return generateYearReportFromData(answers, Number(p.year) || new Date().getFullYear());
                        };
                        break;
                      case '获取房间列表':
                        handler = async () => getRoomList(currentAccount.token);
                        break;
                      case '获取房间信息':
                        handler = async (p) => getRoomInfo(currentAccount.token, p.roomId as string);
                        break;
                      case '获取房间所有消息':
                        handler = async (p) => fetchRoomMessages(currentAccount.token, p.roomId as string, p.nextTime as string);
                        break;
                      case '获取房间主人消息':
                        handler = async (p) => fetchRoomOwnerMessages(currentAccount.token, p.roomId as string, p.ownerId as string, p.nextTime as string);
                        break;
                      case '获取团队房间信息':
                        handler = async (p) => getTeamRoomInfo(currentAccount.token, p.channelId as string);
                        break;
                      case '获取团队所有消息':
                        handler = async (p) => fetchTeamMessages(currentAccount.token, String(p.channelId), String(p.serverId), p.nextTime as string | number);
                        break;
                      case '获取团队主人消息':
                        handler = async (p) => fetchTeamOwnerMessages(currentAccount.token, String(p.channelId), String(p.serverId), p.nextTime as string | number);
                        break;
                      case '获取直播列表':
                        handler = async (p) => getLiveList(currentAccount.token, {
                          next: p.next as number | undefined,
                          record: p.record === 'true' || p.record === true,
                          groupId: p.groupId as number | undefined,
                          userId: p.userId as number | undefined,
                        });
                        break;
                      case '获取成员房间直播详情':
                        handler = async (p) => getLiveOne(p.liveId as string);
                        break;
                      case '获取公演推送消息':
                        handler = async (p) => getOpenLiveMessages(currentAccount.token, p.ownerId as string, Number(p.nextTime) || 0);
                        break;
                      case '获取公演详情(多清晰度)':
                        handler = async (p) => getOpenLiveOne(currentAccount.token, p.liveId as string);
                        break;
                      case '获取公演录播列表':
                        handler = async (p) => getOpenLiveList(
                          Number(p.groupId),
                          p.record !== 'false',
                          Number(p.next) || 0
                        );
                        break;
                      case '获取成员列表':
                        handler = async () => getMemberList();
                        break;
                      case '获取成员档案':
                        handler = async (p) => getStarArchives(currentAccount.token, Number(p.memberId));
                        break;
                      case '获取成员历史动态':
                        handler = async (p) => getStarHistory(currentAccount.token, Number(p.memberId), Number(p.limit) || 100, Number(p.lastTime) || 0);
                        break;
                      case '获取礼物列表':
                        handler = async (p) => getGiftList(currentAccount.token, p.memberId as string);
                        break;
                    }

                    if (handler) {
                      openParamModal(api, handler);
                    }
                  }}
                  disabled={loading}
                >
                  测试
                </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 参数输入弹窗 */}
      {paramModal.open && paramModal.api && (
        <div className="param-modal-overlay" onClick={() => setParamModal({ open: false, api: null, handler: null })}>
          <div className="param-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>输入参数 - {paramModal.api.name}</h4>
              <button className="close-btn" onClick={() => setParamModal({ open: false, api: null, handler: null })}>×</button>
            </div>
            <div className="modal-body">
              <p className="api-endpoint">{paramModal.api.endpoint}</p>
              <p className="api-description">{paramModal.api.description}</p>

              {paramModal.api.params && paramModal.api.params.length > 0 ? (
                paramModal.api.params.map((param) => (
                  <div key={param.key} className="form-group">
                    <label>
                      {param.label}
                      {param.required && <span className="required">*</span>}
                    </label>
                    <input
                      type={param.type === 'number' ? 'number' : param.type === 'boolean' ? 'text' : 'text'}
                      placeholder={param.default ? `默认值: ${param.default}` : `请输入${param.label}`}
                      defaultValue={param.default || ''}
                      data-param={param.key}
                    />
                  </div>
                ))
              ) : (
                <p className="no-params">此API无需参数</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setParamModal({ open: false, api: null, handler: null })}>取消</button>
              <button
                className="submit-btn"
                onClick={() => {
                  const params: Record<string, string | number | boolean | undefined> = {};
                  const inputs = document.querySelectorAll('[data-param]') as NodeListOf<HTMLInputElement>;
                  inputs.forEach((input) => {
                    const key = input.dataset.param || '';
                    const paramDef = paramModal.api?.params?.find(p => p.key === key);
                    if (paramDef) {
                      if (paramDef.type === 'number') {
                        params[key] = input.value ? Number(input.value) : undefined;
                      } else if (paramDef.type === 'boolean') {
                        params[key] = input.value;
                      } else {
                        params[key] = input.value;
                      }
                    }
                  });
                  executeWithParams(params);
                }}
              >
                发送请求
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 响应结果区域 */}
      <div className="result-area">
        <h4>
          响应结果
          {activeApi && <span className="tag">{activeApi}</span>}
          {loading && <span className="loading-spinner">请求中...</span>}
        </h4>
        <pre className="json-viewer">{result || '点击上方API按钮测试...'}</pre>
      </div>
    </div>
  );
};
