"use client";

import { ChevronLeft, Download } from 'lucide-react';

export default function ReportHeader({ onBack, onDownload }) {
    return (
        <header style={styles.header}>
            <button onClick={onBack} style={styles.backButton}>
                <ChevronLeft size={24} />
            </button>
            <h1 style={styles.headerTitle}>AI 분석 리포트</h1>
            <button
                onClick={onDownload}
                style={styles.downloadButton}
                title="리포트 다운로드"
            >
                <Download size={20} />
            </button>
        </header>
    );
}

const iconButton = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const styles = {
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        zIndex: 10,
        position: 'relative',
    },
    backButton: iconButton,
    downloadButton: { ...iconButton, color: '#475569' },
    headerTitle: {
        fontSize: '1.2rem',
        fontWeight: '600',
        color: '#1e293b',
    },
};
