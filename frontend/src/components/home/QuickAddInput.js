"use client";

import { Sparkles } from 'lucide-react';

export default function QuickAddInput({ value, onChange }) {
    return (
        <div style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>자연어 입력</h3>
            <div className="rainbow-border" style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--card-bg)',
                borderRadius: '16px',
                padding: '1rem',
                // removed border and box-shadow
                transition: 'all 0.2s ease',
                position: 'relative'
            }}>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="예: 강남 스타벅스 4500원"
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        fontSize: '1.1rem',
                        color: 'var(--text-main)',
                        backgroundColor: 'transparent',
                        fontWeight: '500',
                        position: 'relative',
                        zIndex: 2
                    }}
                />
                <Sparkles size={20} color="#FFD700" style={{ marginLeft: '0.5rem', position: 'relative', zIndex: 2 }} />
            </div>
            <style jsx>{`
                @keyframes aurora {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .rainbow-border {
                    position: relative;
                    z-index: 1;
                }
                .rainbow-border::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 16px;
                    background: var(--card-bg);
                    z-index: -1;
                }
                .rainbow-border::before {
                    content: "";
                    position: absolute;
                    inset: -2px;
                    border-radius: 20px;
                    background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
                    background-size: 400%;
                    z-index: -2;
                    filter: blur(4px);
                    opacity: 0.7;
                    animation: aurora 10s linear infinite;
                }
            `}</style>
        </div>
    );
}
