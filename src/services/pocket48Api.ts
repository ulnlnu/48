// 口袋48 API 服务
import type { AccountInfo, IdolAnswer, YearReportData, IdolAnswerRaw, UserInfo, Room, RoomMessageResponse, OpenLiveMessage } from '../types';

// 使用代理时的基础路径
const API_BASE = '/pocketapi';

// 默认请求头
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json;charset=utf-8',
  'Accept': '*/*',
  'Connection': 'keep-alive',
  'pa': 'MTY5MjY1MzQwODAwMCwyNDExLDIwNzc2MUQxM0E2NjE1MjFCNkE0NkM4QTY4NTVCNjM3LA==',
  'User-Agent': 'PocketFans201807/7.1.0 (iPad; iOS 16.6; Scale/2.00)',
  'Accept-Language': 'zh-Hans-CN;q=1, zh-Hant-TW;q=0.9',
  'Origin': 'https://pocket.48.cn',
  'Referer': 'https://pocket.48.cn/',
};

// AppInfo 信息
const APP_INFO = {
  vendor: 'Huawei',
  deviceId: 'F2BA149C-06DB-9843-31DE-36BF375E36F2',
  appVersion: '7.1.0',
  appBuild: '23051902',
  osVersion: '16.6.0',
  osType: 'ios',
  deviceName: 'Huawei',
  os: 'ios',
};

// 验证码相关
export async function sendVerificationCode(account: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/sms/send2`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
      },
      body: JSON.stringify({
        area: '86',
        mobile: account,
      }),
    });

    const result = await response.json();
    return result.status === 200 && result.success === true;
  } catch (error) {
    console.error('发送验证码失败:', error);
    return false;
  }
}

// 登录
export async function login(account: string, code: string): Promise<AccountInfo | null> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/login/app/mobile/code`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
      },
      body: JSON.stringify({
        code,
        mobile: account,
      }),
    });
    const result = await response.json();

    if (result.status === 200 && result.success === true && result.content) {
      console.log('登录成功，返回数据:', result.content);
      const userInfo = result.content.userInfo || {};
      // 处理头像URL：如果有相对路径则补全
      let avatarUrl = userInfo.avatar || userInfo.infoAvatar || '';
      if (avatarUrl && !avatarUrl.startsWith('http')) {
        avatarUrl = `https://source.48.cn${avatarUrl}`;
      }
      return {
        accountId: String(result.content.id || userInfo.userId), // 优先用外层id，没有则用userInfo.userId
        userId: String(userInfo.userId), // 修正：userId 在 userInfo 对象里！
        token: result.content.token,
        username: account,
        avatar: avatarUrl,
        nickname: userInfo.nickName || userInfo.nickname,
        level: userInfo.level,
        vip: userInfo.vip,
      };
    }
    return null;
  } catch (error) {
    console.error('登录失败:', error);
    return null;
  }
}

// 获取翻牌列表 (基础 fetch)
export async function fetchIdolAnswerList(
  token: string,
  beginLimit: number,
  limit: number,
  roomId?: string
): Promise<{ status: number; content: IdolAnswerRaw[]; message?: string }> {
  try {
    const body: {
      status: number;
      beginLimit: number;
      memberId: string;
      limit: number;
      roomId?: string;
    } = {
      status: 0,
      beginLimit: beginLimit,
      memberId: '',
      limit: limit
    };
    if (roomId) {
      body.roomId = roomId;
    }

    const response = await fetch(`${API_BASE}/idolanswer/api/idolanswer/v1/user/question/list`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify(body),
    });

    return await response.json();
  } catch (error) {
    console.error('获取翻牌列表失败:', error);
    return { status: 500, content: [], message: String(error) };
  }
}

