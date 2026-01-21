// 口袋48 API 服务
import type { AccountInfo, IdolAnswer, YearReportData, IdolAnswerRaw, UserInfo, Room, Live } from '../types';

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
      return {
        accountId: result.content.id,
        userId: result.content.userId,
        token: result.content.token,
        username: account,
        avatar: result.content.userInfo?.avatar,
      };
    }
    return null;
  } catch (error) {
    console.error('登录失败:', error);
    return null;
  }
}

// 获取翻牌列表 (基础 fetch)
async function fetchIdolAnswerList(
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

// 获取用户年报数据 (聚合生成)
export async function getYearReport(token: string, year: number): Promise<YearReportData | null> {
  try {
    // 1. 获取翻牌数据
    const answers = await getAllIdolAnswers(token);
    
    // 筛选当年的数据
    const yearAnswers = answers.filter(a => {
      const d = new Date(a.qtime * 1000);
      return d.getFullYear() === year;
    });

    // 2. 聚合翻牌统计
    const answerStats = {
      askCount: yearAnswers.length,
      askedIdols: new Set(yearAnswers.map(a => a.idolId)).size,
      answeredCount: yearAnswers.filter(a => a.status === 2).length, // 2: 已翻牌
      answeredIdols: new Set(yearAnswers.filter(a => a.status === 2).map(a => a.idolId)).size,
      cost: yearAnswers.reduce((sum, a) => sum + a.price, 0),
      topIdols: [], // TODO: 计算
      topAnsweredIdols: [] // TODO: 计算
    };

    // 3. 构建基础年报结构 (Live/Room 部分暂时为空，因为获取全量数据太重)
    const report: YearReportData = {
      userId: '',
      year: year,
      overview: {
        totalDays: 0,
        totalMessages: 0,
        totalChars: 0,
        idolsReplied: answerStats.answeredIdols,
        idolsMessaged: 0
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
      answer: {
        ...answerStats,
        topIdols: [],
        topAnsweredIdols: []
      },
      gift: {
        totalCount: 0,
        totalAmount: 0,
        giftTypes: [],
        giftIdols: []
      }
    };

    return report;
  } catch (error) {
    console.error('生成年报失败:', error);
    return null;
  }
}

// 获取用户信息
export async function getUserInfo(token: string): Promise<UserInfo | null> {
  try {
    const response = await fetch(`${API_BASE}/user/api/v1/user/info/home`, { // 修正路径
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({ userId: '' }) // 通常需要userId，但如果不传可能返回自己的？或者从Token解析
    });
    // 如果 /user/info/home 需要 userId，我们可能需要先解析 token 或 stored info
    // 暂且保留原调用方式，但注意路径修正

    const result = await response.json();
    return result.status === 200 && result.success === true ? (result.content as UserInfo) : null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
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
    return result.status === 200 && result.success === true ? (result.content as Room[]) || [] : [];
  } catch (error) {
    console.error('获取房间列表失败:', error);
    return [];
  }
}

// 获取直播列表
export async function getLiveList(token: string, page: number = 1, size: number = 20): Promise<Live[]> {
  try {
    // 使用文档中的路径
    const response = await fetch(`${API_BASE}/live/api/v1/live/getLiveList`, {
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        'AppInfo': JSON.stringify(APP_INFO),
        'token': token,
      },
      body: JSON.stringify({
        groupId: 0,
        debug: true,
        next: (page - 1) * size, // next 通常是 offset
        record: false
      })
    });

    const result = await response.json();
    return result.status === 200 && result.success === true ? (result.content?.liveList as Live[]) || [] : [];
  } catch (error) {
    console.error('获取直播列表失败:', error);
    return [];
  }
}
