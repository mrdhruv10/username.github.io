// recorder.js — RecorderScreen component
// दिल की बात — Requirements 2.1, 2.2, 2.3, 2.4, 3.1–3.7

var RecorderScreen = (function () {
    // State machine states
    var STATE = {
        IDLE: 'IDLE',
        RECORDING: 'RECORDING',
        PAUSED: 'PAUSED',
        STOPPED: 'STOPPED'
    };

    var currentState = STATE.IDLE;
    var mediaRecorder = null;
    var audioChunks = [];
    var audioBlob = null;
    var mimeType = '';
    var timerInterval = null;
    var elapsedSeconds = 0;
    var mediaStream = null;

    // Error messages (Hindi)
    var MSG_MIC_DENIED = 'माइक्रोफोन की अनुमति आवश्यक है। कृपया browser settings में अनुमति दें।';
    var MSG_NO_SUPPORT = 'आपका browser recording support नहीं करता। कृपया Chrome या Firefox उपयोग करें।';
    var MSG_RECORDER_ERROR = 'रिकॉर्डिंग में समस्या आई। कृपया पुनः प्रयास करें।';

    // ---- DOM helpers ----

    function getEl(id) {
        return document.getElementById(id);
    }

    function setTimerDisplay(seconds) {
        var el = getEl('timer-display');
        if (el) {
            el.textContent = typeof formatDuration === 'function'
                ? formatDuration(seconds)
                : (String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'));
        }
    }

    function setButtonStates(state) {
        var btnStart = getEl('btn-record-start');
        var btnPause = getEl('btn-record-pause');
        var btnStop = getEl('btn-record-stop');

        if (!btnStart || !btnPause || !btnStop) return;

        if (state === STATE.IDLE || state === STATE.STOPPED) {
            btnStart.disabled = false;
            btnStart.textContent = '🔴 रिकॉर्ड करें';
            btnPause.disabled = true;
            btnStop.disabled = true;
        } else if (state === STATE.RECORDING) {
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
        } else if (state === STATE.PAUSED) {
            btnStart.disabled = false;
            btnStart.textContent = '🔴 रिकॉर्ड करें';
            btnPause.disabled = true;
            btnStop.disabled = false;
        }
    }

    // ---- Timer ----

    function startTimer() {
        stopTimer();
        timerInterval = setInterval(function () {
            elapsedSeconds += 1;
            updateTimer();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimer() {
        setTimerDisplay(elapsedSeconds);
    }

    // ---- Stream cleanup ----

    function stopStream() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(function (track) { track.stop(); });
            mediaStream = null;
        }
    }

    // ---- Core recording functions ----

    function startRecording() {
        if (currentState !== STATE.IDLE) return;

        // MIME type detection
        mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm'))
            ? 'audio/webm'
            : 'audio/mp4';

        audioChunks = [];
        elapsedSeconds = 0;
        setTimerDisplay(0);

        try {
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mimeType });
        } catch (e) {
            showMessage(MSG_RECORDER_ERROR, 'error');
            return;
        }

        mediaRecorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };

        mediaRecorder.onerror = function () {
            stopTimer();
            showMessage(MSG_RECORDER_ERROR, 'error');
            currentState = STATE.IDLE;
            setButtonStates(STATE.IDLE);
        };

        mediaRecorder.onstop = function () {
            stopTimer();
            audioBlob = new Blob(audioChunks, { type: mimeType });

            // Preview player में load करो
            try {
                var previewPlayer = document.getElementById('preview-player');
                if (previewPlayer && typeof URL !== 'undefined' && URL.createObjectURL) {
                    previewPlayer.src = URL.createObjectURL(audioBlob);
                }
            } catch (e) {
                // URL.createObjectURL unavailable (e.g. test environment)
            }

            // UploadModule को init करो अगर available हो
            if (typeof UploadModule !== 'undefined' && UploadModule.init) {
                UploadModule.init(audioBlob, elapsedSeconds);
            }

            // Upload screen पर जाओ
            if (typeof showScreen === 'function') {
                showScreen('upload-screen');
            }
        };

        try {
            mediaRecorder.start(1000); // हर 1 second में chunk
        } catch (e) {
            showMessage(MSG_RECORDER_ERROR, 'error');
            return;
        }

        currentState = STATE.RECORDING;
        setButtonStates(STATE.RECORDING);
        startTimer();
    }

    function pauseRecording() {
        if (currentState !== STATE.RECORDING) return;
        if (!mediaRecorder) return;

        try {
            mediaRecorder.pause();
        } catch (e) {
            showMessage(MSG_RECORDER_ERROR, 'error');
            return;
        }

        stopTimer();
        currentState = STATE.PAUSED;
        setButtonStates(STATE.PAUSED);
    }

    function resumeRecording() {
        if (currentState !== STATE.PAUSED) return;
        if (!mediaRecorder) return;

        try {
            mediaRecorder.resume();
        } catch (e) {
            showMessage(MSG_RECORDER_ERROR, 'error');
            return;
        }

        currentState = STATE.RECORDING;
        setButtonStates(STATE.RECORDING);
        startTimer();
    }

    function stopRecording() {
        if (currentState !== STATE.RECORDING && currentState !== STATE.PAUSED) return;
        if (!mediaRecorder) return;

        try {
            mediaRecorder.stop();
        } catch (e) {
            showMessage(MSG_RECORDER_ERROR, 'error');
            return;
        }

        stopStream();
        currentState = STATE.STOPPED;
        setButtonStates(STATE.STOPPED);
        // onstop callback बाकी काम करेगा
    }

    // ---- Public: open() ----

    function open() {
        // getUserMedia support check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showMessage(MSG_NO_SUPPORT, 'error');
            return;
        }

        // Reset state
        currentState = STATE.IDLE;
        elapsedSeconds = 0;
        audioChunks = [];
        audioBlob = null;
        setTimerDisplay(0);
        setButtonStates(STATE.IDLE);

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                mediaStream = stream;
                if (typeof showScreen === 'function') {
                    showScreen('recorder-screen');
                }
                _bindButtons();
            })
            .catch(function (err) {
                if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                    showMessage(MSG_MIC_DENIED, 'error');
                } else {
                    showMessage(MSG_MIC_DENIED, 'error');
                }
                // Recording screen नहीं खुलती
            });
    }

    // ---- Button wiring ----

    var _buttonsWired = false;

    function _bindButtons() {
        if (_buttonsWired) return;
        _buttonsWired = true;

        var btnStart = getEl('btn-record-start');
        var btnPause = getEl('btn-record-pause');
        var btnStop = getEl('btn-record-stop');
        var btnBack = getEl('btn-recorder-back');

        if (btnStart) {
            btnStart.addEventListener('click', function () {
                if (currentState === STATE.IDLE) {
                    startRecording();
                } else if (currentState === STATE.PAUSED) {
                    resumeRecording();
                }
            });
        }

        if (btnPause) {
            btnPause.addEventListener('click', function () {
                pauseRecording();
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', function () {
                stopRecording();
            });
        }

        if (btnBack) {
            btnBack.addEventListener('click', function () {
                // Recording चल रही हो तो stop करो
                if (currentState === STATE.RECORDING || currentState === STATE.PAUSED) {
                    stopTimer();
                    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                    stopStream();
                }
                currentState = STATE.IDLE;
                _buttonsWired = false;
                if (typeof showScreen === 'function') {
                    showScreen('home-screen');
                }
            });
        }
    }

    // ---- Public API ----

    return {
        open: open,
        startRecording: startRecording,
        pauseRecording: pauseRecording,
        resumeRecording: resumeRecording,
        stopRecording: stopRecording,
        updateTimer: updateTimer,
        getState: function () { return currentState; },
        getBlob: function () { return audioBlob; },
        getMimeType: function () { return mimeType; },
        // Testing के लिए internal state reset
        _reset: function () {
            stopTimer();
            stopStream();
            currentState = STATE.IDLE;
            mediaRecorder = null;
            audioChunks = [];
            audioBlob = null;
            mimeType = '';
            elapsedSeconds = 0;
            _buttonsWired = false;
        },
        // Testing के लिए stream inject करना
        _setStream: function (stream) {
            mediaStream = stream;
        },
        STATE: STATE
    };
}());
