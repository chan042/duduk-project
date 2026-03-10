import { NextResponse } from 'next/server';

/**
 * 영수증 OCR API Route
 * 클라이언트에서 이미지를 받아 네이버 Clova OCR API를 호출하고
 * 텍스트를 추출한 뒤 백엔드 Gemini 파싱 API로 전달
 */

// OCR 응답에서 텍스트 추출
function extractTextFromOCR(ocrResponse) {
    const fields = [];

    if (ocrResponse.images && ocrResponse.images.length > 0) {
        const image = ocrResponse.images[0];
        if (image.fields) {
            image.fields.forEach(field => {
                if (field.inferText) {
                    const vertices = field.boundingPoly?.vertices || [];
                    const y = vertices[0]?.y || 0;
                    const x = vertices[0]?.x || 0;
                    const height = vertices.length >= 4
                        ? Math.abs((vertices[2]?.y || 0) - (vertices[0]?.y || 0))
                        : 20;

                    fields.push({
                        text: field.inferText,
                        y,
                        x,
                        height,
                        confidence: field.inferConfidence || 0
                    });
                }
            });
        }
    }

    fields.sort((a, b) => a.y - b.y || a.x - b.x);

    const avgHeight = fields.length > 0
        ? fields.reduce((sum, f) => sum + f.height, 0) / fields.length
        : 20;
    const lineThreshold = avgHeight * 0.7;

    const lines = [];
    let currentLine = [];
    let lastY = -1000;

    fields.forEach(field => {
        if (field.y - lastY > lineThreshold && currentLine.length > 0) {
            currentLine.sort((a, b) => a.x - b.x);
            lines.push({
                text: currentLine.map(f => f.text).join(' '),
                y: currentLine[0].y,
                fields: currentLine
            });
            currentLine = [];
        }
        currentLine.push(field);
        lastY = field.y;
    });

    if (currentLine.length > 0) {
        currentLine.sort((a, b) => a.x - b.x);
        lines.push({
            text: currentLine.map(f => f.text).join(' '),
            y: currentLine[0].y,
            fields: currentLine
        });
    }

    return {
        fullText: lines.map(l => l.text).join('\n')
    };
}

export async function POST(request) {
    try {
        const { imageData, format = 'jpg', token } = await request.json();

        if (!imageData) {
            return NextResponse.json(
                { error: '이미지 데이터가 필요합니다.' },
                { status: 400 }
            );
        }

        const ocrSecret = process.env.CLOVA_OCR_SECRET;
        const ocrUrl = process.env.CLOVA_OCR_URL;

        // 환경 변수 디버깅 로그
        if (process.env.NODE_ENV === 'development') {
            console.log('[OCR] 환경 변수 확인:', {
                hasOcrSecret: !!ocrSecret,
                hasOcrUrl: !!ocrUrl,
            });
        }

        if (!ocrSecret || !ocrUrl) {
            console.error('[OCR] 환경 변수 미설정:', {
                CLOVA_OCR_SECRET: ocrSecret ? '설정됨' : '미설정',
                CLOVA_OCR_URL: ocrUrl ? '설정됨' : '미설정'
            });
            return NextResponse.json(
                { error: 'OCR 서비스 설정 오류: 환경 변수가 설정되지 않았습니다. 서버를 재시작해주세요.' },
                { status: 500 }
            );
        }

        // 네이버 Clova OCR API 호출
        const ocrRequestBody = {
            version: 'V2',
            requestId: crypto.randomUUID(),
            timestamp: Date.now(),
            images: [
                {
                    format: format,
                    name: 'receipt',
                    data: imageData
                }
            ]
        };

        const ocrResponse = await fetch(ocrUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OCR-SECRET': ocrSecret
            },
            body: JSON.stringify(ocrRequestBody)
        });

        if (!ocrResponse.ok) {
            const errorText = await ocrResponse.text();
            console.error('[OCR] Clova API 응답 오류:', {
                status: ocrResponse.status,
                statusText: ocrResponse.statusText,
                body: errorText
            });
            return NextResponse.json(
                { error: `OCR 분석에 실패했습니다. (상태: ${ocrResponse.status})` },
                { status: 500 }
            );
        }

        const ocrResult = await ocrResponse.json();

        // OCR 결과 상태 확인
        if (ocrResult.images && ocrResult.images[0]?.inferResult === 'ERROR') {
            console.error('[OCR] 이미지 분석 실패:', ocrResult.images[0]?.message);
            return NextResponse.json(
                { error: '이미지 분석에 실패했습니다. 영수증 이미지가 선명한지 확인해주세요.' },
                { status: 400 }
            );
        }

        // 텍스트 추출
        const { fullText: extractedText } = extractTextFromOCR(ocrResult);

        if (process.env.NODE_ENV === 'development') {
            console.log('[OCR] 추출 텍스트:', extractedText);
        }

        if (!extractedText) {
            return NextResponse.json(
                { error: '영수증에서 텍스트를 추출할 수 없습니다.' },
                { status: 400 }
            );
        }

        // 백엔드 Gemini 파싱 API를 호출하여 지출 정보 분석
        const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        try {
            const headers = {
                'Content-Type': 'application/json',
            };

            // 인증 토큰이 있으면 Authorization 헤더에 추가
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const aiResponse = await fetch(`${backendUrl}/api/transactions/parse/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text: extractedText })
            });

            if (!aiResponse.ok) {
                return NextResponse.json(
                    { error: `AI 분석에 실패했습니다. (상태: ${aiResponse.status})` },
                    { status: 500 }
                );
            }

            const parsedData = await aiResponse.json();

            // 파싱 실패 응답 처리
            if (parsedData.error) {
                console.error('[OCR] 파싱 실패:', parsedData.error);
                return NextResponse.json(
                    { error: parsedData.error },
                    { status: 500 }
                );
            }

            if (process.env.NODE_ENV === 'development') {
                console.log('[OCR] 파싱 성공:', parsedData);
            }

            return NextResponse.json({
                success: true,
                data: {
                    amount: parsedData.amount || 0,
                    store: parsedData.store || '',
                    item: parsedData.item || '',
                    category: parsedData.category || '기타',
                    date: parsedData.date || new Date().toISOString(),
                    address: parsedData.address || '',
                    memo: parsedData.memo || '',
                    is_fixed: parsedData.is_fixed || false
                },
                rawText: extractedText  // 디버깅용
            });
        } catch (aiError) {
            console.error('[OCR] Gemini 파싱 API 호출 오류:', aiError.message);
            return NextResponse.json(
                { error: `AI 분석 서비스 연결에 실패했습니다: ${aiError.message}` },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('[OCR] 처리 오류:', error.message, error.stack);
        return NextResponse.json(
            { error: `서버 오류가 발생했습니다: ${error.message}` },
            { status: 500 }
        );
    }
}
