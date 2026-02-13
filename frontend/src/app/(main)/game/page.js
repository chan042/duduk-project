"use client";

import FlappyGame from '@/components/game/FlappyGame';
import { useRouter } from 'next/navigation';

export default function GamePage() {
    const router = useRouter();

    const handleClose = () => {
        router.push('/room');
    };

    return <FlappyGame onClose={handleClose} />;
}