// 探测翻牌总数 (二分法)
async function probeTotalCount(token: string): Promise<number> {
  let beginLimit = 1;
  let getCount = 0;
  let getCountState = 0; // 0: 指数增长, 1: 二分查找, 2: 完成
  let getCount_Upper = 0;
  let getCount_Lower = 0;
  let requestCount = 0;
  const maxRequests = 100;

  console.log('开始探测翻牌总数...');

  while (getCountState !== 2 && requestCount < maxRequests) {
    requestCount++;
    const result = await fetchIdolAnswerList(token, beginLimit, 1);

    if (result.status === 200) {
      const hasData = result.content && result.content.length > 0;
      
      if (getCountState === 0) {
        // 阶段1: 指数探测
        if (!hasData) {
          if (beginLimit === 1) {
            getCount = 0;
            getCountState = 2; // 一条都没有
          } else {
            getCountState = 1;
            getCount_Upper = beginLimit;
            getCount_Lower = Math.floor(beginLimit / 2);
            beginLimit = Math.floor((getCount_Lower + getCount_Upper) / 2);
          }
        } else {
          beginLimit *= 2;
        }
      } else if (getCountState === 1) {
        // 阶段2: 二分精确查找
        if (!hasData) {
          getCount_Upper = beginLimit - 1;
        } else {
          getCount_Lower = beginLimit;
        }

        beginLimit = Math.floor((getCount_Lower + getCount_Upper) / 2);

        if (getCount_Upper - getCount_Lower <= 1) {
          // 范围足够小，确认边界
          const upperResult = await fetchIdolAnswerList(token, getCount_Upper, 1);
          if (upperResult.status === 200 && upperResult.content && upperResult.content.length > 0) {
            getCount = getCount_Upper;
          } else {
            getCount = getCount_Lower;
          }
          getCountState = 2;
        }
      }
    } else {
      console.error('探测请求失败:', result.message);
      break;
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 200)); 
  }

  console.log(`探测完成，总数约为: ${getCount}`);
  return getCount;
}

