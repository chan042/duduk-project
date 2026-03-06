/**
 * [파일 역할]
 * - 챗봇 관련 API 요청 함수를 모아놓은 클라이언트 모듈입니다.
 * - 세션 생성, 메시지 전송, 대화 이력 조회 기능을 제공합니다.
 */
import client from './client';

/**
 * 새 챗봇 대화 세션을 생성합니다.
 * @returns {Promise<{id: number, created_at: string, updated_at: string}>}
 */
export async function createChatSession() {
    const response = await client.post('/api/chatbot/sessions/');
    return response.data;
}

/**
 * 특정 세션에 사용자 메시지를 전송하고 AI 응답을 받습니다.
 * @param {number} sessionId - 대화 세션 ID
 * @param {string} content - 사용자가 입력한 메시지
 * @returns {Promise<{user_message: object, assistant_message: object}>}
 */
export async function sendChatMessage(sessionId, content) {
    const response = await client.post(`/api/chatbot/sessions/${sessionId}/messages/`, {
        content,
    });
    return response.data;
}

/**
 * 특정 세션의 전체 대화 이력을 조회합니다.
 * @param {number} sessionId - 대화 세션 ID
 * @returns {Promise<Array<{id: number, role: string, content: string, created_at: string}>>}
 */
export async function getChatHistory(sessionId) {
    const response = await client.get(`/api/chatbot/sessions/${sessionId}/history/`);
    return response.data;
}
