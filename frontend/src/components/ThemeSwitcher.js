"use client";

import { useState, useEffect } from 'react';

export default function ThemeSwitcher() {
    const [theme, setTheme] = useState('default');

    useEffect(() => {
        // Check local storage or system preference on mount if needed
        // For now, default to 'default'
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'default' ? 'glass' : 'default';
        setTheme(newTheme);

        if (newTheme === 'glass') {
            document.documentElement.setAttribute('data-theme', 'glass');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    };

    return (
        <button
            onClick={toggleTheme}
            style={{
                position: 'fixed',
                bottom: '2rem',
                right: '2rem',
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 9999,
                fontWeight: '600'
            }}
        >
            {theme === 'default' ? '✨ Go Glass' : '🌿 Go Minimal'}
        </button>
    );
}