// 获取所有翻牌数据 (使用二分探测 + 批量获取)
export async function getAllIdolAnswers(token: string): Promise<IdolAnswer[]> {
  // 1. 探测总数
  const totalCount = await probeTotalCount(token);
  if (totalCount === 0) return [];

  const allAnswers: IdolAnswer[] = [];
  let beginLimit = 0;
  const size = 20; // 每次获取20条，避免API限制

  // 2. 批量获取
  // 使用 totalCount 作为循环终止条件之一，确保取完所有数据
  while (allAnswers.length < totalCount) {
    const result = await fetchIdolAnswerList(token, beginLimit, size);
    if (result.status === 200 && result.content && result.content.length > 0) {
      const items = result.content.map(mapToIdolAnswer);
      allAnswers.push(...items);
      
      // 如果获取到的数据少于请求的数量，说明是最后一页了
      if (items.length < size) break;
      
      beginLimit += size;
    } else {
      break;
    }
    
    // 简单的防速率限制
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allAnswers;
}

// 辅助函数：映射原始数据到 IdolAnswer 类型
function mapToIdolAnswer(item: IdolAnswerRaw): IdolAnswer {
  const baseUserInfo = item.baseUserInfo || {};
  
  // 用户信息
  const userName = String(item.userName ?? '未知用户');
  const userAvatar = item.headImgUrl ? `https://source.48.cn${item.headImgUrl}` : '';
  
  // 偶像信息 - 多重回退策略
  let idolName = baseUserInfo.nickname;
  let idolAvatar = baseUserInfo.avatar;
  
  // 策略1: 检查 item.idolName (部分接口可能直接返回)
  if (!idolName && item['idolName']) {
    idolName = String(item['idolName']);
  }
  
  // 策略2: 从 roomName 解析 (例如 "SNH48 某某某的房间")
  if (!idolName && item.roomName) {
    const parts = item.roomName.replace(/的房间$/, '').split(' ');
    idolName = parts.length > 0 ? parts[parts.length - 1] : item.roomName;
  }
  
  // 策略3: 确保不为 undefined
  idolName = String(idolName ?? '未知成员');

  // 处理头像 URL
  if (idolAvatar) {
    idolAvatar = `https://source.48.cn${idolAvatar}`;
  } else if (item['idolAvatar']) {
    idolAvatar = `https://source.48.cn${item['idolAvatar']}`;
  } else {
    idolAvatar = '';
  }

  // 偶像ID - 确保用于统计的 ID 存在
  let idolId = String(item.idolId ?? '');
  // 如果没有 ID 但有名字，使用名字作为临时 ID，确保统计和筛选能正常分组
  if ((!idolId || idolId === '0') && idolName !== '未知成员') {
    idolId = idolName;
  }

  return {
    answerId: String(item.answerId ?? ''),
    questionId: String(item.questionId ?? ''),
    content: String(item.content ?? ''),
    qtime: Number(item.qtime ?? 0) / 1000, // 转换为秒
    answerTime: Number(item.answerTime ?? 0) / 1000,
    roomId: String(item.roomId ?? ''),
    roomName: String(item.roomName ?? ''),
    userId: String(item.userId ?? ''),
    userName: userName,
    userAvatar: userAvatar,
    idolId: idolId,
    idolName: idolName,
    idolAvatar: idolAvatar,
    price: Number(item.cost ?? item.price ?? 0),
    status: Number(item.status ?? 0),
    type: Number(item.answerType ?? item.type ?? 0),
    expand: item.expand ? String(item.expand) : undefined,
    answerContent: item.answerContent ? String(item.answerContent) : undefined,
  };
}

// 从已有数据生成年报
export function generateYearReportFromData(answers: IdolAnswer[], year: number): YearReportData {
  // 筛选当年的数据
  const yearAnswers = answers.filter(a => {
    const d = new Date(a.qtime * 1000);
    return d.getFullYear() === year;
  });

  // 聚合翻牌统计
  // 偶像提问统计
  const idolStats = new Map<string, { name: string; count: number }>();
  const answeredIdolStats = new Map<string, { name: string; count: number }>();
  const monthlyStats = new Array(12).fill(0);
  const hourlyStats = new Array(24).fill(0);

  yearAnswers.forEach(a => {
    // 偶像提问数
    const idolKey = a.idolId || a.idolName;
    const current = idolStats.get(idolKey) || { name: a.idolName, count: 0 };
    current.count++;
    idolStats.set(idolKey, current);

    // 被回复统计
    if (a.status === 2) {
      const answeredCurrent = answeredIdolStats.get(idolKey) || { name: a.idolName, count: 0 };
      answeredCurrent.count++;
      answeredIdolStats.set(idolKey, answeredCurrent);
    }

    // 时间分布
    const d = new Date(a.qtime * 1000);
    monthlyStats[d.getMonth()]++;
    hourlyStats[d.getHours()]++;
  });

  // 排序 Top 列表
  const topIdols = Array.from(idolStats.entries())
    .map(([id, val]) => ({ idolId: id, name: val.name, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topAnsweredIdols = Array.from(answeredIdolStats.entries())
    .map(([id, val]) => ({ idolId: id, name: val.name, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const answerStats = {
    askCount: yearAnswers.length,
    askedIdols: idolStats.size,
    answeredCount: yearAnswers.filter(a => a.status === 2).length,
    answeredIdols: answeredIdolStats.size,
    cost: yearAnswers.reduce((sum, a) => sum + a.price, 0),
    topIdols,
    topAnsweredIdols,
    monthlyStats,
    hourlyStats
  };

  // 构建基础年报结构
  return {
    userId: '',
    year: year,
    overview: {
      totalDays: new Set(yearAnswers.map(a => new Date(a.qtime * 1000).toDateString())).size,
      totalMessages: yearAnswers.length,
      totalChars: yearAnswers.reduce((sum, a) => sum + (a.content ? a.content.length : 0), 0),
      idolsReplied: answerStats.answeredIdols,
      idolsMessaged: answerStats.askedIdols
    },
    live: {
      watchCount: 0,
      watchDays: 0,
      danmakuCount: 0,
      danmakuDays: 0,
      danmakuKeywords: [],
      giftCount: 0,
      giftDays: 0,
      giftAmount: 0,
      scoreCount: 0,
      topLiveIdols: [],
      topGiftLive: [],
      danmakuMonthly: [],
      danmakuHourly: []
    },
    room: {
      messageCount: 0,
      messageDays: 0,
      replyCount: 0,
      replyDays: 0,
      topIdols: [],
      messageMonthly: [],
      messageHourly: []
    },
    answer: answerStats,
    gift: {
      totalCount: 0,
      totalAmount: 0,
      giftTypes: [],
      giftIdols: []
    }
  };
}

// 获取用户年报数据 (聚合生成)
export async function getYearReport(token: string, year: number): Promise<YearReportData | null> {
  try {
    // 1. 获取翻牌数据
    const answers = await getAllIdolAnswers(token);
    
    // 2. 使用公共方法生成
    return generateYearReportFromData(answers, year);
  } catch (error) {
    console.error('生成年报失败:', error);
    return null;
  }
}

// 获取用户信息
export async function getUserInfo(token: string, userId: string): Promise<UserInfo | null> {
  try {
    if (!userId || userId === 'undefined') {
      console.warn('[API] getUserInfo aborted: Invalid userId', userId);
      return null;
    }

    console.log(`[API] getUserInfo called for userId: ${userId}`);
    const response = await fetch(`${API_BASE}/user/api/v1/user/info/home`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      // 尝试传数字类型的 userId
      body: JSON.stringify({ userId: Number(userId) })
    });

    const result = await response.json();
    console.log('[API] getUserInfo result:', result);
    
    if (result.status !== 200 || result.success !== true) {
      console.warn('[API] getUserInfo failed with result:', result);
      return null;
    }

    return result.content as UserInfo;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

// 根据ID获取简略用户信息 (user/api/v1/user/info/home/small)
export async function getUserInfoById(token: string, userId: string): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/user/info/home/small`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        needMuteInfo: 0,
        userId: Number(userId)
      })
    });

    const result = await response.json();
    if (result.status === 200 && result.success === true) {
      return result.content;
    }
    return result;
  } catch (error) {
    console.error(`获取用户(${userId})信息失败:`, error);
    return { error: String(error) };
  }
}

// 获取房间列表
export async function getRoomList(token: string): Promise<Room[]> {
  try {
    // 使用文档中的路径
    const response = await fetch(`${API_BASE}/im/api/v1/conversation/page`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ targetType: 0 })
    });

    const result = await response.json();
    console.log('getRoomList 返回:', result);
    if (result.status === 200 && result.success === true) {
      // content.roomId 是房间数组
      const content = result.content as { roomId?: Room[] };
      return (content.roomId as Room[]) || [];
    } else {
      console.warn('获取房间列表失败:', result.message || result);
      return [];
    }
  } catch (error) {
    console.error('获取房间列表失败:', error);
    return [];
  }
}

// 获取房间信息
export async function getRoomInfo(token: string, roomId: string): Promise<Room | null> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/im/room/info`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ roomId, targetType: 0 })
    });

    const result = await response.json();
    if (result.status === 200 && result.success === true && result.content) {
      return result.content as Room;
    }
    return null;
  } catch (error) {
    console.error(`获取房间(${roomId})信息失败:`, error);
    return null;
  }
}

// ==================== 成员房间直播 API ====================

/**
 * 获取成员直播/录播列表
 * POST /live/api/v1/live/getLiveList
 * @param token 用户token
 * @param options 选项
 * @param options.next 分页偏移量 (首次传0)
 * @param options.record false=获取正在直播, true=获取录播
 * @param options.groupId 团队ID (0=全部团队, 10=SNH48, 11=BEJ48, 12=GNZ48, 14=CKG48, 21=CGT48)
 * @param options.userId 指定成员ID (获取特定成员的录播)
 */
export async function getLiveList(
  token: string,
  options: {
    next?: number | string;
    record?: boolean;
    groupId?: number;
    userId?: number;
  } = {}
): Promise<{
  status: number;
  success?: boolean;
  content?: {
    liveList: Array<{
      liveId: string;
      title: string;
      coverPath: string;
      ctime: string;
      roomId: string;
      liveType: number;
      userInfo?: {
        userId: string;
        nickName: string;
        avatar: string;
      };
      [key: string]: unknown;
    }>;
    next: string;
  };
}> {
  try {
    const response = await fetch(`${API_BASE}/live/api/v1/live/getLiveList`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        debug: true,
        next: options.next ?? 0,
        record: options.record ?? false,
        ...(options.groupId !== undefined && { groupId: options.groupId }),
        ...(options.userId !== undefined && { userId: options.userId }),
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('获取成员直播列表失败:', error);
    return { status: 500, content: { liveList: [], next: '0' } };
  }
}

// 获取房间消息列表 (用于统计)
export async function fetchRoomMessages(
  token: string, 
  roomId: string, 
  nextTime: string = '0'
): Promise<{ status: number; content: RoomMessageResponse | null; }> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/chatroom/msg/list/all`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        needTop1Msg: true,
        roomId: roomId,
        nextTime: nextTime
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`获取房间(${roomId})消息失败:`, error);
    return { status: 500, content: null };
  }
}

// 获取房间主人发言
export async function fetchRoomOwnerMessages(
  token: string,
  roomId: string,
  ownerId: string,
  nextTime: string = '0'
): Promise<{ status: number; content: RoomMessageResponse | null; }> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/chatroom/msg/list/homeowner`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        needTop1Msg: false,
        roomId: roomId,
        ownerId: ownerId,
        nextTime: nextTime
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`获取房间(${roomId})主人(${ownerId})消息失败:`, error);
    return { status: 500, content: null };
  }
}

