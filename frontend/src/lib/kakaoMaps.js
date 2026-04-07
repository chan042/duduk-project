const KAKAO_MAPS_SCRIPT_SELECTOR = 'script[src*="dapi.kakao.com/v2/maps/sdk.js"]';
const DEFAULT_TIMEOUT_MS = 15000;

const getKakaoMaps = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    if (!window.kakao || !window.kakao.maps || typeof window.kakao.maps.load !== 'function') {
        return null;
    }

    return window.kakao.maps;
};

export const waitForKakaoMaps = (timeoutMs = DEFAULT_TIMEOUT_MS) => new Promise((resolve, reject) => {
    const maps = getKakaoMaps();
    if (maps) {
        resolve(maps);
        return;
    }

    if (typeof window === 'undefined') {
        reject(new Error('Kakao Maps SDK는 브라우저 환경에서만 사용할 수 있습니다.'));
        return;
    }

    let finished = false;
    let pollId = null;
    let timeoutId = null;
    let attachedScript = null;

    const handleLoad = () => {
        window.setTimeout(() => {
            tryResolve();
        }, 0);
    };

    const handleError = () => {
        finalize(() => reject(new Error('Kakao Maps SDK script 로드에 실패했습니다.')));
    };

    const detachScriptListeners = () => {
        if (!attachedScript) {
            return;
        }

        attachedScript.removeEventListener('load', handleLoad);
        attachedScript.removeEventListener('error', handleError);
        attachedScript = null;
    };

    const cleanup = () => {
        detachScriptListeners();

        if (pollId) {
            window.clearInterval(pollId);
        }

        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
    };

    const finalize = (handler) => {
        if (finished) {
            return;
        }

        finished = true;
        cleanup();
        handler();
    };

    const tryResolve = () => {
        const currentMaps = getKakaoMaps();
        if (!currentMaps) {
            return false;
        }

        finalize(() => resolve(currentMaps));
        return true;
    };

    const attachScriptListeners = () => {
        const script = document.querySelector(KAKAO_MAPS_SCRIPT_SELECTOR);
        if (!script || script === attachedScript) {
            return;
        }

        detachScriptListeners();
        attachedScript = script;
        attachedScript.addEventListener('load', handleLoad);
        attachedScript.addEventListener('error', handleError);
    };

    attachScriptListeners();

    if (tryResolve()) {
        return;
    }

    pollId = window.setInterval(() => {
        attachScriptListeners();
        tryResolve();
    }, 100);

    timeoutId = window.setTimeout(() => {
        finalize(() => reject(new Error(`Kakao Maps SDK가 ${timeoutMs}ms 내에 준비되지 않았습니다.`)));
    }, timeoutMs);
});

export const withLoadedKakaoMaps = async (callback, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const maps = await waitForKakaoMaps(timeoutMs);

    return new Promise((resolve, reject) => {
        try {
            maps.load(() => {
                try {
                    resolve(callback(window.kakao.maps));
                } catch (error) {
                    reject(error);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};
