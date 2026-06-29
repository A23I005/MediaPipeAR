const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

let gestureRecognizer;
let lastVideoTime = -1;
let gestureHistory = []; // 仕様書要件：誤作動防止用の履歴バッファ

// 画面に状態やエラーを表示するデバッグ用の関数
function logStatus(message, isError = false) {
    debugInfo.innerText = message;
    debugInfo.style.color = isError ? "#ff4444" : "#00ff00";
    console.log(message);
}

// 起動ログ
logStatus("JavaScript起動成功。システム初期化中...");

// AIとライブラリの初期化
async function initARSystem() {
    try {
        // HTMLで読み込まれたMediaPipeのグローバル変数を安全に取得（tasksVisionが正解）
        const mpVision = window.tasksVision || window.mpTasksVision;
        
        if (!mpVision) {
            throw new Error("MediaPipeライブラリがブラウザに見つかりません。HTMLでの読み込みに失敗している可能性があります。");
        }

        logStatus("MediaPipeの機能を取り出しています...");
        const { GestureRecognizer, FilesetResolver } = mpVision;

        logStatus("WASMエンジンを初期化中...");
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        logStatus("AIジェスチャーモデルを読み込み中...");
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO"
        });

        logStatus("準備完了！スタートボタンを押してください。");
        
        // AIの準備がすべて完了したら、ボタンのクリックを有効化 [cite: 13]
        startBtn.addEventListener('click', startCamera);

    } catch (error) {
        // エラーが発生した場合は画面に赤文字で詳細を表示
        logStatus(`初期化エラー発生:\n${error.message}`, true);
        console.error("詳細エラー:", error);
    }
}

// カメラの起動処理
async function startCamera() {
    logStatus("カメラ起動リクエスト中...");
    try {
        const constraints = {
            video: {
                facingMode: "environment", // 仕様書推奨の背面カメラ
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // 案内UIをスムーズに非表示にする
        startUI.style.opacity = '0';
        setTimeout(() => {
            startUI.style.display = 'none';
            logStatus("カメラ接続成功。手の認識を開始します。");
            video.addEventListener('loadeddata', predictLoop);
        }, 500);

    } catch (error) {
        logStatus("カメラ起動失敗: 権限が拒否されたか、対応していない端末です。", true);
        console.error(error);
        alert("カメラへのアクセスを許可してください。");
    }
}

// 毎フレームの認識ループ
function predictLoop() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        
        try {
            // カメラ映像から手とジェスチャーを検出
            const results = gestureRecognizer.recognizeForVideo(video, performance.now());
            let currentGesture = "None";
            
            if (results.gestures && results.gestures.length > 0) {
                currentGesture = results.gestures[0][0].categoryName;
            }

            updateDebounceAndCheckTrigger(currentGesture);
        } catch (err) {
            console.error("フレーム認識エラー:", err);
        }
    }
    requestAnimationFrame(predictLoop);
}

// 仕様書に基づいた誤作動防止（デバウンス）＆状態遷移の判定
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

    // 仕様書要件：「グー」が連続3フレーム以上存在した後に「パー」が検出された場合
    if (maxConsecutiveFist >= 3 && currentGesture === "Open_Palm") {
        logStatus("【★恐竜召喚イベント発火！★】");
        debugInfo.style.color = "#ff00ff"; // 召喚時はピンクに
    } else {
        logStatus(`現在の手: ${currentGesture}\n履歴: [${gestureHistory.join(', ')}]`);
    }
}

// システムの初期化を開始
initARSystem();