// 获取Team房间信息 (参数 id 即 conversation/page 返回的 ownerId)
export async function getTeamRoomInfo(token: string, id: string): Promise<{ serverId: string; channelInfo: Record<string, unknown> } | null> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/im/team/room/info`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ channelId: id })  // API 字段名是 channelId，但值是 id (ownerId)
    });

    const result = await response.json();
    console.log('getTeamRoomInfo 返回:', result);

    // serverId 在 content.channelInfo.serverId
    if (result.content && result.content.channelInfo && result.content.channelInfo.serverId !== undefined) {
      return {
        serverId: String(result.content.channelInfo.serverId),
        channelInfo: result.content.channelInfo
      };
    }
    return null;
  } catch (error) {
    console.error(`获取Team房间(${id})信息失败:`, error);
    return null;
  }
}

// 获取Team消息列表 (fetch-room-messages with fetchAll=true)
export async function fetchTeamMessages(
  token: string,
  channelId: string,
  serverId: string,
  nextTime: string | number = 0
): Promise<{ status: number; content: RoomMessageResponse | null; }> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/team/message/list/all`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        channelId: parseInt(channelId),
        serverId: parseInt(serverId),
        nextTime: nextTime,
        limit: 50
      })
    });
    const result = await response.json();
    console.log('fetchTeamMessages 返回:', result);
    // 打印前3条消息的 extInfo 作为示例
    if (result.content?.message) {
      result.content.message.slice(0, 3).forEach((msg: Record<string, unknown>, idx: number) => {
        console.log(`消息${idx + 1} extInfo:`, msg.extInfo);
      });
    }
    return result;
  } catch (error) {
    console.error(`获取Team房间(${channelId})消息失败:`, error);
    return { status: 500, content: null };
  }
}

