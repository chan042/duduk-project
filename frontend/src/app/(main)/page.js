"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChallengeList from '@/components/home/ChallengeList';
import TotalSpending from '@/components/home/TotalSpending';
import CategorySpending from '@/components/home/CategorySpending';
import RecentTransactions from '@/components/home/RecentTransactions';
import ChatbotFloatingButton from '@/components/home/ChatbotFloatingButton';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const { isNativeApp, isAuthenticated, loading } = useAuth();

  const shouldRedirectToLogin = isNativeApp && !loading && !isAuthenticated;

  useEffect(() => {
    const handleTransactionAdded = () => {
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('transactionAdded', handleTransactionAdded);
    return () => {
      window.removeEventListener('transactionAdded', handleTransactionAdded);
    };
  }, []);

  useEffect(() => {
    if (!shouldRedirectToLogin) {
      return;
    }

    router.replace('/login');
  }, [router, shouldRedirectToLogin]);

  if (isNativeApp && (loading || shouldRedirectToLogin)) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#FFFFFF',
        }}
      />
    );
  }

  return (
    <main style={{ padding: '1.5rem' }}>
      <ChallengeList />
      <TotalSpending key={`total-${refreshKey}`} />
      <CategorySpending key={`category-${refreshKey}`} />
      <RecentTransactions key={`recent-${refreshKey}`} />
      <ChatbotFloatingButton />
    </main>
  );
}
