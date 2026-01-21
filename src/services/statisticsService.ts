// 统计数据处理服务
import type { IdolAnswer, AnswerFilter, StatisticsResult } from '../types';

// 筛选数据
export function filterAnswers(answers: IdolAnswer[], filter: AnswerFilter): IdolAnswer[] {
  return answers.filter(answer => {
    if (filter.idolId && answer.idolId !== filter.idolId) return false;
    if (filter.idolName && !answer.idolName.includes(filter.idolName)) return false;
    if (filter.roomId && answer.roomId !== filter.roomId) return false;
    if (filter.startTime && answer.qtime < filter.startTime!) return false;
    if (filter.endTime && answer.qtime > filter.endTime!) return false;
    if (filter.keyword && !answer.content.includes(filter.keyword)) return false;
    if (filter.status !== undefined && answer.status !== filter.status) return false;
    if (filter.type !== undefined && answer.type !== filter.type) return false;
    return true;
  });
}

// 计算统计数据
export function calculateStatistics(answers: IdolAnswer[]): StatisticsResult {
  const result: StatisticsResult = {
    totalCount: 0,
    totalCost: 0,
    byIdol: {},
    byMonth: {},
    byType: {},
  };

  answers.forEach(answer => {
    result.totalCount++;
    result.totalCost += answer.price;

    // 按成员统计
    // 确保使用 idolId 作为唯一键
    if (!result.byIdol[answer.idolId]) {
      result.byIdol[answer.idolId] = {
        count: 0,
        cost: 0,
        name: answer.idolName, // 保存名字
      };
    }
    result.byIdol[answer.idolId].count++;
    result.byIdol[answer.idolId].cost += answer.price;

    // 按月份统计
    const month = new Date(answer.qtime * 1000).toISOString().slice(0, 7);
    if (!result.byMonth[month]) {
      result.byMonth[month] = { count: 0, cost: 0 };
    }
    result.byMonth[month].count++;
    result.byMonth[month].cost += answer.price;

    // 按类型统计
    if (!result.byType[answer.type]) {
      result.byType[answer.type] = {
        count: 0,
        cost: 0,
        name: getTypeName(answer.type),
      };
    }
    result.byType[answer.type].count++;
    result.byType[answer.type].cost += answer.price;
  });

  return result;
}

// 获取翻牌类型名称
function getTypeName(type: number): string {
  const typeNames: { [key: number]: string } = {
    0: '普通翻牌',
    1: '口令翻牌',
    2: '付费提问',
  };
  return typeNames[type] || `类型${type}`;
}

// 获取成员列表
export function getIdolList(answers: IdolAnswer[]): { idolId: string; idolName: string }[] {
  const idolMap = new Map<string, string>();
  answers.forEach(answer => {
    idolMap.set(answer.idolId, answer.idolName);
  });
  return Array.from(idolMap.entries()).map(([idolId, idolName]) => ({
    idolId,
    idolName,
  }));
}

// 获取房间列表
export function getRoomList(answers: IdolAnswer[]): { roomId: string; roomName: string }[] {
  const roomMap = new Map<string, string>();
  answers.forEach(answer => {
    roomMap.set(answer.roomId, answer.roomName);
  });
  return Array.from(roomMap.entries()).map(([roomId, roomName]) => ({
    roomId,
    roomName,
  }));
}

// 格式化时间戳
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 获取状态名称
export function getStatusName(status: number): string {
  const statusNames: { [key: number]: string } = {
    1: '未回复',
    2: '已回复',
    3: '已退款',
    4: '翻牌中',
  };
  return statusNames[status] || `状态${status}`;
}

// 排序统计结果
export function sortStatistics(
  data: { [key: string]: { count: number; cost: number; name?: string } },
  sortBy: 'count' | 'cost' = 'count',
  order: 'asc' | 'desc' = 'desc'
): { key: string; name: string; count: number; cost: number }[] {
  return Object.entries(data)
    .map(([key, value]) => ({
      key,
      name: value.name || key,
      count: value.count,
      cost: value.cost,
    }))
    .sort((a, b) => {
      const aValue = sortBy === 'count' ? a.count : a.cost;
      const bValue = sortBy === 'count' ? b.count : b.cost;
      return order === 'desc' ? bValue - aValue : aValue - bValue;
    });
}

// 计算月份分布数据
export function getMonthlyDistribution(answers: IdolAnswer[]): { labels: string[]; counts: number[]; costs: number[] } {
  const monthData = new Map<string, { count: number; cost: number }>();

  answers.forEach(answer => {
    const month = new Date(answer.qtime * 1000).toISOString().slice(0, 7);
    if (!monthData.has(month)) {
      monthData.set(month, { count: 0, cost: 0 });
    }
    const data = monthData.get(month)!;
    data.count++;
    data.cost += answer.price;
  });

  const sortedMonths = Array.from(monthData.keys()).sort();
  return {
    labels: sortedMonths,
    counts: sortedMonths.map(m => monthData.get(m)!.count),
    costs: sortedMonths.map(m => monthData.get(m)!.cost),
  };
}

// 计算单日分布数据
export function getHourlyDistribution(answers: IdolAnswer[]): { labels: string[]; counts: number[] } {
  const hourData = new Array(24).fill(0);

  answers.forEach(answer => {
    const hour = new Date(answer.qtime * 1000).getHours();
    hourData[hour]++;
  });

  return {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    counts: hourData,
  };
}