// 获取Team屋主消息列表 (fetch-room-messages with fetchAll=false)
export async function fetchTeamOwnerMessages(
  token: string,
  channelId: string,
  serverId: string,
  nextTime: string | number = 0
): Promise<{ status: number; content: RoomMessageResponse | null; }> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/team/message/list/homeowner`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        channelId: parseInt(channelId),
        serverId: parseInt(serverId),
        nextTime: nextTime,
        limit: 50
      })
    });
    return await response.json();
  } catch (error) {
    console.error(`获取Team房间(${channelId})屋主消息失败:`, error);
    return { status: 500, content: null };
  }
}

/**
 * 获取礼物列表
 * @param token 用户Token
 * @param memberId 成员ID (默认 63559)
 */
export async function getGiftList(token: string, memberId: string | number): Promise<unknown> {
  try {
    console.log('[getGiftList] 请求参数:', { token: token ? '***' : 'missing', memberId });
    const response = await fetch(`${API_BASE}/gift/api/v1/gift/list`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token
      },
      body: JSON.stringify({
        businessCode: 0,
        memberId: typeof memberId === 'number' ? memberId : parseInt(memberId, 10)
      })
    });

    const result = await response.json();
    console.log('[getGiftList] 响应结果:', result);
    return result;
  } catch (error) {
    console.error('获取礼物列表失败:', error);
    return { status: 500, success: false, message: String(error) };
  }
}

// ==================== yaya_msg API (新版 API) ====================

/**
 * 验证 Token 有效性
 * POST https://pocketapi.48.cn/user/api/v1/user/info/reload
 */
export async function verifyToken(token: string): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/user/info/reload`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ from: 'appstart' }),
    });
    return await response.json();
  } catch (error) {
    console.error('验证Token失败:', error);
    return { success: false, message: String(error) };
  }
}

