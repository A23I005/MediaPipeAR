// 万が一のエラーを画面に強制表示
window.addEventListener('error', (event) => {
    const debugElement = document.getElementById('debug-info');
    if (debugElement) {
        debugElement.innerText = `【エラー】${event.message}`;
        debugElement.style.color = "#ff4444";
    }
});

// 【重要】スマホでブロックされる「import」を排除し、読み込まれたグローバル変数を使用
const mpVision = window.mpTasksVision || window.tasksVision;
const { GestureRecognizer, FilesetResolver } = mpVision;

const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');
const debugInfo = document.getElementById('debug-info');

let gestureRecognizer;
let lastVideoTime = -1;
let gestureHistory = [];

// ステータスと％を表示する関数
function logStatus(message, percent = null, isError = false) {
    if (!debugInfo) return;
    if (percent !== null) {
        debugInfo.innerText = `[${percent}%] ${message}`;
    } else {
        debugInfo.innerText = message;
    }
    debugInfo.style.color = isError ? "#ff4444" : "#00ff00";
    console.log(message);
}

// 起動直後にすぐ実行
logStatus("プログラムが起動しました", 10);

async function initARSystem() {
    try {
        logStatus("WASMエンジンを初期化中...", 30);
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        logStatus("AIモデルをダウンロード中...", 60);
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO"
        });

        logStatus("準備完了！ボタンを押してください。", 100);
        startBtn.addEventListener('click', startCamera);

    } catch (error) {
        logStatus(`初期化エラー: ${error.message}`, null, true);
    }
}

async function startCamera() {
    logStatus("カメラ起動中...");
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
            audio: false
        });
        video.srcObject = stream;
        
        startUI.style.display = 'none';
        logStatus("カメラ接続成功！手を出してください。");
        video.addEventListener('loadeddata', predictLoop);
    } catch (error) {
        logStatus("カメラへのアクセスが拒否されました", null, true);
    }
}

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
        } catch (err) {}
    }
    requestAnimationFrame(predictLoop);
}

function updateDebounceAndCheckTrigger(currentGesture) {
    gestureHistory.push(currentGesture);
    if (gestureHistory.length > 5) gestureHistory.shift();

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

// 初期化をスタート
initARSystem();