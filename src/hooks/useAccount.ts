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
    const exists = accounts.some(a => a.accountId === account.accountId);
    if (!exists) {
      const newAccounts = [...accounts, account];
      saveAccounts(newAccounts);
    }
  }, [accounts, saveAccounts]);

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

  return {
    accounts,
    currentAccount,
    addAccount,
    removeAccount,
    switchAccount,
    updateAccount,
    setCurrentAccount,
  };
}
