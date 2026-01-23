// AI功能组件 - 包含消息分析、筛选、总结等功能
import { useState } from 'react';
import type { RoomOwnerMessage, IdolAnswer } from '../types';
import { useAI, callAIAPI } from '../contexts/AIContext';
import './AIFeatures.css';

// 发言人类型
export type SpeakerType = 'all' | 'owner' | 'user';

// 消息筛选条件接口
export interface MessageAnalysisFilter {
  startTime: string;
  endTime: string;
  speaker: string;
  speakerType: SpeakerType;
  keyword: string;
  msgType: string;
  minLength?: number;
  excludeKeywords?: string;
}

// Prompt 预设接口
export interface PromptPreset {
  id: string;
  name: string;
  description: string;
  category: 'owner' | 'user' | 'general';
  prompt: string;
  isBuiltIn: boolean;
}

// GLM 模型预设配置
const GLM_CONFIGS = [
  { id: 'glm-4-flash', name: 'GLM-4-Flash (快速)', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', description: '速度快，适合简单分析' },
  { id: 'glm-4-plus', name: 'GLM-4-Plus (增强)', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', description: '能力强，适合深度分析' },
  { id: 'glm-4-air', name: 'GLM-4-Air (轻量)', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', description: '性价比高，适合日常使用' },
  { id: 'glm-4', name: 'GLM-4 (标准)', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', description: '标准模型，均衡性能' },
];

// 获取 GLM 配置的辅助函数
const getGLMConfig = (modelId: string) => GLM_CONFIGS.find(c => c.id === modelId);

// 内置 Prompt 预设
const BUILTIN_PRESETS: PromptPreset[] = [
  {
    id: 'owner-daily-summary',
    name: '房主今日总结',
    description: '总结房主今日发言内容、活动和心情',
    category: 'owner',
    isBuiltIn: true,
    prompt: `请分析以下房间主人"{ownerName}"的发言记录，生成今日总结报告。

房主: {ownerName}
房间: {channelName}
消息数量: {count}
时间范围: {timeRange}

请按以下结构输出分析：

## 📝 今日发言总结
- 总结房主今日的主要发言内容
- 提取重要信息和公告

## 🎯 今日活动
- 列出房主提到的活动安排
- 标记重要时间点

## 💭 今日心情
- 根据发言内容分析房主今日心情
- 提取表达情感的语句

## ⏰ 发言时间分布
- 分析房主的发言时间段
- 总结活跃时间规律

消息内容：
{messages}

请用中文回答，使用markdown格式，保持简洁温暖。`
  },
  {
    id: 'owner-activity-summary',
    name: '房主活动总结',
    description: '总结房主近期的活动和行程',
    category: 'owner',
    isBuiltIn: true,
    prompt: `请分析以下房间主人"{ownerName}"的发言记录，生成活动总结报告。

房主: {ownerName}
房间: {channelName}
消息数量: {count}
时间范围: {timeRange}

请按以下结构输出分析：

## 📅 近期活动总览
- 列出所有提到的活动和行程
- 按时间顺序整理

## 🎪 重要活动详情
- 详细说明重要活动的信息
- 包括时间、地点、内容等

## 📊 活动类型分析
- 统计不同类型活动的数量
- 分析活动分布特点

消息内容：
{messages}

请用中文回答，使用markdown格式，保持简洁清晰。`
  },
  {
    id: 'owner-mood-analysis',
    name: '房主心情分析',
    description: '分析房主近期的情绪变化和心情状态',
    category: 'owner',
    isBuiltIn: true,
    prompt: `请分析以下房间主人"{ownerName}"的发言记录，生成心情分析报告。

房主: {ownerName}
房间: {channelName}
消息数量: {count}
时间范围: {timeRange}

请按以下结构输出分析：

## 💖 整体心情状态
- 分析房主在这段时间的整体心情
- 描述主要情绪基调

## 📈 心情变化趋势
- 按时间顺序分析心情变化
- 标记心情转折点

## 🎭 情感关键词
- 提取表达情感的词汇和语句
- 统计积极/中性/消极情绪比例

## 💭 值得关注的发言
- 列出表达强烈情感的发言
- 分析背后的心情状态

消息内容：
{messages}

请用中文回答，使用markdown格式，保持细腻温暖。`
  },
  {
    id: 'user-topic-analysis',
    name: '用户话题分析',
    description: '分析用户发言的主要话题和讨论内容',
    category: 'user',
    isBuiltIn: true,
    prompt: `请分析以下房间的用户发言记录，生成话题分析报告。

房间: {channelName}
房主: {ownerName}
消息数量: {count}
时间范围: {timeRange}

请按以下结构输出分析：

## 💬 热门话题
- 总结用户讨论的主要话题
- 按热度排序

## 👥 活跃用户
- 列出发言最活跃的用户
- 统计发言次数

## 🎯 互动特点
- 分析用户发言的特点
- 总结互动模式

消息内容：
{messages}

请用中文回答，使用markdown格式，保持简洁客观。`
  },
  {
    id: 'huxiaohui-daily',
    name: '📰包间小报',
    description: '总结包间今日消息、活动和心情',
    category: 'owner',
    isBuiltIn: true,
    prompt: `请分析以下房间消息，生成日常总结报告，受众为胡晓慧核心粉丝（煲仔饭），阅读时长控制在5分钟，语言亲切自然，拒绝浮夸幼稚表达。
**核心人设锚定要求**：
1.突出胡晓慧的多重昵称及人设标签：虎塑、小鸭子塑（说话声音像小鸭），常用昵称小包/胡小包/小包包/胡小会/小虎；粉丝专属称呼陛下，她是口袋48房间（包间）的主人，是包国的陛下；
2.在报告中不要只使用一种昵称，要根据上下文和情感自然切换使用不同昵称，避免使用户感到困惑。  
3.强化“喜欢分享美食、胃口很好”“碳水女王”的饮食特点；
4.体现“遇到困难会对着镜子自我鼓励、持续传递积极向上正能量”的暖心特质；
5.所有人设相关内容需贴合发言真实细节，不编造脑补情节，粉丝称呼可自然融入报告表述中。
6.合理使用🐯🍞👜🦆等贴合人设的emoji，融入报告中
**报告结构要求**：
1.必需包含**包间小报**板块，板块逻辑连贯。对于可选板块，需要在阅读完messages后选择性加载。
2.若需要加载可选的板块，要按照prompt中给出各板块的顺序，在报告中添加相关板块，顺序为：**特别之日**、**包间大事**、**包间小报**、**舌尖上的包间**、**包间趣闻**、**小虎心情**。
3.若遇到了特殊纪念日或出现了特殊事件或活动，需在**今日活动**板块前添加**特别之日**、**包间大事**板块详细说明，突出其重要性和影响。
4.篇幅在5分钟左右，每个板块的字数在200-300字之间，拒绝浮夸幼稚表述。
5.必须以**今日之星**板块结尾，送上一句对胡晓慧的夸奖和鼓励，以及对未来的期盼。
以下是板块说明：
## 📅特别之日（可选）
- 检查统计的时间是否包含重要纪念日，如生日、出道周年纪念日等。
- 胡晓慧的重要纪念日有：1998年9月16日（生日），2015年12月4日（出道日），可根据{timeRange}判断是否有其他重要纪念日，并计算时间。
- 也可以检查节日，如12月25日（圣诞节）、1月1日（元旦）等，附上对胡晓慧和对粉丝的节日问候和祝福。
## 🔈包间大事（可选）
- 汇总发言中提到的特殊事件、活动，分点罗列，突出其重要性和影响。
## 📝包间小报（必需）
- 按时间线梳理发言中提及的行程细节、待办事项，分点罗列，足够详细。
- 突出排练、公演等工作日常，以及休闲时段的安排。
## 🍚舌尖上的包间（必需）
- 汇总发言中提到的美食、零食内容。
- 结合“胃口好”的特点，还原分享时的语气状态。
## 😸包间趣闻（可选）
- 汇总发言中提到的有趣事件、话题、经历，分点罗列。
- 语言风格贴合粉丝向，避免官方化表述。
## 💖小虎心情（必需）
- 分析房主在这段时间的整体心情。
- 描述主要情绪基调，结合正能量特质展开。
- 可自然使用“陛下”“小包”等粉丝常用称呼，增强亲切感。
- 模仿粉丝语气对小包心情做出回应，比如一起开心，安慰、鼓励、夸奖等。
## 📈心情走向（可选）
- 按时间顺序分析心情变化，结合上下文分析可能的原因。
- 标记心情转折点，若有低谷需关联“自我鼓励”的人设细节。
- 体现心情与日常行程、美食分享的关联。
## 🔑关键词（可选）
- 提取多次出现的、引发讨论的消息，分析事情的起因、影响、结果等。
- 标注带有虎塑、小鸭塑特质的语气词或表述，以及粉丝专属称呼相关的互动表述。
## 💭陛下圣旨（可选）
- 列出表达强烈情感的发言。
- 分析背后的心情状态，结合粉丝熟悉的“陛下”“小包”等语境解读。
## ⭐今日之星（必需）
- 送上一句对胡晓慧的夸奖和鼓励，以及对未来越来越好的期盼。

消息内容：
{messages}

请用中文回答，使用markdown格式，保持细腻温暖、平易近人、幽默风趣的粉丝向风格，符合核心粉丝的阅读习惯。`
},
  {
    id: 'general-comprehensive',
    name: '综合分析报告',
    description: '全面分析房间的所有消息数据',
    category: 'general',
    isBuiltIn: true,
    prompt: `请分析以下口袋48房间"{channelName}"的消息记录，生成综合分析报告。

房主: {ownerName}
消息数量: {count}
时间范围: {timeRange}

请按以下结构输出分析：

## 📊 消息概览
- 消息时间范围
- 消息总数
- 消息类型分布

## 💬 主要话题
- 总结讨论的主要话题
- 提取关键事件或活动

## 👥 活跃用户
- 列出最活跃的用户
- 统计发言次数

## 🎯 重点内容
- 提取值得注意的消息
- 标记重要信息

## 📈 趋势分析
- 消息活跃度趋势
- 用户参与度分析

消息内容：
{messages}

请用中文回答，使用markdown格式，保持简洁专业。`
  }
];

// 分析结果接口
export interface AnalysisResult {
  summary: string;
  stats: {
    totalMessages: number;
    filteredMessages: number;
    timeRange: string;
    topSpeakers: Array<{ name: string; count: number }>;
    messageTypes: Array<{ type: string; count: number }>;
  };
  timestamp: number;
}

// 筛选信息接口
export interface FilterInfo {
  startTime?: string;
  endTime?: string;
  speaker?: string;
  keyword?: string;
  msgType?: string;
  filterLivePush?: boolean;
  showOwnerRepliesOnly?: boolean;
  totalCount: number;
  filteredCount: number;
}

interface AIFeaturesProps {
  messages?: RoomOwnerMessage[];
  filteredMessages?: RoomOwnerMessage[]; // 从PocketRoom传入的已筛选消息
  filterInfo?: FilterInfo; // 筛选信息
  channelId?: string;
  channelName?: string;
  ownerName?: string;
  ownerId?: number; // 新增：房主ID，用于更准确的筛选
  // 新增：支持翻牌数据
  answers?: IdolAnswer[];
  answersType?: 'query' | 'report';
}

export const AIFeatures: React.FC<AIFeaturesProps> = ({
  messages,
  filteredMessages,
  filterInfo,
  channelName,
  ownerName,
  ownerId,
  answers,
  answersType = 'query'
}) => {
  const { apiKey, apiEndpoint, model, setApiKey, setApiEndpoint, setModel, saveSettings } = useAI();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'analysis' | 'settings' | 'answers'>('summary');
  const [filter, setFilter] = useState<MessageAnalysisFilter>({
    startTime: '',
    endTime: '',
    speaker: '',
    speakerType: 'all',
    keyword: '',
    msgType: 'all',
    minLength: undefined,
    excludeKeywords: '',
  });
  const [tempFilter, setTempFilter] = useState<MessageAnalysisFilter>(filter);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Prompt 预设状态
  const [selectedPreset, setSelectedPreset] = useState<string>('general-comprehensive');
  const [customPresets, setCustomPresets] = useState<PromptPreset[]>(() => {
    // 从 localStorage 加载自定义预设
    try {
      const saved = localStorage.getItem('ai_custom_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 保存自定义预设到 localStorage
  const saveCustomPresets = (presets: PromptPreset[]) => {
    setCustomPresets(presets);
    localStorage.setItem('ai_custom_presets', JSON.stringify(presets));
  };

  // 新增/编辑自定义预设状态
  const [editingPreset, setEditingPreset] = useState<PromptPreset | null>(null);
  const [showPresetEditor, setShowPresetEditor] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [newPromptPrompt, setNewPromptPrompt] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<'owner' | 'user' | 'general'>('general');

  // 翻牌分析状态
  const [answersAnalysisResult, setAnswersAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingAnswers, setIsAnalyzingAnswers] = useState(false);

  // 获取所有预设（内置+自定义）
  const allPresets = [...BUILTIN_PRESETS, ...customPresets];

  // 获取当前选中的预设
  const currentPreset = allPresets.find(p => p.id === selectedPreset) || allPresets[0];

  // 应用筛选条件
  const applyFilter = (): RoomOwnerMessage[] => {
    console.log('[AI筛选] 开始应用筛选条件');
    console.log('[AI筛选] 总消息数:', messages?.length || 0);
    console.log('[AI筛选] 房主ID:', ownerId, '房主名称:', ownerName);
    console.log('[AI筛选] 筛选条件:', filter);

    if (!messages) return [];
    const filtered = messages.filter((msg, index) => {
      // 时间范围筛选
      if (filter.startTime && msg.msgTime < new Date(filter.startTime).getTime()) {
        return false;
      }
      if (filter.endTime && msg.msgTime > new Date(filter.endTime).getTime()) {
        return false;
      }

      // 发言人类型筛选（房主/用户）
      if (filter.speakerType !== 'all') {
        const extInfo = tryParseExtInfo(msg.extInfo);
        const msgOwnerId = extInfo?.user?.ownerId;
        const speakerName = extInfo?.user?.nickName || extInfo?.user?.nickname || '';

        // 优先使用 ownerId 进行比较（参考小偶像按钮的筛选逻辑）
        let isOwner = false;
        if (ownerId != null && msgOwnerId != null) {
          isOwner = String(msgOwnerId) === String(ownerId);
        } else if (ownerName) {
          isOwner = speakerName === ownerName;
        }

        // 🔍 调试输出（仅输出前3条）
        if (index < 3) {
          console.log(`[AI筛选] 消息${index + 1}:`, {
            speakerName,
            msgOwnerId,
            ownerId,
            isOwner,
            speakerType: filter.speakerType,
          });
        }

        if (filter.speakerType === 'owner' && !isOwner) {
          return false;
        }
        if (filter.speakerType === 'user' && isOwner) {
          return false;
        }
      }

      // 发言人筛选
      if (filter.speaker) {
        const extInfo = tryParseExtInfo(msg.extInfo);
        const speaker = extInfo?.user?.nickName || extInfo?.user?.nickname || '';
        if (!speaker.toLowerCase().includes(filter.speaker.toLowerCase())) {
          return false;
        }
      }

      // 关键词筛选
      if (filter.keyword && !msg.bodys.toLowerCase().includes(filter.keyword.toLowerCase())) {
        return false;
      }

      // 消息类型筛选
      if (filter.msgType !== 'all' && msg.msgType !== filter.msgType) {
        return false;
      }

      // 最小长度筛选
      if (filter.minLength && msg.bodys.length < filter.minLength) {
        return false;
      }

      // 排除关键词
      if (filter.excludeKeywords) {
        const excludeList = filter.excludeKeywords.split(',').map(k => k.trim().toLowerCase());
        if (excludeList.some(k => msg.bodys.toLowerCase().includes(k))) {
          return false;
        }
      }

      return true;
    });

    console.log('[AI筛选] 筛选后消息数:', filtered.length);
    return filtered;
  };

  // 获取筛选后的房主消息
  const getOwnerMessages = (): RoomOwnerMessage[] => {
    if (!messages) return [];
    console.log('[AI-房主筛选] 开始筛选房主消息');
    console.log('[AI-房主筛选] 房主ID:', ownerId, '房主名称:', ownerName);

    const ownerMsgs = messages.filter((msg, index) => {
      const extInfo = tryParseExtInfo(msg.extInfo);
      const msgOwnerId = extInfo?.user?.ownerId;

      // 优先使用 ownerId 进行比较（参考小偶像按钮的筛选逻辑）
      let isOwner = false;
      if (ownerId != null && msgOwnerId != null) {
        isOwner = String(msgOwnerId) === String(ownerId);
      } else if (ownerName) {
        const speakerName = extInfo?.user?.nickName || extInfo?.user?.nickname || '';
        isOwner = speakerName === ownerName;
      }

      // 🔍 调试输出（仅输出前3条）
      if (index < 3) {
        console.log(`[AI-房主筛选] 消息${index + 1}:`, {
          speakerName: extInfo?.user?.nickName || extInfo?.user?.nickname || '',
          msgOwnerId,
          ownerId,
          isOwner,
        });
      }

      return isOwner;
    });

    console.log('[AI-房主筛选] 房主消息数:', ownerMsgs.length);
    return ownerMsgs;
  };

  // 获取筛选后的用户消息
  const getUserMessages = (): RoomOwnerMessage[] => {
    if (!messages) return [];
    console.log('[AI-用户筛选] 开始筛选用户消息');

    const userMsgs = messages.filter((msg) => {
      const extInfo = tryParseExtInfo(msg.extInfo);
      const msgOwnerId = extInfo?.user?.ownerId;

      // 优先使用 ownerId 进行比较（参考小偶像按钮的筛选逻辑）
      let isOwner = false;
      if (ownerId != null && msgOwnerId != null) {
        isOwner = String(msgOwnerId) === String(ownerId);
      } else if (ownerName) {
        const speakerName = extInfo?.user?.nickName || extInfo?.user?.nickname || '';
        isOwner = speakerName === ownerName;
      }

      return !isOwner;
    });

    console.log('[AI-用户筛选] 用户消息数:', userMsgs.length);
    return userMsgs;
  };

  // 导出JSON
  const exportJSON = (data: RoomOwnerMessage[], filename: string) => {
    const exportData = data.map(msg => {
      const extInfo = tryParseExtInfo(msg.extInfo);
      return {
        msgIdServer: msg.msgIdServer,
        msgIdClient: msg.msgIdClient,
        msgTime: msg.msgTime,
        msgTimeFormatted: new Date(msg.msgTime).toLocaleString('zh-CN'),
        msgType: msg.msgType,
        bodys: msg.bodys,
        privacy: msg.privacy,
        speaker: {
          userId: extInfo?.user?.userId,
          nickName: extInfo?.user?.nickName || extInfo?.user?.nickname,
          avatar: extInfo?.user?.avatar,
          ownerId: extInfo?.user?.ownerId,
        }
      };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导出筛选后的消息
  const exportFilteredMessages = () => {
    // 优先使用从PocketRoom传入的已筛选消息，如果没有则使用内部筛选
    const filtered = filteredMessages ?? applyFilter();
    if (filtered.length === 0) {
      alert('没有可导出的消息');
      return;
    }
    const filename = `${channelName || 'room'}_filtered_${filtered.length}条`;
    exportJSON(filtered, filename);
  };

  // 导出房主消息
  const exportOwnerMessages = () => {
    const ownerMsgs = getOwnerMessages();
    if (ownerMsgs.length === 0) {
      alert('没有房主消息可导出');
      return;
    }
    const filename = `${channelName || 'room'}_owner_${ownerMsgs.length}条`;
    exportJSON(ownerMsgs, filename);
  };

  // 导出用户消息
  const exportUserMessages = () => {
    const userMsgs = getUserMessages();
    if (userMsgs.length === 0) {
      alert('没有用户消息可导出');
      return;
    }
    const filename = `${channelName || 'room'}_users_${userMsgs.length}条`;
    exportJSON(userMsgs, filename);
  };

  // 导出AI分析报告
  const exportReport = (content: string, presetName: string, timeRange?: string) => {
    const reportContent = `# ${presetName}\n\n房间: ${channelName || '未知'}\n房主: ${ownerName || '未知'}\n生成时间: ${new Date().toLocaleString('zh-CN')}\n\n---\n\n${content}`;
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // 使用时间范围作为文件名的一部分
    const timeRangeStr = timeRange ? `_${timeRange.replace(/\s*-\s*/g, '_to_')}` : '';
    a.download = `${channelName || 'room'}_${presetName}${timeRangeStr}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 使用选中的Prompt预设执行分析
  const performAnalysisWithPreset = async () => {
    if (!apiKey) {
      alert('请先在 AI 模型管理中配置 API Key');
      return;
    }

    // 使用从PocketRoom传入的已筛选消息，如果没有则使用原始消息并应用内部筛选
    const messagesToUse = filteredMessages ?? messages;
    if (!messagesToUse || messagesToUse.length === 0) {
      alert('没有可分析的消息数据');
      return;
    }

    // 🔍 调试：显示筛选信息
    console.log('[AI分析] 开始执行智能总结');
    console.log('[AI分析] 总消息数:', messages?.length || 0);
    console.log('[AI分析] 筛选后消息数:', messagesToUse.length);
    if (filterInfo) {
      console.log('[AI分析] 当前筛选条件:', {
        时间范围: filterInfo.startTime && filterInfo.endTime ? `${filterInfo.startTime} ~ ${filterInfo.endTime}` : '未设置',
        发言人: filterInfo.speaker || '未设置',
        关键词: filterInfo.keyword || '未设置',
        消息类型: filterInfo.msgType || '全部',
        隐藏直播: filterInfo.filterLivePush ? '是' : '否',
        仅房主: filterInfo.showOwnerRepliesOnly ? '是' : '否',
      });
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // 准备消息数据（发送全部筛选结果）
      const messagesToAnalyze = messagesToUse;
      console.log('[AI分析] 实际分析消息数:', messagesToAnalyze.length);

      const messagesText = messagesToAnalyze.map(msg => {
        const extInfo = tryParseExtInfo(msg.extInfo);
        const speaker = extInfo?.user?.nickName || extInfo?.user?.nickname || '未知用户';
        const time = new Date(msg.msgTime).toLocaleString('zh-CN');

        let content = '';
        let mediaInfo = '';

        // 处理不同类型的消息
        if (msg.msgType === 'TEXT') {
          content = msg.bodys || '';
        } else if (msg.msgType === 'IMAGE' || msg.msgType === 'PICTURE') {
          // 图片消息 - 包含URL以便AI理解图像
          let imageUrl = '';
          try {
            const bodysData = JSON.parse(msg.bodys || '{}');
            imageUrl = bodysData.url || msg.url || '';
          } catch {
            imageUrl = msg.url || '';
          }
          content = '[图片]';
          if (imageUrl) {
            mediaInfo = ` 图片URL: ${imageUrl}`;
          }
        } else if (msg.msgType === 'VIDEO') {
          // 视频消息
          let videoUrl = '';
          try {
            const bodysData = JSON.parse(msg.bodys || '{}');
            videoUrl = bodysData.url || msg.url || '';
          } catch {
            videoUrl = msg.url || '';
          }
          content = '[视频]';
          if (videoUrl) {
            mediaInfo = ` 视频URL: ${videoUrl}`;
          }
        } else if (msg.msgType === 'VOICE' || msg.msgType === 'AUDIO') {
          // 语音消息
          let voiceUrl = '';
          let duration = '';
          try {
            const bodysData = JSON.parse(msg.bodys || '{}');
            voiceUrl = bodysData.url || msg.url || '';
            duration = bodysData.dur ? ` (${Math.round(bodysData.dur / 1000)}秒)` : '';
          } catch {
            voiceUrl = msg.url || '';
          }
          content = `[语音${duration}]`;
          if (voiceUrl) {
            mediaInfo = ` 语音URL: ${voiceUrl}`;
          }
        } else {
          // 其他类型消息
          content = `[${msg.msgType}]`;
          if (msg.bodys && msg.msgType !== 'TEXT') {
            try {
              const bodysData = JSON.parse(msg.bodys);
              if (bodysData.url) {
                mediaInfo = ` URL: ${bodysData.url}`;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }

        // 组合消息内容，包含媒体URL
        const fullContent = content + mediaInfo;
        return `[${time}] ${speaker}: ${fullContent}`;
      }).join('\n');

      // 🔍 打印发送给AI的消息（前10条预览）
      console.log('[AI分析] 发送给AI的消息预览（前10条）:');
      messagesText.split('\n').slice(0, 10).forEach((line, idx) => {
        console.log(`  [${idx + 1}] ${line}`);
      });
      if (messagesToAnalyze.length > 10) {
        console.log(`  ... 共 ${messagesToAnalyze.length} 条消息`);
      }

      // 计算时间范围
      const timeRange = messagesToUse.length > 0
        ? `${new Date(Math.min(...messagesToUse.map(m => m.msgTime))).toLocaleDateString('zh-CN')} - ${new Date(Math.max(...messagesToUse.map(m => m.msgTime))).toLocaleDateString('zh-CN')}`
        : '未知';

      console.log('[AI分析] 时间范围:', timeRange);
      console.log('[AI分析] 使用的Prompt预设:', currentPreset.name);

      // 使用选中的预设
      const prompt = currentPreset.prompt
        .replace('{ownerName}', ownerName || '未知')
        .replace('{channelName}', channelName || '未知')
        .replace('{count}', String(messagesToUse.length))
        .replace('{timeRange}', timeRange)
        .replace('{messages}', messagesText);

      // 使用 AIContext 的调用函数
      const summary = await callAIAPI(
        apiKey,
        apiEndpoint,
        model,
        [
          {
            role: 'system',
            content: '你是一个专业的数据分析助手，擅长总结和分析社交平台的聊天记录。请用中文回答，保持简洁、客观、有价值。'
          },
          { role: 'user', content: prompt }
        ],
        2500,
        0.7
      );

      // 计算统计信息
      const stats = calculateStats(messagesToUse);

      console.log('[AI分析] 分析完成');
      console.log('[AI分析] 统计信息:', stats);

      setAnalysisResult({
        summary,
        stats,
        timestamp: Date.now(),
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('🔴 AI 分析失败:', error);

      // 构建更友好的错误显示
      const errorOutput = [
        `## ❌ AI 分析失败`,
        ``,
        errorMessage,
        ``,
        `### 🔧 调试检查清单`,
        `- [ ] 打开浏览器开发者工具 (F12) → Console 标签页查看详细日志`,
        `- [ ] 检查 API Key 是否正确配置`,
        `- [ ] 检查 API Key 是否有效（未过期、有足够余额）`,
        `- [ ] 检查 API 端点地址是否正确`,
        `- [ ] 检查模型名称是否正确`,
        ``,
        `### 💡 常见问题`,
        `**GLM API Key 格式错误**`,
        `> GLM API Key 应包含前缀，格式为: \`id.secret\``,
        `> 示例: \`1234567890.abcdef1234567890abcdef1234567890abcdef\``,
        ``,
        `**CORS 跨域问题**`,
        `> 如果看到网络错误，可能是 API 不支持浏览器直接调用`,
        `> 请检查浏览器的 Console 中是否有 CORS 相关错误信息`,
        ``,
        `**网络连接问题**`,
        `> 请确保网络连接正常`,
        `> 某些 API 可能需要代理才能访问`,
      ].join('\n');

      setAnalysisResult({
        summary: errorOutput,
        stats: {
          totalMessages: messages?.length ?? 0,
          filteredMessages: applyFilter().length,
          timeRange: '分析失败',
          topSpeakers: [],
          messageTypes: [],
        },
        timestamp: Date.now(),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 计算统计信息
  const calculateStats = (filteredMessages: RoomOwnerMessage[]) => {
    const speakerCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    let minTime = Infinity;
    let maxTime = 0;

    filteredMessages.forEach(msg => {
      // 统计发言人
      const extInfo = tryParseExtInfo(msg.extInfo);
      const speaker = extInfo?.user?.nickName || extInfo?.user?.nickname || '未知用户';
      speakerCounts.set(speaker, (speakerCounts.get(speaker) || 0) + 1);

      // 统计消息类型
      typeCounts.set(msg.msgType, (typeCounts.get(msg.msgType) || 0) + 1);

      // 统计时间范围
      minTime = Math.min(minTime, msg.msgTime);
      maxTime = Math.max(maxTime, msg.msgTime);
    });

    const topSpeakers = Array.from(speakerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const messageTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const timeRange = minTime !== Infinity
      ? `${new Date(minTime).toLocaleDateString('zh-CN')} - ${new Date(maxTime).toLocaleDateString('zh-CN')}`
      : '未知';

    return {
      totalMessages: messages?.length ?? 0,
      filteredMessages: filteredMessages.length,
      timeRange,
      topSpeakers,
      messageTypes,
    };
  };

  // 保存设置（使用 AIContext 的 saveSettings）
  const handleSaveSettings = () => {
    saveSettings();
    alert('设置已保存');
  };

  // 应用临时筛选条件
  const handleApplyFilter = () => {
    setFilter({ ...tempFilter });
  };

  // 重置筛选条件
  const handleResetFilter = () => {
    const resetFilter: MessageAnalysisFilter = {
      startTime: '',
      endTime: '',
      speaker: '',
      speakerType: 'all',
      keyword: '',
      msgType: 'all',
      minLength: undefined,
      excludeKeywords: '',
    };
    setTempFilter(resetFilter);
    setFilter(resetFilter);
  };

  // 安全解析extInfo
  const tryParseExtInfo = (extInfo: string): any => {
    try {
      return JSON.parse(extInfo);
    } catch {
      return {};
    }
  };

  // 执行AI分析 - 翻牌数据分析
  const performAnswersAnalysis = async () => {
    if (!apiKey) {
      alert('请先在 AI 模型管理中配置 API Key');
      return;
    }

    if (!answers || answers.length === 0) {
      alert('没有可分析的翻牌数据');
      return;
    }

    setIsAnalyzingAnswers(true);
    setAnswersAnalysisResult(null);

    try {
      // 准备翻牌数据（最多150条）
      const answersToAnalyze = answers.slice(0, 150);
      const answersText = answersToAnalyze.map(answer => {
        const time = new Date(answer.qtime * 1000).toLocaleString('zh-CN');
        const statusText = answer.status === 2 ? '已回复' : answer.status === 1 ? '未回复' : answer.status === 3 ? '已退款' : '翻牌中';
        const answerText = answer.answerContent ? `有回复` : `无回复`;
        return `[${time}] ${answer.idolName} | ${statusText} | 消费:🍗${answer.price} | ${answerText}\n  问: ${answer.content}`;
      }).join('\n\n');

      // 计算统计信息
      const totalCost = answers.reduce((sum, a) => sum + (a.price || 0), 0);
      const answeredCount = answers.filter(a => a.status === 2).length;
      const idolSet = new Set(answers.map(a => a.idolId));

      const prompt = `请分析以下口袋48翻牌数据，生成一份综合分析报告。

数据概览:
- 总翻牌数: ${answers.length} 条
- 已回复: ${answeredCount} 条
- 回复率: ${((answeredCount / answers.length) * 100).toFixed(1)}%
- 总消费: 🍗${totalCost.toFixed(1)}
- 涉及成员: ${idolSet.size} 人
- 数据类型: ${answersType === 'query' ? '翻牌查询' : '年报统计'}

请按以下结构输出分析：

## 📊 翻牌概览
- 翻牌总数和回复率分析
- 消费金额统计
- 涉及成员数量

## 💬 内容分析
- 提问内容的主要话题和特点
- 值得注意的提问模式

## 👥 成员互动
- 最受关注的成员分析
- 成员回复情况总结

## 📈 趋势洞察
- 翻牌行为的特点
- 消费习惯分析

翻牌数据内容（${answersToAnalyze.length}条）：
${answersText}

请用中文回答，使用markdown格式，保持简洁专业。`;

      // 使用 AIContext 的调用函数
      const summary = await callAIAPI(
        apiKey,
        apiEndpoint,
        model,
        [
          {
            role: 'system',
            content: '你是一个专业的数据分析助手，擅长总结和分析口袋48的翻牌数据。请用中文回答，保持简洁、客观、有价值。'
          },
          { role: 'user', content: prompt }
        ],
        2500,
        0.7
      );

      setAnswersAnalysisResult(summary);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('🔴 翻牌 AI 分析失败:', error);

      // 构建更友好的错误显示
      const errorOutput = [
        `## ❌ 翻牌分析失败`,
        ``,
        errorMessage,
        ``,
        `### 🔧 调试检查清单`,
        `- [ ] 打开浏览器开发者工具 (F12) → Console 标签页查看详细日志`,
        `- [ ] 检查 API Key 是否正确配置`,
        `- [ ] 检查 API Key 是否有效（未过期、有足够余额）`,
        `- [ ] 检查 API 端点地址是否正确`,
        `- [ ] 检查模型名称是否正确`,
        ``,
        `### 💡 常见问题`,
        `**GLM API Key 格式错误**`,
        `> GLM API Key 应包含前缀，格式为: \`id.secret\``,
        `> 示例: \`1234567890.abcdef1234567890abcdef1234567890abcdef\``,
        ``,
        `**CORS 跨域问题**`,
        `> 如果看到网络错误，可能是 API 不支持浏览器直接调用`,
        `> 请检查浏览器的 Console 中是否有 CORS 相关错误信息`,
        ``,
        `**网络连接问题**`,
        `> 请确保网络连接正常`,
        `> 某些 API 可能需要代理才能访问`,
      ].join('\n');

      setAnswersAnalysisResult(errorOutput);
    } finally {
      setIsAnalyzingAnswers(false);
    }
  };

  // 开始创建新的自定义预设
  const startCreatePreset = () => {
    setEditingPreset(null);
    setNewPresetName('');
    setNewPresetDescription('');
    setNewPromptPrompt('');
    setNewPresetCategory('general');
    setShowPresetEditor(true);
  };

  // 开始编辑预设
  const startEditPreset = (preset: PromptPreset) => {
    setEditingPreset(preset);
    setNewPresetName(preset.name);
    setNewPresetDescription(preset.description);
    setNewPromptPrompt(preset.prompt);
    setNewPresetCategory(preset.category);
    setShowPresetEditor(true);
  };

  // 保存预设
  const savePreset = () => {
    if (!newPresetName.trim() || !newPromptPrompt.trim()) {
      alert('请填写预设名称和 Prompt 内容');
      return;
    }

    const newPreset: PromptPreset = {
      id: editingPreset?.id || `custom-${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDescription.trim(),
      category: newPresetCategory,
      prompt: newPromptPrompt.trim(),
      isBuiltIn: false,
    };

    let updatedPresets: PromptPreset[];
    if (editingPreset) {
      updatedPresets = customPresets.map(p => p.id === editingPreset.id ? newPreset : p);
    } else {
      updatedPresets = [...customPresets, newPreset];
    }

    saveCustomPresets(updatedPresets);
    setShowPresetEditor(false);
    if (!editingPreset) {
      setSelectedPreset(newPreset.id);
    }
  };

  // 删除预设
  const deletePreset = (presetId: string) => {
    if (!confirm('确定要删除这个自定义预设吗？')) return;
    const updatedPresets = customPresets.filter(p => p.id !== presetId);
    saveCustomPresets(updatedPresets);
    if (selectedPreset === presetId) {
      setSelectedPreset('general-comprehensive');
    }
  };

  // 使用传入的筛选消息数量，如果没有则使用内部筛选
  const filteredCount = filterInfo?.filteredCount ?? applyFilter().length;

  return (
    <div className="ai-features">
      <div className="ai-features-content animate-fadeIn">
          {/* 标签切换 */}
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              智能总结
            </button>
            <button
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              高级设置
            </button>
            {answers && answers.length > 0 && (
              <button
                className={`tab-button ${activeTab === 'answers' ? 'active' : ''}`}
                onClick={() => setActiveTab('answers')}
              >
                翻牌分析
              </button>
            )}
          </div>

          {/* 智能总结面板 */}
          {activeTab === 'summary' && (
            <div className="summary-panel">
              <div className="panel-info">
                <p>筛选消息: <strong>{filterInfo?.filteredCount ?? filteredCount}</strong> / 总消息: <strong>{filterInfo?.totalCount ?? messages?.length ?? 0}</strong> 条</p>
                <p>房主: <strong>{ownerName || '未知'}</strong> | 房间: <strong>{channelName || '未知'}</strong></p>
                {filterInfo && (
                  <p className="filter-summary">
                    {filterInfo.startTime && filterInfo.endTime && (
                      <span>📅 {filterInfo.startTime} ~ {filterInfo.endTime}</span>
                    )}
                    {filterInfo.speaker && <span>👤 {filterInfo.speaker}</span>}
                    {filterInfo.keyword && <span>🔍 "{filterInfo.keyword}"</span>}
                    {filterInfo.msgType && filterInfo.msgType !== 'all' && <span>📦 {filterInfo.msgType}</span>}
                    {filterInfo.filterLivePush && <span>🚫 隐藏直播</span>}
                    {filterInfo.showOwnerRepliesOnly && <span>👑 仅房主</span>}
                  </p>
                )}
                {!apiKey && (
                  <p className="warning">⚠️ 请先在 AI 模型管理中配置 API Key</p>
                )}
              </div>

              {/* Prompt 预设选择 */}
              <div className="preset-selector">
                <h4>🎨 报告风格</h4>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="preset-select"
                >
                  <optgroup label="房主分析">
                    <option value="huxiaohui-daily">📰包间小报</option>
                    <option value="owner-daily-summary">房主今日总结</option>
                    <option value="owner-activity-summary">房主活动总结</option>
                    <option value="owner-mood-analysis">房主心情分析</option>
                  </optgroup>
                  <optgroup label="用户分析">
                    <option value="user-topic-analysis">用户话题分析</option>
                  </optgroup>
                  <optgroup label="综合分析">
                    <option value="general-comprehensive">综合分析报告</option>
                  </optgroup>
                  {customPresets.length > 0 && (
                    <optgroup label="自定义">
                      {customPresets.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="setting-hint">{currentPreset.description}</p>
              </div>

              <div className="summary-actions">
                <button
                  className="analyze-btn"
                  onClick={performAnalysisWithPreset}
                  disabled={isAnalyzing || !apiKey || filteredCount === 0}
                >
                  {isAnalyzing ? '分析中...' : `生成「${currentPreset.name}」报告`}
                </button>
                <button
                  className="btn-export-json"
                  onClick={exportFilteredMessages}
                  disabled={filteredCount === 0}
                >
                  导出筛选结果 JSON
                </button>
              </div>

              {analysisResult && (
                <div className="analysis-result animate-fadeIn">
                  <div className="result-header">
                    <div className="result-stats">
                      <div className="stat-item">
                        <span className="stat-label">筛选消息</span>
                        <span className="stat-value">{analysisResult.stats.filteredMessages} 条</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">时间范围</span>
                        <span className="stat-value">{analysisResult.stats.timeRange}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">活跃用户</span>
                        <span className="stat-value">{analysisResult.stats.topSpeakers.length} 人</span>
                      </div>
                    </div>
                    <button
                      className="btn-export-report"
                      onClick={() => exportReport(analysisResult.summary, currentPreset.name, analysisResult.stats.timeRange)}
                    >
                      导出报告
                    </button>
                  </div>

                  <div className="result-summary">
                    <h4>📝 AI 分析报告</h4>
                    <div className="summary-content">
                      {analysisResult.summary.split('\n').map((line, idx) => {
                        const trimmedLine = line.trim();
                        // 错误标题
                        if (trimmedLine.startsWith('## ❌')) {
                          return <h5 key={idx} style={{ color: '#dc2626' }}>{trimmedLine.replace(/^##\s*/, '')}</h5>;
                        }
                        // 二级标题
                        if (trimmedLine.startsWith('### ')) {
                          return <h5 key={idx}>{trimmedLine.replace(/^###\s*/, '')}</h5>;
                        }
                        // 普通标题
                        if (trimmedLine.startsWith('##') && !trimmedLine.includes('❌')) {
                          return <h5 key={idx}>{trimmedLine.replace(/^##\s*/, '')}</h5>;
                        }
                        // 列表项
                        if (trimmedLine.startsWith('- [ ]') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('*')) {
                          return <li key={idx}>{trimmedLine.replace(/^[-*]\s*(\[ \]\s*)?/, '')}</li>;
                        }
                        // 引用块/提示
                        if (trimmedLine.startsWith('>')) {
                          return <div key={idx} className="error-tip">{trimmedLine.replace(/^>\s*/, '')}</div>;
                        }
                        // 代码
                        if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
                          return <code key={idx}>{trimmedLine.replace(/`/g, '')}</code>;
                        }
                        // 空行
                        if (!trimmedLine) {
                          return <br key={idx} />;
                        }
                        // 普通段落
                        if (trimmedLine) {
                          return <p key={idx}>{trimmedLine}</p>;
                        }
                        return null;
                      })}
                    </div>
                  </div>

                  {analysisResult.stats.topSpeakers.length > 0 && (
                    <div className="top-speakers">
                      <h4>👥 活跃用户 TOP 10</h4>
                      <ul>
                        {analysisResult.stats.topSpeakers.map((speaker, idx) => (
                          <li key={idx}>
                            <span className="rank">#{idx + 1}</span>
                            <span className="name">{speaker.name}</span>
                            <span className="count">{speaker.count} 条</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 消息筛选面板 */}
          {activeTab === 'analysis' && (
            <div className="filter-panel">
              <div className="filter-group">
                <h4>🏷️ 发言人类型</h4>
                <select
                  value={tempFilter.speakerType}
                  onChange={(e) => setTempFilter({ ...tempFilter, speakerType: e.target.value as SpeakerType })}
                >
                  <option value="all">全部消息</option>
                  <option value="owner">仅房主发言</option>
                  <option value="user">仅用户发言</option>
                </select>
                <p className="setting-hint">
                  {tempFilter.speakerType === 'owner' && `仅显示 ${ownerName || '房主'} 的发言`}
                  {tempFilter.speakerType === 'user' && `仅显示用户发言（排除房主）`}
                  {tempFilter.speakerType === 'all' && '显示所有消息'}
                </p>
              </div>

              <div className="filter-group">
                <h4>🕐 时间范围</h4>
                <div className="filter-row">
                  <label>
                    开始时间
                    <input
                      type="datetime-local"
                      value={tempFilter.startTime}
                      onChange={(e) => setTempFilter({ ...tempFilter, startTime: e.target.value })}
                    />
                  </label>
                  <label>
                    结束时间
                    <input
                      type="datetime-local"
                      value={tempFilter.endTime}
                      onChange={(e) => setTempFilter({ ...tempFilter, endTime: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div className="filter-group">
                <h4>👤 发言人</h4>
                <input
                  type="text"
                  placeholder="输入昵称关键词"
                  value={tempFilter.speaker}
                  onChange={(e) => setTempFilter({ ...tempFilter, speaker: e.target.value })}
                />
              </div>

              <div className="filter-group">
                <h4>🔤 关键词</h4>
                <input
                  type="text"
                  placeholder="搜索消息内容"
                  value={tempFilter.keyword}
                  onChange={(e) => setTempFilter({ ...tempFilter, keyword: e.target.value })}
                />
              </div>

              <div className="filter-group">
                <h4>📦 消息类型</h4>
                <select
                  value={tempFilter.msgType}
                  onChange={(e) => setTempFilter({ ...tempFilter, msgType: e.target.value })}
                >
                  <option value="all">全部类型</option>
                  <option value="TEXT">文字消息</option>
                  <option value="IMAGE">图片消息</option>
                  <option value="VOICE">语音消息</option>
                  <option value="VIDEO">视频消息</option>
                </select>
              </div>

              <div className="filter-group">
                <h4>📏 最小长度</h4>
                <input
                  type="number"
                  placeholder="最小字符数"
                  value={tempFilter.minLength || ''}
                  onChange={(e) => setTempFilter({ ...tempFilter, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>

              <div className="filter-group">
                <h4>🚫 排除关键词</h4>
                <input
                  type="text"
                  placeholder="用逗号分隔多个关键词"
                  value={tempFilter.excludeKeywords}
                  onChange={(e) => setTempFilter({ ...tempFilter, excludeKeywords: e.target.value })}
                />
              </div>

              <div className="filter-actions">
                <button className="btn-apply" onClick={handleApplyFilter}>
                  ✓ 应用筛选
                </button>
                <button className="btn-reset" onClick={handleResetFilter}>
                  ↻ 重置
                </button>
              </div>

              <div className="filter-preview">
                筛选结果: <strong>{filteredCount}</strong> / {messages?.length || 0} 条消息
              </div>

              {/* 导出功能 */}
              <div className="export-section">
                <h4>📥 导出数据</h4>
                <div className="export-buttons">
                  <button className="btn-export" onClick={exportFilteredMessages} disabled={filteredCount === 0}>
                    📋 导出筛选结果 ({filteredCount}条)
                  </button>
                  <button className="btn-export" onClick={exportOwnerMessages} disabled={getOwnerMessages().length === 0}>
                    👑 导出房主发言 ({getOwnerMessages().length}条)
                  </button>
                  <button className="btn-export" onClick={exportUserMessages} disabled={getUserMessages().length === 0}>
                    👥 导出用户发言 ({getUserMessages().length}条)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 高级设置面板 */}
          {activeTab === 'settings' && (
            <div className="settings-panel">
              {/* API 配置 - 简化版 */}
              <div className="setting-group">
                <h4>🔑 API 配置</h4>
                <div className="api-config-simple">
                  <div>
                    <label>API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="输入您的 API Key"
                    />
                  </div>
                </div>
                <p className="setting-hint">
                  💡 GLM API Key 格式: <code>id.secret</code>（仅保存在本地浏览器中）
                </p>
                <button className="btn-save" onClick={handleSaveSettings}>
                  💾 保存 API 设置
                </button>
              </div>

              {/* 模型选择 */}
              <div className="setting-group">
                <h4>🤖 模型选择</h4>
                <div className="form-group">
                  <label>预设模型</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="model-select"
                  >
                    <option value="glm-4.7">glm-4.7 (推荐)</option>
                    <option value="glm-4.7-flash">glm-4.7-flash (快速)</option>
                    <option value="glm-4.7-flashx">glm-4.7-flashx (超快)</option>
                    <option value="glm-4.6">glm-4.6</option>
                    <option value="glm-4.5-air">glm-4.5-air (轻量)</option>
                    <option value="glm-4.5-airx">glm-4.5-airx</option>
                    <option value="glm-4.5-flash">glm-4.5-flash</option>
                    <option value="glm-4-flash-250414">glm-4-flash-250414</option>
                    <option value="glm-4-flashx-250414">glm-4-flashx-250414</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    <option value="gpt-4">gpt-4</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="custom">自定义...</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>或输入自定义模型名称</label>
                  <input
                    type="text"
                    value={model === 'custom' ? '' : model}
                    onChange={(e) => setModel(e.target.value || 'glm-4.7-flash')}
                    className="crystal-input"
                    placeholder="例如: glm-4.7, glm-4.7-flash, glm-4.6..."
                  />
                  <p className="setting-hint">
                    💡 可选模型: <code>glm-4.7</code>, <code>glm-4.7-flash</code>, <code>glm-4.7-flashx</code>, <code>glm-4.6</code>, <code>glm-4.5-air</code>, <code>glm-4.5-airx</code>, <code>glm-4.5-flash</code>, <code>glm-4-flash-250414</code>, <code>glm-4-flashx-250414</code>
                  </p>
                </div>
                <button className="btn-save" onClick={handleSaveSettings}>
                  💾 保存模型设置
                </button>
              </div>

              {/* 自定义 Prompt 管理 */}
              <div className="setting-group preset-section">
                <div className="preset-header">
                  <h4>📝 自定义 Prompt</h4>
                  <button className="btn-create-preset" onClick={startCreatePreset}>
                    + 新建
                  </button>
                </div>

                {showPresetEditor ? (
                  <div className="preset-editor">
                    <div className="form-group">
                      <label>预设名称</label>
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="例如：我的房主日报"
                      />
                    </div>
                    <div className="form-group">
                      <label>分类</label>
                      <select
                        value={newPresetCategory}
                        onChange={(e) => setNewPresetCategory(e.target.value as 'owner' | 'user' | 'general')}
                      >
                        <option value="owner">房主分析</option>
                        <option value="user">用户分析</option>
                        <option value="general">综合分析</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>描述</label>
                      <input
                        type="text"
                        value={newPresetDescription}
                        onChange={(e) => setNewPresetDescription(e.target.value)}
                        placeholder="简短描述这个预设的用途"
                      />
                    </div>
                    <div className="form-group">
                      <label>Prompt 模板</label>
                      <textarea
                        value={newPromptPrompt}
                        onChange={(e) => setNewPromptPrompt(e.target.value)}
                        placeholder="输入自定义 prompt，可使用变量：{ownerName} {channelName} {count} {timeRange} {messages}"
                        rows={8}
                        className="prompt-textarea"
                      />
                      <p className="setting-hint">
                        可用变量: <code>{'{ownerName}'}</code> <code>{'{channelName}'}</code> <code>{'{count}'}</code> <code>{'{timeRange}'}</code> <code>{'{messages}'}</code>
                      </p>
                    </div>
                    <div className="preset-editor-actions">
                      <button className="btn-save-preset" onClick={savePreset}>
                        💾 保存
                      </button>
                      <button className="btn-cancel-preset" onClick={() => setShowPresetEditor(false)}>
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="custom-presets-list">
                    {customPresets.length === 0 ? (
                      <p className="empty-presets-hint">暂无自定义预设，点击"新建"创建一个</p>
                    ) : (
                      customPresets.map(preset => (
                        <div key={preset.id} className="preset-item">
                          <div className="preset-item-info">
                            <span className="preset-item-name">{preset.name}</span>
                            <span className="preset-item-desc">{preset.description}</span>
                            <span className="preset-item-category">{preset.category === 'owner' ? '房主' : preset.category === 'user' ? '用户' : '综合'}</span>
                          </div>
                          <div className="preset-item-actions">
                            <button onClick={() => startEditPreset(preset)} className="btn-edit-preset">✏️</button>
                            <button onClick={() => deletePreset(preset.id)} className="btn-delete-preset">🗑️</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 翻牌分析面板 */}
          {activeTab === 'answers' && answers && answers.length > 0 && (
            <div className="answers-panel">
              <div className="panel-info">
                <p>当前翻牌数据: <strong>{answers.length}</strong> 条</p>
                <p>总消费: <strong>🍗{answers.reduce((sum, a) => sum + (a.price || 0), 0).toFixed(1)}</strong></p>
                <p>已回复: <strong>{answers.filter(a => a.status === 2).length}</strong> 条</p>
                {!apiKey && (
                  <p className="warning">⚠️ 请先在 AI 模型管理中配置 API Key</p>
                )}
              </div>

              <button
                className="analyze-btn"
                onClick={performAnswersAnalysis}
                disabled={isAnalyzingAnswers || !apiKey || answers.length === 0}
              >
                {isAnalyzingAnswers ? '分析中...' : '🚀 开始分析翻牌数据'}
              </button>

              {answersAnalysisResult && (
                <div className="analysis-result animate-fadeIn">
                  <div className="result-summary">
                    <h4>📝 AI 翻牌分析报告</h4>
                    <div className="summary-content">
                      {answersAnalysisResult.split('\n').map((line, idx) => {
                        const trimmedLine = line.trim();
                        // 错误标题
                        if (trimmedLine.startsWith('## ❌')) {
                          return <h5 key={idx} style={{ color: '#dc2626' }}>{trimmedLine.replace(/^##\s*/, '')}</h5>;
                        }
                        // 二级标题
                        if (trimmedLine.startsWith('### ')) {
                          return <h5 key={idx}>{trimmedLine.replace(/^###\s*/, '')}</h5>;
                        }
                        // 普通标题
                        if (trimmedLine.startsWith('##') && !trimmedLine.includes('❌')) {
                          return <h5 key={idx}>{trimmedLine.replace(/^##\s*/, '')}</h5>;
                        }
                        // 列表项
                        if (trimmedLine.startsWith('- [ ]') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('*')) {
                          return <li key={idx}>{trimmedLine.replace(/^[-*]\s*(\[ \]\s*)?/, '')}</li>;
                        }
                        // 引用块/提示
                        if (trimmedLine.startsWith('>')) {
                          return <div key={idx} className="error-tip">{trimmedLine.replace(/^>\s*/, '')}</div>;
                        }
                        // 代码
                        if (trimmedLine.startsWith('`') && trimmedLine.endsWith('`')) {
                          return <code key={idx}>{trimmedLine.replace(/`/g, '')}</code>;
                        }
                        // 空行
                        if (!trimmedLine) {
                          return <br key={idx} />;
                        }
                        // 普通段落
                        if (trimmedLine) {
                          return <p key={idx}>{trimmedLine}</p>;
                        }
                        return null;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
};
