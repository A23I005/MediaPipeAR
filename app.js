// 最新のMediaPipeをモジュールとしてインポート
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js";

const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

let gestureRecognizer;
let lastVideoTime = -1;
let gestureHistory = [];

function logStatus(message, isError = false) {
    debugInfo.innerText = message;
    debugInfo.style.color = isError ? "#ff4444" : "#00ff00";
    console.log(message);
}

// 1. AIとライブラリの初期化
async function initARSystem() {
    logStatus("AIモデルをダウンロード中...");
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO"
        });

        logStatus("準備完了！スタートボタンを押してください。");
        startBtn.addEventListener('click', startCamera);

    } catch (error) {
        logStatus(`初期化エラー: ${error.message}`, true);
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
        logStatus("カメラアクセス拒否、またはHTTPS環境ではありません。", true);
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