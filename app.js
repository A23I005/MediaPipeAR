// MediaPipe Taskライブラリのインポート 
import { GestureRecognizer, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js";

const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

let gestureRecognizer;
let lastVideoTime = -1;

// 仕様書要件：誤作動防止（デバウンス）用の履歴バッファ [cite: 60, 61]
let gestureHistory = []; 

// 1. MediaPipeの初期化
async function initAndroidAI() {
    debugInfo.innerText = "AIモデルを読み込み中...";
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
        debugInfo.innerText = "準備完了！スタートボタンを押してください。";
    } catch (e) {
        debugInfo.innerText = "AIの初期化に失敗しました。";
        console.error(e);
    }
}

// 2. カメラの起動
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: "environment",
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
            // カメラが映ったら毎フレームの認識ループを開始
            video.addEventListener('loadeddata', predictLoop);
        }, 500);

    } catch (error) {
        console.error("カメラの起動に失敗しました:", error);
        alert("カメラへのアクセスを許可してください。");
    }
}

// 3. 毎フレームの認識ループ
function predictLoop() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        // カメラ映像から手とジェスチャーを検出 [cite: 36, 44]
        const results = gestureRecognizer.recognizeForVideo(video, performance.now());
        
        let currentGesture = "None";
        
        // 手が検出された場合
        if (results.gestures && results.gestures.length > 0) {
            currentGesture = results.gestures[0][0].categoryName; // "Closed_Fist", "Open_Palm" など
        }

        // デバウンス処理の実装 [cite: 60]
        updateDebounceAndCheckTrigger(currentGesture);
    }
    // 次のフレームを要求
    requestAnimationFrame(predictLoop);
}

// 4. 仕様書に基づいた誤作動防止（デバウンス）＆状態遷移の判定 [cite: 53, 60]
function updateDebounceAndCheckTrigger(currentGesture) {
    // 過去5フレーム分の履歴を保持 [cite: 61]
    gestureHistory.push(currentGesture);
    if (gestureHistory.length > 5) {
        gestureHistory.shift();
    }

    // 「グー」が連続して3フレーム以上存在したかをカウント [cite: 62]
    let fistCount = 0;
    let maxConsecutiveFist = 0;
    
    // 直前の履歴（現フレームを除く4フレーム分）の中で、連続する「Closed_Fist」の最大数を調べる
    for (let i = 0; i < gestureHistory.length - 1; i++) {
        if (gestureHistory[i] === "Closed_Fist") {
            fistCount++;
            if (fistCount > maxConsecutiveFist) maxConsecutiveFist = fistCount;
        } else {
            fistCount = 0;
        }
    }

    // 仕様書要件：「グー」が連続3フレーム以上存在した後に「パー」が検出された場合 [cite: 62]
    if (maxConsecutiveFist >= 3 && currentGesture === "Open_Palm") {
        debugInfo.innerText = "【★恐竜召喚イベント発火！★】";
        debugInfo.style.color = "#ff00ff"; // 召喚時はピンク色に
    } else {
        // 通常時の状態表示
        debugInfo.innerText = `現在の手: ${currentGesture}\n履歴バッファ: [${gestureHistory.join(', ')}]`;
        debugInfo.style.color = "#00ff00";
    }
}

// 最初にAIの読み込みを開始
initAndroidAI();

// ボタンクリックでカメラ起動
startBtn.addEventListener('click', startCamera);