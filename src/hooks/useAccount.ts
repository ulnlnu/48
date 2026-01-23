// 账号管理 Hook
import { useState, useCallback } from 'react';
import type { AccountInfo } from '../types';

const STORAGE_KEY = 'pocket48_accounts';

export function useAccount() {
  const [accounts, setAccounts] = useState<AccountInfo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentAccount, setCurrentAccount] = useState<AccountInfo | null>(() => {
    if (accounts.length > 0) {
      // 查找最后使用的账号
      const lastUsed = localStorage.getItem('pocket48_last_account');
      if (lastUsed) {
        return accounts.find(a => a.accountId === lastUsed) || accounts[0];
      }
      return accounts[0];
    }
    return null;
  });

  const saveAccounts = useCallback((newAccounts: AccountInfo[]) => {
    setAccounts(newAccounts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
  }, []);

  const addAccount = useCallback((account: AccountInfo) => {
    const index = accounts.findIndex(a => a.accountId === account.accountId);
    
    if (index !== -1) {
      // 账号已存在，更新信息（主要是更新 Token）
      const newAccounts = [...accounts];
      newAccounts[index] = account;
      saveAccounts(newAccounts);
      
      // 如果当前正是这个账号，立即更新状态
      if (currentAccount?.accountId === account.accountId) {
        setCurrentAccount(account);
      }
    } else {
      // 新账号
      const newAccounts = [...accounts, account];
      saveAccounts(newAccounts);
      
      // 如果是第一个添加的账号，自动切换为当前账号
      if (accounts.length === 0) {
        setCurrentAccount(account);
        localStorage.setItem('pocket48_last_account', account.accountId);
      }
    }
  }, [accounts, currentAccount, saveAccounts]);

  const removeAccount = useCallback((accountId: string) => {
    const newAccounts = accounts.filter(a => a.accountId !== accountId);
    saveAccounts(newAccounts);
    if (currentAccount?.accountId === accountId) {
      setCurrentAccount(newAccounts.length > 0 ? newAccounts[0] : null);
    }
  }, [accounts, currentAccount, saveAccounts]);

  const switchAccount = useCallback((account: AccountInfo) => {
    setCurrentAccount(account);
    localStorage.setItem('pocket48_last_account', account.accountId);
  }, []);

  const updateAccount = useCallback((accountId: string, updates: Partial<AccountInfo>) => {
    const newAccounts = accounts.map(a =>
      a.accountId === accountId ? { ...a, ...updates } : a
    );
    saveAccounts(newAccounts);
    if (currentAccount?.accountId === accountId) {
      setCurrentAccount({ ...currentAccount, ...updates });
    }
  }, [accounts, currentAccount, saveAccounts]);

  const logout = useCallback(() => {
    setCurrentAccount(null);
    localStorage.removeItem('pocket48_last_account');
  }, []);

  return {
    accounts,
    currentAccount,
    addAccount,
    removeAccount,
    switchAccount,
    updateAccount,
    setCurrentAccount,
    logout,
  };
}