/**
 * 获取成员档案
 * POST https://pocketapi.48.cn/user/api/v1/user/star/archives
 */
export async function getStarArchives(token: string, memberId: number): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/user/star/archives`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ memberId }),
    });
    return await response.json();
  } catch (error) {
    console.error('获取成员档案失败:', error);
    return { success: false, message: String(error) };
  }
}

/**
 * 获取成员历史动态
 * POST https://pocketapi.48.cn/user/api/v1/user/star/history
 */
export async function getStarHistory(token: string, memberId: number, limit: number = 100, lastTime: number = 0): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/user/star/history`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ memberId, limit, lastTime }),
    });
    return await response.json();
  } catch (error) {
    console.error('获取成员历史失败:', error);
    return { success: false, message: String(error) };
  }
}

/**
 * 获取直播推送消息
 * POST https://pocketapi.48.cn/im/api/v1/chatroom/msg/list/aim/type
 */
export async function getOpenLiveMessages(token: string, memberId: string, nextTime: number = 0): Promise<{ status: number; content: { message?: OpenLiveMessage[]; nextTime?: number } | null; }> {
  try {
    const response = await fetch(`${API_BASE}/im/api/v1/chatroom/msg/list/aim/type`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        extMsgType: 'OPEN_LIVE',
        roomId: '',
        ownerId: String(memberId),
        nextTime,
      }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('获取直播推送失败:', error);
    return { status: 500, content: null };
  }
}

/**
 * 公演流清晰度类型
 */
export type PlayStreamName = '标清' | '高清' | '超清';

/**
 * 公演流信息
 */
export interface PlayStream {
  streamName: PlayStreamName;
  streamPath?: string;
  streamType: 1 | 2 | 3;
  vipShow: boolean;
  logonPicture?: string;
}

/**
 * 获取单条公演直播/录播信息（含多清晰度流）
 * POST https://pocketapi.48.cn/live/api/v1/live/getOpenLiveOne
 * @param token 用户token
 * @param liveId 公演ID
 */
