// दिल की बात — app.js
// Main routing, screen navigation, and initialization

/**
 * showScreen(screenId) — CSS class toggle से screen switch करता है
 * Screen IDs: 'home-screen', 'recorder-screen', 'upload-screen'
 */
function showScreen(screenId) {
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function (screen) {
        screen.classList.remove('active');
    });
    var target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * showMessage(text, type) — toast notification दिखाता है
 * type: 'success' | 'error' | 'info'
 * Toast 3 seconds बाद auto-dismiss होता है
 */
function showMessage(text, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.textContent = text;

    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(function () {
        toast.classList.add('toast-fade-out');
        setTimeout(function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

/**
 * formatDuration(seconds) — seconds को MM:SS format में convert करता है
 * Examples: 0 → "00:00", 65 → "01:05", 3600 → "60:00"
 */
function formatDuration(seconds) {
    var totalSeconds = Math.floor(seconds);
    var m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    var s = (totalSeconds % 60).toString().padStart(2, '0');
    return m + ':' + s;
}

// DOM ready पर HomeScreen initialize करें और सभी event listeners wire करें
document.addEventListener('DOMContentLoaded', function () {

    // ── Home Screen ──────────────────────────────────────────
    // "🎤 अपनी कहानी रिकॉर्ड करें" → RecorderScreen.open()
    var btnRecordOpen = document.getElementById('btn-record-open');
    if (btnRecordOpen) {
        btnRecordOpen.addEventListener('click', function () {
            if (typeof RecorderScreen !== 'undefined') {
                RecorderScreen.open();
            }
        });
    }

    // ── Recorder Screen ──────────────────────────────────────
    // Back button → home screen
    var btnRecorderBack = document.getElementById('btn-recorder-back');
    if (btnRecorderBack) {
        btnRecorderBack.addEventListener('click', function () {
            showScreen('home-screen');
        });
    }

    // "⏹ बंद करें" → UploadModule.init(blob, duration)
    // RecorderScreen.stopRecording() calls UploadModule.init internally via onStop callback
    // The stop button is wired inside RecorderScreen itself; this is the fallback direct wire:
    var btnRecordStop = document.getElementById('btn-record-stop');
    if (btnRecordStop) {
        btnRecordStop.addEventListener('click', function () {
            if (typeof RecorderScreen !== 'undefined') {
                RecorderScreen.stopRecording();
            }
        });
    }

    // ── Upload Screen ─────────────────────────────────────────
    // Back button → recorder screen
    var btnUploadBack = document.getElementById('btn-upload-back');
    if (btnUploadBack) {
        btnUploadBack.addEventListener('click', function () {
            showScreen('recorder-screen');
        });
    }

    // "📤 कहानी साझा करें" → UploadModule.uploadStory(title)
    var btnUpload = document.getElementById('btn-upload');
    if (btnUpload) {
        btnUpload.addEventListener('click', function () {
            if (typeof UploadModule !== 'undefined') {
                var title = document.getElementById('story-title');
                UploadModule.uploadStory(title ? title.value : '');
            }
        });
    }

    // Char-count update on title input
    var storyTitle = document.getElementById('story-title');
    var charCount = document.querySelector('.char-count');
    if (storyTitle && charCount) {
        storyTitle.addEventListener('input', function () {
            charCount.textContent = storyTitle.value.length + ' / 100';
        });
    }

    // ── Initialize HomeScreen ─────────────────────────────────
    if (typeof HomeScreen !== 'undefined' && HomeScreen.init) {
        HomeScreen.init();
    }
});

// ============================================================
// HomeScreen — story list fetch, render, deep link handling
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.2, 7.3, 8.1, 8.2
// ============================================================

var HomeScreen = (function () {

    /**
     * _getStoriesUrl(cacheBust) — GitHub API URL बनाता है
     * cacheBust: true होने पर &t={Date.now()} append होता है
     */
    function _getStoriesUrl(cacheBust) {
        var url = 'https://api.github.com/repos/' +
            CONFIG.owner + '/' + CONFIG.repo +
            '/contents/' + CONFIG.storiesJsonPath +
            '?ref=' + CONFIG.branch;
        if (cacheBust) {
            url += '&t=' + Date.now();
        }
        return url;
    }

    /**
     * _formatDate(isoString) — ISO date को readable Hindi format में convert करता है
     */
    function _formatDate(isoString) {
        try {
            var d = new Date(isoString);
            return d.toLocaleDateString('hi-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return isoString;
        }
    }

    /**
     * renderStories(stories) — story cards DOM में inject करता है
     * Requirements: 1.3
     */
    function renderStories(stories) {
        var container = document.getElementById('story-list');
        if (!container) return;

        // Empty state
        if (!stories || stories.length === 0) {
            container.innerHTML =
                '<p class="empty-message" role="status">' +
                'अभी तक कोई कहानी नहीं है। पहली कहानी आप सुनाएँ!' +
                '</p>';
            return;
        }

        var html = '<ul class="story-cards" role="list">';
        stories.forEach(function (story) {
            var formattedDate = _formatDate(story.date);
            var formattedDuration = (typeof formatDuration === 'function')
                ? formatDuration(story.duration || 0)
                : '00:00';

            html +=
                '<li id="card-' + story.id + '" class="story-card" role="listitem">' +
                '  <div class="story-card-title">' + story.title + '</div>' +
                '  <div class="story-card-meta">' +
                '    <span class="story-date">' + formattedDate + '</span>' +
                '    <span class="story-duration">' + formattedDuration + '</span>' +
                '  </div>' +
                '  <div class="story-card-actions">' +
                '    <button id="btn-play-' + story.id + '" class="btn btn-play"' +
                '      aria-label="' + story.title + ' सुनें">' +
                '      ▶ सुनें' +
                '    </button>' +
                '    <button id="btn-share-' + story.id + '" class="btn btn-share"' +
                '      aria-label="' + story.title + ' share करें">' +
                '      📲 Share' +
                '    </button>' +
                '  </div>' +
                '  <div id="share-fallback-' + story.id + '" class="share-fallback" style="display:none;"></div>' +
                '</li>';
        });
        html += '</ul>';

        container.innerHTML = html;

        // Event listeners wire करो
        stories.forEach(function (story) {
            var playBtn = document.getElementById('btn-play-' + story.id);
            if (playBtn) {
                playBtn.addEventListener('click', function () {
                    if (typeof AudioPlayer !== 'undefined') {
                        AudioPlayer.load(story);
                    }
                });
            }

            var shareBtn = document.getElementById('btn-share-' + story.id);
            if (shareBtn) {
                shareBtn.addEventListener('click', function () {
                    if (typeof ShareModule !== 'undefined') {
                        ShareModule.share(story);
                    }
                });
            }
        });
    }

    /**
     * handleDeepLink(stories) — URL ?story={id} parse करके matching story auto-load करता है
     * Requirements: 8.1, 8.2
     */
    function handleDeepLink(stories) {
        var params = new URLSearchParams(window.location.search);
        var storyId = params.get('story');

        if (!storyId) return;

        var story = stories.find(function (s) { return s.id === storyId; });
        if (story) {
            if (typeof AudioPlayer !== 'undefined') {
                AudioPlayer.load(story);
            }
            var card = document.getElementById('card-' + storyId);
            if (card && typeof card.scrollIntoView === 'function') {
                try { card.scrollIntoView({ behavior: 'smooth' }); } catch (e) { /* jsdom */ }
            }
        } else {
            if (typeof showMessage === 'function') {
                showMessage('यह कहानी उपलब्ध नहीं है।', 'error');
            }
        }
    }

    /**
     * loadStories(cacheBust) — GitHub से stories.json fetch करता है
     * descending date sort करके renderStories() call करता है
     * Requirements: 1.2, 7.3
     */
    function loadStories(cacheBust) {
        var url = _getStoriesUrl(!!cacheBust);

        fetch(url)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                // GitHub API: content base64 encoded होता है
                var stories = [];
                if (data && data.content) {
                    var decoded = atob(data.content.replace(/\n/g, ''));
                    var parsed = JSON.parse(decoded);
                    stories = (parsed && parsed.stories) ? parsed.stories : [];
                } else if (data && data.stories) {
                    // Direct JSON (tests के लिए)
                    stories = data.stories;
                }

                // Descending date sort (newest first)
                stories.sort(function (a, b) {
                    return new Date(b.date) - new Date(a.date);
                });

                renderStories(stories);
                handleDeepLink(stories);
            })
            .catch(function () {
                if (typeof showMessage === 'function') {
                    showMessage('कहानियाँ लोड नहीं हो सकीं, कृपया पुनः प्रयास करें', 'error');
                }
                var container = document.getElementById('story-list');
                if (container) {
                    container.innerHTML =
                        '<p class="error-message" role="alert">' +
                        'कहानियाँ लोड नहीं हो सकीं, कृपया पुनः प्रयास करें' +
                        '</p>';
                }
            });
    }

    /**
     * init() — DOM ready पर call होता है
     * loadStories() call + refresh button handler
     * Requirements: 1.1, 7.2
     */
    function init() {
        loadStories(false);

        // Refresh button handler — cache-busting fetch
        var refreshBtn = document.getElementById('btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                loadStories(true);
            });
        }
    }

    return {
        init: init,
        loadStories: loadStories,
        renderStories: renderStories,
        handleDeepLink: handleDeepLink,
        _getStoriesUrl: _getStoriesUrl  // tests के लिए expose
    };

})();

// ES module export (tests के लिए)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HomeScreen: HomeScreen, showMessage: showMessage, formatDuration: formatDuration };
}
