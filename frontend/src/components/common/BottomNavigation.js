"use client";

import { Bot, Plus, Home, Calendar, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_NAV_COLOR = "var(--primary)";
const INACTIVE_NAV_COLOR = "var(--text-sub)";


export default function BottomNavigation({ onQuickAddClick }) {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const isChallengeSection =
        pathname === "/challenge" ||
        pathname.startsWith("/challenge/");
    const isExpenseSection =
        pathname === "/expense" ||
        pathname.startsWith("/expense/");
    const isCoachingSection =
        pathname === "/coaching" ||
        pathname.startsWith("/coaching/");
    const isYuntaekSection =
        pathname === "/yuntaek-index" ||
        pathname.startsWith("/yuntaek-index/") ||
        pathname.startsWith("/challenge-battle");
    const challengeNavColor = isChallengeSection ? ACTIVE_NAV_COLOR : INACTIVE_NAV_COLOR;
    const expenseNavColor = isExpenseSection ? ACTIVE_NAV_COLOR : INACTIVE_NAV_COLOR;
    const coachingNavColor = isCoachingSection ? ACTIVE_NAV_COLOR : INACTIVE_NAV_COLOR;
    const yuntaekNavColor = isYuntaekSection ? ACTIVE_NAV_COLOR : INACTIVE_NAV_COLOR;

    return (
        <div
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "white",
                borderTop: "1px solid #eee",
                borderRadius: "20px 20px 0 0",
                height: "84px",
                maxWidth: "430px",
                margin: "0 auto",
                zIndex: 100,
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    alignItems: "center",
                    height: "100%",
                    position: "relative",
                    padding: "10px 0.5rem 18px",
                }}
            >
                <Link
                    href="/challenge"
                    style={{
                        ...styles.navButton,
                        color: challengeNavColor,
                    }}
                >
                    <Trophy size={24} color={challengeNavColor} />
                    <span
                        style={{
                            ...styles.navLabel,
                            color: challengeNavColor,
                            fontWeight: isChallengeSection ? 700 : 500,
                        }}
                    >
                        챌린지
                    </span>
                </Link>

                <Link
                    href="/expense"
                    style={{
                        ...styles.navButton,
                        color: expenseNavColor,
                    }}
                >
                    <Calendar size={24} color={expenseNavColor} />
                    <span
                        style={{
                            ...styles.navLabel,
                            color: expenseNavColor,
                            fontWeight: isExpenseSection ? 700 : 500,
                        }}
                    >
                        달력
                    </span>
                </Link>

                {isHome ? (
                    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                        <button
                            onClick={onQuickAddClick}
                            style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                backgroundColor: "var(--primary)",
                                color: "white",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                            }}
                        >
                            <Plus size={22} />
                        </button>
                    </div>
                ) : (
                    <Link
                        href="/"
                        style={{
                            ...styles.navButton,
                            color: "var(--text-sub)",
                        }}
                    >
                        <Home size={24} />
                        <span style={styles.navLabel}>홈</span>
                    </Link>
                )}

                <Link
                    href="/coaching"
                    style={{
                        ...styles.navButton,
                        color: coachingNavColor,
                    }}
                >
                    <Bot size={24} color={coachingNavColor} />
                    <span
                        style={{
                            ...styles.navLabel,
                            color: coachingNavColor,
                            fontWeight: isCoachingSection ? 700 : 500,
                        }}
                    >
                        코칭
                    </span>
                </Link>

                <Link
                    href="/yuntaek-index"
                    style={{
                        ...styles.navButton,
                        color: yuntaekNavColor,
                    }}
                >
                    <TrendingUp size={24} color={yuntaekNavColor} />
                    <span
                        style={{
                            ...styles.navLabel,
                            color: yuntaekNavColor,
                            fontWeight: isYuntaekSection ? 700 : 500,
                        }}
                    >
                        윤택지수
                    </span>
                </Link>
            </div>
        </div>
    );
}


const styles = {
    navButton: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        fontSize: "0.75rem",
        gap: "4px",
        cursor: "pointer",
    },
    navLabel: {
        fontSize: "0.75rem",
        color: "inherit",
    },
};
