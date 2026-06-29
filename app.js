const video = document.getElementById('webcam');
const startUI = document.getElementById('start-ui');
const startBtn = document.getElementById('start-btn');

// カメラを起動する関数
async function startCamera() {
    try {
        // 解像度720p以上、30fps以上を推奨する設定
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // カメラが起動したら案内UIを非表示にする
        startUI.style.opacity = '0';
        setTimeout(() => {
            startUI.style.display = 'none';
        }, 500);

    } catch (error) {
        console.error("カメラの起動に失敗しました:", error);
        alert("カメラへのアクセスを許可してください。");
    }
}

// ボタンクリックで起動
startBtn.addEventListener('click', startCamera);