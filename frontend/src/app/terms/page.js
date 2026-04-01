import LegalDocumentPage from '@/components/auth/LegalDocumentPage';

const sections = [
    {
        heading: '1. 서비스 이용',
        body: [
            'Duduk은 소비 기록, 분석, 챌린지 등 개인 금융 습관 관리 기능을 제공하는 서비스입니다.',
            '사용자는 서비스 기능을 정상적인 범위에서 이용해야 하며, 운영을 방해하는 행위를 해서는 안 됩니다.',
        ],
    },
    {
        heading: '2. 계정 및 로그인',
        body: [
            '사용자는 이메일 또는 소셜 로그인 수단을 이용해 Duduk 계정에 접근할 수 있습니다.',
            '현재 서비스는 동일한 Duduk 계정에 여러 소셜 로그인 수단을 연결할 수 있도록 구성되어 있습니다.',
        ],
    },
    {
        heading: '3. 사용자 책임',
        body: [
            '사용자는 본인의 계정 정보와 로그인 수단을 안전하게 관리해야 합니다.',
            '타인의 정보를 무단으로 사용하거나 허위 정보를 입력하는 경우 서비스 이용이 제한될 수 있습니다.',
        ],
    },
    {
        heading: '4. 서비스 변경',
        body: [
            '서비스 기능, 화면, 제공 범위는 운영 정책에 따라 변경될 수 있습니다.',
            '중요 변경 사항은 앱 또는 웹 화면을 통해 별도로 안내될 수 있습니다.',
        ],
    },
];

export default function TermsPage() {
    return (
        <LegalDocumentPage
            title="이용약관"
            description="Duduk 서비스 이용과 계정 사용에 관한 기본 안내입니다."
            sections={sections}
        />
    );
}
