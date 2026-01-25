"use client";

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import QuickAddInput from './QuickAddInput';
import ReceiptScan from './ReceiptScan';
import ImageMatching from './ImageMatching';
import TransactionConfirm from './TransactionConfirm';
import { parseTransaction, createTransaction } from '../../lib/api/transaction';

export default function QuickAddPopup({ onClose, onTransactionAdded, selectedDate }) {
    const [step, setStep] = useState('input'); // 'input' | 'confirm'
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [parsedData, setParsedData] = useState(null);

    const handleRecordClick = async () => {
        if (!inputText.trim()) {
            alert('내용을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await parseTransaction(inputText);
            setParsedData(data);
            setStep('confirm');
        } catch (error) {
            console.error('Failed to parse transaction:', error);
            alert('분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (finalData) => {
        try {
            console.log('Saving transaction:', finalData);
            await createTransaction(finalData);
            alert('저장되었습니다!');
            if (onTransactionAdded) {
                onTransactionAdded();
            }
            onClose();
        } catch (error) {
            console.error('Failed to save transaction:', error);
            alert('저장에 실패했습니다.');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '430px',
                backgroundColor: 'var(--background-light)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                padding: '1.5rem',
                animation: 'slideUp 0.3s ease-out',
                position: 'relative',
                maxHeight: '90vh', // Limit height for scrollable content
                overflowY: 'auto'
            }}>
                {/* Header (Only show Close button in Input step, or Back/Close in Confirm step) */}
                {step === 'input' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Quick Add</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={24} color="var(--text-main)" />
                        </button>
                    </div>
                )}

                {step === 'confirm' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={24} color="var(--text-main)" />
                        </button>
                    </div>
                )}

                {/* Content based on Step */}
                {step === 'input' ? (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <QuickAddInput value={inputText} onChange={setInputText} />

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <ReceiptScan />
                                <ImageMatching />
                            </div>
                        </div>

                        {/* Bottom Button */}
                        <button
                            onClick={handleRecordClick}
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    분석 중...
                                </>
                            ) : (
                                '기록하기'
                            )}
                        </button>
                    </>
                ) : (
                    <TransactionConfirm initialData={parsedData} onSave={handleSave} selectedDate={selectedDate} />
                )}

                <style jsx global>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        </div>
    );
}
