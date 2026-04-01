import { Suspense } from 'react';
import SocialLoginCallbackPage from '@/components/auth/SocialLoginCallbackPage';
import { SOCIAL_CALLBACK_PROVIDER_NAMES } from '@/lib/auth/socialCallbackProviders';

export const dynamicParams = false;

export function generateStaticParams() {
    return SOCIAL_CALLBACK_PROVIDER_NAMES.map((provider) => ({ provider }));
}

function CallbackFallback() {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }} />
    );
}

export default async function Page({ params }) {
    const { provider } = await params;

    return (
        <Suspense fallback={<CallbackFallback />}>
            <SocialLoginCallbackPage provider={provider} />
        </Suspense>
    );
}
