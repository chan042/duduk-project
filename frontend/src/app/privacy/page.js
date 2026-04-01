import LegalDocumentPage from '@/components/auth/LegalDocumentPage';

const sections = [
    {
        heading: '1. 수집 항목',
        body: [
            '서비스는 로그인 식별 정보, 프로필 정보, 사용자가 직접 입력한 소비 관련 정보 등을 수집할 수 있습니다.',
            '소셜 로그인 이용 시 제공자에게서 이메일, 닉네임, 프로필 이미지 등 동의된 범위의 정보를 전달받을 수 있습니다.',
        ],
    },
    {
        heading: '2. 이용 목적',
        body: [
            '수집한 정보는 사용자 인증, 프로필 구성, 소비 분석, 맞춤형 기능 제공을 위해 사용됩니다.',
            '서비스 품질 개선과 오류 대응을 위한 운영 로그가 함께 처리될 수 있습니다.',
        ],
    },
    {
        heading: '3. 보관 및 삭제',
        body: [
            '개인정보는 서비스 제공에 필요한 기간 동안 보관되며, 법령 또는 운영 정책에 따라 삭제될 수 있습니다.',
            '회원 탈퇴 또는 삭제 요청 시 내부 정책과 법적 보관 의무를 고려해 처리됩니다.',
        ],
    },
    {
        heading: '4. 문의',
        body: [
            '개인정보 처리에 관한 문의가 필요한 경우 서비스 운영 채널을 통해 접수할 수 있습니다.',
            '실제 운영 전에는 담당자 정보와 공식 문의 수단을 문서에 명시해야 합니다.',
        ],
    },
];

export default function PrivacyPage() {
    return (
        <LegalDocumentPage
            title="개인정보처리방침"
            description="Duduk에서 수집하는 정보와 처리 목적에 대한 안내입니다."
            sections={sections}
        />
    );
}
