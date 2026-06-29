// ★デバッグ用：画面の裏で起きた致命的なエラーを強制的に表示する
window.addEventListener('error', (event) => {
    document.getElementById('debug-info').innerText = `【エラー発生】${event.message}`;
    document.getElementById('debug-info').style.color = "#ff4444";
});
window.addEventListener('unhandledrejection', (event) => {
    document.getElementById('debug-info').innerText = `【通信エラー】${event.reason}`;
    document.getElementById('debug-info').style.color = "#ff4444";
});

// 最新のMediaPipeをモジュールとしてインポート
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js";

const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

let gestureRecognizer;
let lastVideoTime = -1;
let gestureHistory = [];

// パーセンテージを受け取って画面に表示するように関数を改良
function logStatus(message, percent = null, isError = false) {
    if (percent !== null) {
        debugInfo.innerText = `[${percent}%] ${message}`;
    } else {
        debugInfo.innerText = message;
    }
    debugInfo.style.color = isError ? "#ff4444" : "#00ff00";
    console.log(message);
}

// 1. AIとライブラリの初期化
async function initARSystem() {
    // スクリプトが正常に動き始めた証明
    logStatus("JS起動完了。WASMエンジンを要求中...", 10);
    
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        logStatus("エンジン準備完了。AIモデル本体をダウンロード中...", 50);

        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO"
        });
        
        logStatus("準備完了！スタートボタンを押してください。", 100);
        startBtn.addEventListener('click', startCamera);

    } catch (error) {
        logStatus(`初期化エラー: ${error.message}`, null, true);
        console.error(error);
    }
}

// 2. カメラの起動
async function startCamera() {
    logStatus("カメラ起動リクエスト中...");
    try {
        const constraints = {
            video: {
                facingMode: "environment", // 背面カメラ
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        startUI.style.opacity = '0';
        setTimeout(() => {
            startUI.style.display = 'none';
            logStatus("カメラ接続成功。手の認識を開始します！");
            video.addEventListener('loadeddata', predictLoop);
        }, 500);

    } catch (error) {
        logStatus("カメラアクセス拒否、またはHTTPS環境ではありません。", null, true);
        console.error(error);
    }
}

// 3. 毎フレームの認識ループ
function predictLoop() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        try {
            const results = gestureRecognizer.recognizeForVideo(video, performance.now());
            let currentGesture = "None";
            
            if (results.gestures && results.gestures.length > 0) {
                currentGesture = results.gestures[0][0].categoryName;
            }

            updateDebounceAndCheckTrigger(currentGesture);
        } catch (err) {
            console.error(err);
        }
    }
    requestAnimationFrame(predictLoop);
}

// 4. 仕様書要件の「グー」→「パー」検知ロジック
function updateDebounceAndCheckTrigger(currentGesture) {
    gestureHistory.push(currentGesture);
    if (gestureHistory.length > 5) {
        gestureHistory.shift();
    }

    let fistCount = 0;
    let maxConsecutiveFist = 0;
    
    for (let i = 0; i < gestureHistory.length - 1; i++) {
        if (gestureHistory[i] === "Closed_Fist") {
            fistCount++;
            if (fistCount > maxConsecutiveFist) maxConsecutiveFist = fistCount;
        } else {
            fistCount = 0;
        }
    }

    if (maxConsecutiveFist >= 3 && currentGesture === "Open_Palm") {
        logStatus("【★恐竜召喚イベント発火！★】");
        debugInfo.style.color = "#ff00ff";
    } else {
        logStatus(`現在の手: ${currentGesture}`);
    }
}

initARSystem();