export async function getOpenLiveOne(token: string, liveId: string): Promise<{
  status: number;
  success?: boolean;
  content?: {
    liveId: string;
    title: string;
    coverPath?: string;
    roomId?: string;
    status: number;
    playNum?: string;
    stime: string;
    playStreams: PlayStream[];
    subTitle?: string;
    endTime?: string;
    [key: string]: unknown;
  } | null;
}> {
  try {
    const response = await fetch(`${API_BASE}/live/api/v1/live/getOpenLiveOne`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ liveId: String(liveId) }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('获取公演详情失败:', error);
    return { status: 500, content: null };
  }
}

// 成员列表项类型
export interface MemberListItem {
  id: number;
  ownerName: string;
  serverId: string;
  channelId: string;
  roomId: string;  // conversation/page 的 targetId
  team?: string;
}

// 获取成员列表（用于搜索成员）
export async function getMemberList(): Promise<MemberListItem[]> {
  try {
    const response = await fetch('https://fastly.jsdelivr.net/gh/yk1z/yaya_msg@master/members.json');
    const rawData = await response.json();

    // yaya_msg 的 members.json 结构是 { roomId: [...] }
    const data = rawData.roomId || [];

    if (Array.isArray(data)) {
      console.log('getMemberList 返回成员数:', data.length);
      return data;
    }
    return [];
  } catch (error) {
    console.error('获取成员列表失败:', error);
    return [];
  }
}

// ==================== 公演录播下载 API ====================

/**
 * 公演录播信息
 */
export interface OpenLiveInfo {
  liveId: string;
  title: string;
  subTitle: string;
  coverPath: string;
  stime: string;        // 开始时间戳
  status?: number;      // 1=未开始 2=直播中
  liveType?: number;
}

/**
 * 获取公演录播列表
 * POST https://pocketapi.48.cn/live/api/v1/live/getLiveList
 * @param groupId 团队ID (10=SNH48, 11=BEJ48, 12=GNZ48, 14=CKG48, 21=CGT48)
 * @param record true=录播 false=直播
 * @param next 分页偏移量
 */
export async function getOpenLiveList(groupId: number, record: boolean = true, next: number = 0): Promise<{
  status: number;
  success?: boolean;
  content?: {
    liveList: OpenLiveInfo[];
    next?: number;
  };
}> {
  try {
    const response = await fetch(`${API_BASE}/live/api/v1/live/getLiveList`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
      },
      body: JSON.stringify({
        groupId,
        record,
        next,
        debug: true
      }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('获取公演录播列表失败:', error);
    return { status: 500, content: { liveList: [] } };
  }
}

// ==================== 成员房间直播 API ====================

/**
 * 成员房间直播信息
 */
export interface RoomLiveInfo {
  content?: {
    liveId: string;
    roomId: string;
    playStreamPath: string;    // 单个流地址
    msgFilePath: string;
    title: string;
    ctime: string;
    [key: string]: unknown;
  };
}

/**
 * 获取成员房间直播详情（用于成员口袋房间直播/录播）
 * POST https://pocketapi.48.cn/live/api/v1/live/getLiveOne
 * @param liveId 直播ID
 */
export async function getLiveOne(liveId: string): Promise<RoomLiveInfo> {
  try {
    const response = await fetch(`${API_BASE}/live/api/v1/live/getLiveOne`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
      },
      body: JSON.stringify({ liveId }),
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('获取成员房间直播详情失败:', error);
    return { content: undefined };
  }
}

/**
 * 下载文件内容（用于下载 m3u8 文件）
 * @param url 文件URL
 */
export async function downloadM3u8File(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error('下载 m3u8 文件失败:', error);
    throw error;
  }
}

// 团队ID映射
export const TEAM_IDS: Record<string, number> = {
  'snh48': 10,
  'bej48': 11,
  'gnz48': 12,
  'ckg48': 14,
  'cgt48': 21,
};
