import React from 'react';
import { List, Calendar } from 'lucide-react';
import styles from './expense.module.css';

export default function ViewToggle({ viewMode, setViewMode }) {
    return (
        <div className={styles.toggleContainer}>
            <button
                className={`${styles.toggleButton} ${viewMode === 'calendar' ? styles.active : ''}`}
                onClick={() => setViewMode('calendar')}
            >
                <Calendar size={20} />
            </button>
            <button
                className={`${styles.toggleButton} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => setViewMode('list')}
            >
                <List size={20} />
            </button>
        </div>
    );
}
