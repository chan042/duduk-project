/**
 * [파일 역할]
 * - 인증 페이지(로그인, 회원가입)의 공통 레이아웃을 정의합니다.
 * - 메인 앱과 다른 심플한 디자인을 적용합니다.
 */

export default function AuthLayout({ children }) {
    return (
        <div style={{
            backgroundColor: '#FFFFFF',
            minHeight: '100vh',
            width: '100%'
        }}>
            {children}
        </div>
    );
}
