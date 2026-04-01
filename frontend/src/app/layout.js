/**
 * [파일 역할]
 * - 애플리케이션의 공통 레이아웃을 정의하는 파일입니다.
 * - 모든 페이지에 공통으로 적용되는 HTML 구조(html, body 태그 등)와 스타일, 폰트 등을 설정합니다.
 * - AuthProvider로 앱 전체를 감싸서 인증 상태를 전역으로 관리합니다.
 */
import './globals.css'
import Script from 'next/script'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata = {
  title: 'Duduk - 스마트 소비 관리',
  description: '당신의 소비를 스마트하게 관리하세요',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&libraries=services&autoload=false`}
          strategy="afterInteractive"
        />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
