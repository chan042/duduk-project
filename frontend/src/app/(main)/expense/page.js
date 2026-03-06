"use client";

import { Suspense } from 'react';
import ExpenseContainer from '@/components/expense/ExpenseContainer';

export default function ExpensePage() {
    return (
        <Suspense fallback={<div style={{ padding: '24px' }}>로딩 중...</div>}>
            <ExpenseContainer />
        </Suspense>
    );
}
