// AI Context - 全局AI配置管理
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AIContextType {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  setApiKey: (key: string) => void;
  setApiEndpoint: (endpoint: string) => void;
  setModel: (model: string) => void;
  saveSettings: () => void;
  clearSettings: () => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

const STORAGE_KEYS = {
  apiKey: 'pocket48_ai_api_key',
  endpoint: 'pocket48_ai_endpoint',
  model: 'pocket48_ai_model',
};

const DEFAULT_SETTINGS = {
  apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4.7-flash',
};

interface AIProviderProps {
  children: ReactNode;
}

export function AIProvider({ children }: AIProviderProps) {
  const [apiKey, setApiKeyState] = useState('');
  const [apiEndpoint, setApiEndpointState] = useState(DEFAULT_SETTINGS.apiEndpoint);
  const [model, setModelState] = useState(DEFAULT_SETTINGS.model);

  // 从 localStorage 加载设置
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedEndpoint = localStorage.getItem(STORAGE_KEYS.endpoint);
    const savedModel = localStorage.getItem(STORAGE_KEYS.model);

    if (savedKey) setApiKeyState(savedKey);
    if (savedEndpoint) setApiEndpointState(savedEndpoint);
    if (savedModel) setModelState(savedModel);
  }, []);

  const setApiKey = (key: string) => {
    setApiKeyState(key);
  };

  const setApiEndpoint = (endpoint: string) => {
    setApiEndpointState(endpoint);
  };

  const setModel = (model: string) => {
    setModelState(model);
  };

  const saveSettings = () => {
    if (apiKey) localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
    if (apiEndpoint) localStorage.setItem(STORAGE_KEYS.endpoint, apiEndpoint);
    if (model) localStorage.setItem(STORAGE_KEYS.model, model);
  };

  const clearSettings = () => {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    localStorage.removeItem(STORAGE_KEYS.endpoint);
    localStorage.removeItem(STORAGE_KEYS.model);
    setApiKeyState('');
    setApiEndpointState(DEFAULT_SETTINGS.apiEndpoint);
    setModelState(DEFAULT_SETTINGS.model);
  };

  return (
    <AIContext.Provider
      value={{
        apiKey,
        apiEndpoint,
        model,
        setApiKey,
        setApiEndpoint,
        setModel,
        saveSettings,
        clearSettings,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI(): AIContextType {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
}

// 导出便捷的调用AI的hook
export async function callAIAPI(
  apiKey: string,
  apiEndpoint: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<string> {
  // ========== 请求前验证和日志 ==========
  if (!apiKey) {
    throw new Error('API Key 未配置');
  }

  if (!apiEndpoint) {
    throw new Error('API 端点未配置');
  }

  if (!model) {
    throw new Error('模型名称未配置');
  }

  if (!messages || messages.length === 0) {
    throw new Error('消息内容为空');
  }

  // 记录请求详情（调试用）
  const requestDetails = {
    endpoint: apiEndpoint,
    model: model,
    messageCount: messages.length,
    maxTokens,
    temperature,
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey.substring(0, Math.min(10, apiKey.length)) + '...',
  };

  console.group('🔄 AI API 请求开始');
  console.log('📤 请求配置:', requestDetails);
  console.log('📝 消息预览:', messages.map(m => ({
    role: m.role,
    contentLength: m.content.length,
    contentPreview: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
  })));

  // ========== 验证 API Key 格式 ==========
  if (apiKey.length < 10) {
    console.error('❌ API Key 长度过短:', apiKey.length);
    console.groupEnd();
    throw new Error(`API Key 格式无效: 长度过短 (${apiKey.length} 字符)，通常应为 20-50 字符`);
  }

  // ========== 构建请求体 ==========
  const requestBody = {
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature,
    stream: false,
  };

  console.log('📦 请求体:', JSON.stringify(requestBody, null, 2));
  console.groupEnd();

  // ========== 发送请求 ==========
  let response: Response;
  try {
    response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkError) {
    console.error('❌ 网络请求失败:', networkError);
    throw new Error(`网络请求失败: ${networkError instanceof Error ? networkError.message : String(networkError)}\n\n可能原因:\n- 网络连接问题\n- API 端点地址错误\n- CORS 跨域限制（某些 API 不支持浏览器直接调用）`);
  }

  // ========== 处理响应 ==========
  console.group('📥 AI API 响应接收');
  console.log('📊 响应状态:', response.status, response.statusText);
  console.log('📋 响应头:', Object.fromEntries(response.headers.entries()));

  // ========== 错误处理 ==========
  if (!response.ok) {
    let errorData: any = {};
    let rawErrorText = '';

    try {
      rawErrorText = await response.text();
      console.error('❌ 错误响应原文:', rawErrorText);

      try {
        errorData = JSON.parse(rawErrorText);
      } catch {
        // 如果不是 JSON，使用原文
        errorData = { rawResponse: rawErrorText };
      }
    } catch (readError) {
      console.error('❌ 读取错误响应失败:', readError);
      errorData = { readError: String(readError) };
    }

    // 解析各种可能的错误格式
    let errorMessage = '';
    let errorDetails: string[] = [];

    // OpenAI 格式: { error: { message: "...", type: "...", code: "..." } }
    if (errorData.error?.message) {
      errorMessage = errorData.error.message;
      if (errorData.error.type) errorDetails.push(`类型: ${errorData.error.type}`);
      if (errorData.error.code) errorDetails.push(`代码: ${errorData.error.code}`);
    }
    // GLM 格式或其他格式: { message: "..." } 或 { error: "..." }
    else if (errorData.message) {
      errorMessage = errorData.message;
    } else if (errorData.error) {
      errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
    }
    // 其他情况使用原文
    else if (rawErrorText) {
      errorMessage = rawErrorText.substring(0, 200);
    } else {
      errorMessage = `API请求失败: ${response.status} ${response.statusText}`;
    }

    // 根据 HTTP 状态码提供诊断建议
    const diagnosticHints: string[] = [];
    switch (response.status) {
      case 400:
        diagnosticHints.push('请求参数错误 - 请检查模型名称是否正确');
        break;
      case 401:
        diagnosticHints.push('认证失败 - API Key 可能无效或已过期');
        diagnosticHints.push('GLM API Key 格式应为: {id}.{secret}');
        break;
      case 403:
        diagnosticHints.push('权限不足 - 请检查 API Key 权限');
        break;
      case 404:
        diagnosticHints.push('API 端点不存在 - 请检查端点 URL 是否正确');
        break;
      case 429:
        diagnosticHints.push('请求过于频繁 - 请稍后再试');
        break;
      case 500:
      case 502:
      case 503:
        diagnosticHints.push('服务器错误 - API 服务暂时不可用，请稍后再试');
        break;
    }

    console.error('❌ 解析后的错误信息:', errorMessage);
    console.error('📌 错误详情:', errorDetails);
    console.error('💡 诊断建议:', diagnosticHints);
    console.groupEnd();

    // 构建详细的错误信息
    const fullErrorMessage = [
      `❌ AI API 调用失败`,
      ``,
      `📋 错误信息: ${errorMessage}`,
      errorDetails.length > 0 ? `📌 详情: ${errorDetails.join(', ')}` : '',
      response.status !== 200 ? `🔴 HTTP 状态码: ${response.status} ${response.statusText}` : '',
      ``,
      `🔧 请求配置:`,
      `  • 端点: ${apiEndpoint}`,
      `  • 模型: ${model}`,
      `  • API Key 前缀: ${requestDetails.apiKeyPrefix}`,
      ``,
      diagnosticHints.length > 0 ? `💡 可能原因:\n  • ${diagnosticHints.join('\n  • ')}` : '',
    ].filter(Boolean).join('\n');

    throw new Error(fullErrorMessage);
  }

  // ========== 解析成功响应 ==========
  let data: any;
  try {
    const responseText = await response.text();
    console.log('✅ 响应原文:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    data = JSON.parse(responseText);
    console.log('✅ 解析后的响应数据:', data);
  } catch (parseError) {
    console.error('❌ 响应解析失败:', parseError);
    console.groupEnd();
    throw new Error(`响应解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}\n\n原始响应不是有效的 JSON 格式`);
  }

  // ========== 提取生成的内容 ==========
  // 支持多种响应格式 (OpenAI/GLM兼容)
  let content = data.choices?.[0]?.message?.content
             || data.data?.choices?.[0]?.message?.content
             || data.message
             || '';

  if (!content) {
    console.error('❌ 无法从响应中提取内容');
    console.error('📦 响应结构:', JSON.stringify(data, null, 2));
    console.groupEnd();
    throw new Error(`无法从响应中提取生成的内容\n\n响应结构:\n${JSON.stringify(data, null, 2)}`);
  }

  console.log('✅ 成功提取内容，长度:', content.length);
  console.groupEnd();

  return content;
}
