// दिल की बात — player.js
// AudioPlayer component — story audio load, play, pause, seek

/* global showMessage, formatDuration, CONFIG */

var AudioPlayer = (function () {
    // Currently active Audio element (single active player enforcement)
    var _activeAudio = null;
    // Currently loaded story
    var _currentStory = null;
    // Container element for current player UI
    var _currentContainer = null;

    /**
     * _formatTime(seconds) — seconds को MM:SS format में convert करता है
     */
    function _formatTime(seconds) {
        if (typeof formatDuration === 'function') {
            return formatDuration(seconds);
        }
        var total = Math.floor(seconds || 0);
        var m = Math.floor(total / 60).toString().padStart(2, '0');
        var s = (total % 60).toString().padStart(2, '0');
        return m + ':' + s;
    }

    /**
     * _buildPlayerHTML(story) — player UI का HTML string बनाता है
     */
    function _buildPlayerHTML(story) {
        var totalTime = _formatTime(story.duration || 0);
        return (
            '<div class="audio-player-ui" role="region" aria-label="' + story.title + ' — ऑडियो प्लेयर">' +
            '  <audio class="player-audio" preload="metadata" aria-label="' + story.title + ' ऑडियो"></audio>' +
            '  <div class="player-controls" role="group" aria-label="प्लेयर नियंत्रण">' +
            '    <button class="player-btn-play btn" aria-label="' + story.title + ' चलाएँ">▶ चलाएँ</button>' +
            '    <button class="player-btn-pause btn" aria-label="' + story.title + ' रोकें" hidden>⏸ रोकें</button>' +
            '  </div>' +
            '  <div class="player-seek-row">' +
            '    <span class="player-elapsed" aria-label="बीता समय">00:00</span>' +
            '    <input type="range" class="player-seekbar" min="0" max="' + (story.duration || 0) + '" value="0" step="1"' +
            '      aria-label="' + story.title + ' — seek bar" />' +
            '    <span class="player-total" aria-label="कुल समय">' + totalTime + '</span>' +
            '  </div>' +
            '</div>'
        );
    }

    /**
     * _wireEvents(container, audio, story) — player UI के events wire करता है
     */
    function _wireEvents(container, audio, story) {
        var btnPlay = container.querySelector('.player-btn-play');
        var btnPause = container.querySelector('.player-btn-pause');
        var seekbar = container.querySelector('.player-seekbar');
        var elapsedEl = container.querySelector('.player-elapsed');
        var totalEl = container.querySelector('.player-total');

        // Play button
        btnPlay.addEventListener('click', function () {
            AudioPlayer.play();
        });

        // Pause button
        btnPause.addEventListener('click', function () {
            AudioPlayer.pause();
        });

        // Seek bar — user drags
        seekbar.addEventListener('input', function () {
            AudioPlayer.seek(parseFloat(seekbar.value));
        });

        // Audio timeupdate — elapsed time और seekbar update
        audio.addEventListener('timeupdate', function () {
            var current = audio.currentTime || 0;
            elapsedEl.textContent = _formatTime(current);
            if (!isNaN(audio.duration) && audio.duration > 0) {
                seekbar.max = Math.floor(audio.duration);
                totalEl.textContent = _formatTime(audio.duration);
            }
            seekbar.value = Math.floor(current);
        });

        // Audio ended
        audio.addEventListener('ended', function () {
            AudioPlayer.onEnded();
        });

        // Audio error
        audio.addEventListener('error', function () {
            if (typeof showMessage === 'function') {
                showMessage('यह कहानी अभी उपलब्ध नहीं है।', 'error');
            }
        });

        // Play state sync
        audio.addEventListener('play', function () {
            btnPlay.hidden = true;
            btnPause.hidden = false;
        });

        audio.addEventListener('pause', function () {
            btnPlay.hidden = false;
            btnPause.hidden = true;
        });
    }

    /**
     * load(story) — story का audio src set करता है, player UI render करता है
     * Single active player: पिछला audio pause होता है
     */
    function load(story) {
        if (!story || !story.id) return;

        // Single active player enforcement — पिछला pause करो
        if (_activeAudio && !_activeAudio.paused) {
            _activeAudio.pause();
        }

        _currentStory = story;

        // Player container ढूँढो या बनाओ
        var containerId = 'player-' + story.id;
        var container = document.getElementById(containerId);

        if (!container) {
            // Story card के अंदर container बनाओ
            var card = document.getElementById('card-' + story.id);
            if (card) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = 'player-container';
                card.appendChild(container);
            }
        }

        if (!container) {
            // Fallback: body में append करो
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'player-container';
            document.body.appendChild(container);
        }

        // Player UI inject करो
        container.innerHTML = _buildPlayerHTML(story);
        _currentContainer = container;

        var audio = container.querySelector('.player-audio');
        _activeAudio = audio;

        // Audio src set करो
        var baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.baseUrl)
            ? CONFIG.baseUrl.replace(/\/$/, '')
            : '';
        audio.src = baseUrl ? (baseUrl + '/' + story.audioUrl) : story.audioUrl;

        // Events wire करो
        _wireEvents(container, audio, story);

        // Auto-play
        AudioPlayer.play();
    }

    /**
     * play() — audio play करता है
     */
    function play() {
        if (!_activeAudio) return;
        var playPromise = _activeAudio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(function (err) {
                // Autoplay blocked या अन्य error — silently ignore
                console.warn('AudioPlayer.play() error:', err);
            });
        }
    }

    /**
     * pause() — audio pause करता है
     */
    function pause() {
        if (!_activeAudio) return;
        _activeAudio.pause();
    }

    /**
     * seek(seconds) — audio को दिए गए position पर jump करता है
     */
    function seek(seconds) {
        if (!_activeAudio) return;
        _activeAudio.currentTime = seconds;
        // Seekbar भी update करो
        if (_currentContainer) {
            var seekbar = _currentContainer.querySelector('.player-seekbar');
            if (seekbar) seekbar.value = Math.floor(seconds);
            var elapsedEl = _currentContainer.querySelector('.player-elapsed');
            if (elapsedEl) elapsedEl.textContent = _formatTime(seconds);
        }
    }

    /**
     * onEnded() — audio खत्म होने पर seek bar reset, play button restore
     */
    function onEnded() {
        if (_currentContainer) {
            var seekbar = _currentContainer.querySelector('.player-seekbar');
            if (seekbar) seekbar.value = 0;
            var elapsedEl = _currentContainer.querySelector('.player-elapsed');
            if (elapsedEl) elapsedEl.textContent = '00:00';
            var btnPlay = _currentContainer.querySelector('.player-btn-play');
            var btnPause = _currentContainer.querySelector('.player-btn-pause');
            if (btnPlay) btnPlay.hidden = false;
            if (btnPause) btnPause.hidden = true;
        }
        if (_activeAudio) {
            _activeAudio.currentTime = 0;
        }
    }

    // Public API
    return {
        load: load,
        play: play,
        pause: pause,
        seek: seek,
        onEnded: onEnded
    };
})();

// ES module export (tests के लिए)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioPlayer;
}
