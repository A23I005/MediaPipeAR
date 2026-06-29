const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

// 画面に現在の状態やエラーをリアルタイム表示するヘルパー関数
function logStatus(message, isError = false) {
    debugInfo.innerText = message;
    debugInfo.style.color = isError ? "#ff4444" : "#00ff00";
    console.log(message);
}

// 起動直後に即座に状態を更新（スクリプトが無事に動いている証拠になります）
logStatus("JavaScript起動成功。AIライブラリをダウンロード中...");

let gestureRecognizer;
let lastVideoTime = -1;
let gestureHistory = []; // 仕様書要件：誤作動防止用の履歴バッファ [cite: 60, 61]

// AIとライブラリの初期化
async function initARSystem() {
    try {
        // 1. スマートフォンでも確実に動作する動的インポートを採用
        logStatus("MediaPipeライブラリを読み込み中...");
        const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js");
        const { GestureRecognizer, FilesetResolver } = visionModule;

        // 2. WASMアセットの読み込み
        logStatus("WASMエンジンを初期化中...");
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        // 3. ジェスチャー認識モデルの読み込み
        logStatus("AIジェスチャーモデルを読み込み中...");
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO"
        });

        logStatus("準備完了！スタートボタンを押してください。");
        
        // AIの準備がすべて完了してから、初めてボタンのクリックイベントを有効化する（安全対策）
        startBtn.addEventListener('click', startCamera);

    } catch (error) {
        // 万が一エラーが発生した場合は、画面に赤文字でエラー内容を吐き出します
        logStatus(`初期化エラー発生:\n${error.message}\nページを再読み込みしてください。`, true);
        console.error("詳細エラー:", error);
    }
}

// カメラの起動処理
async function startCamera() {
    logStatus("カメラ起動リクエスト中...");
    try {
        const constraints = {
            video: {
                facingMode: "environment", // 仕様書推奨の背面カメラ [cite: 46]
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // 案内UIをスムーズに非表示
        startUI.style.opacity = '0';
        setTimeout(() => {
            startUI.style.display = 'none';
            logStatus("カメラ接続成功。手認識を開始します。");
            video.addEventListener('loadeddata', predictLoop);
        }, 500);

    } catch (error) {
        logStatus("カメラ起動失敗: 権限が拒否されたか、対応端末ではありません。", true);
        console.error(error);
        alert("カメラへのアクセスを許可してください。");
    }
}

// 毎フレームの認識ループ
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
            console.error("認識フレームエラー:", err);
        }
    }
    requestAnimationFrame(predictLoop);
}

// 誤作動防止（デバウンス）＆状態遷移の判定 [cite: 53, 60]
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
        debugInfo.style.color = "#ff00ff"; // 召喚時はピンク色に
    } else {
        logStatus(`現在の手: ${currentGesture}\n履歴バッファ: [${gestureHistory.join(', ')}]`);
    }
}

// システムの初期化処理を実行
initARSystem();