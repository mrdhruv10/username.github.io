// Feature: dil-ki-baat
// uploader.js — UploadModule component
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8

var UploadModule = (function () {
    var _audioBlob = null;
    var _duration = 0;

    /**
     * init(audioBlob, duration) — upload screen initialize करता है
     * RecorderScreen.stopRecording() के बाद call होता है
     */
    function init(audioBlob, duration) {
        _audioBlob = audioBlob;
        _duration = duration || 0;

        // Title input reset
        var titleInput = document.getElementById('story-title');
        if (titleInput) {
            titleInput.value = '';
        }

        // Char count reset
        var charCount = document.getElementById('char-count');
        if (charCount) {
            charCount.textContent = '0/100';
        }

        // Upload button enable
        var btnUpload = document.getElementById('btn-upload');
        if (btnUpload) {
            btnUpload.disabled = false;
        }

        // Loading indicator hide
        var loadingEl = document.getElementById('upload-loading');
        if (loadingEl) {
            loadingEl.hidden = true;
        }

        // Audio preview set करो
        var previewPlayer = document.getElementById('preview-player');
        if (previewPlayer && audioBlob) {
            var url = URL.createObjectURL(audioBlob);
            previewPlayer.src = url;
        }

        showScreen('upload-screen');
    }

    /**
     * validateTitle(title) — title validation
     * empty / whitespace / >100 chars → false
     * @param {string} title
     * @returns {boolean}
     */
    function validateTitle(title) {
        if (typeof title !== 'string') return false;
        var trimmed = title.trim();
        if (trimmed.length === 0) return false;
        if (trimmed.length > 100) return false;
        return true;
    }

    /**
     * encodeToBase64(blob) — FileReader से Blob को base64 string में encode करता है
     * @param {Blob} blob
     * @returns {Promise<string>} base64 data URL का data part (comma के बाद)
     */
    function encodeToBase64(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                // result format: "data:audio/webm;base64,AAAA..."
                var result = reader.result;
                var base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = function () {
                reject(new Error('FileReader error'));
            };
            reader.readAsDataURL(blob);
        });
    }

    /**
     * githubGet(path) — GitHub Contents API GET
     * @param {string} path — repo-relative path (e.g. 'stories.json')
     * @returns {Promise<{content: string, sha: string}>}
     */
    function githubGet(path) {
        var url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo +
            '/contents/' + path + '?ref=' + CONFIG.branch;
        return fetch(url, {
            headers: {
                'Authorization': 'token ' + CONFIG.token,
                'Accept': 'application/vnd.github.v3+json'
            }
        }).then(function (res) {
            if (!res.ok) {
                throw new Error('GitHub GET failed: ' + res.status);
            }
            return res.json();
        }).then(function (data) {
            return { content: data.content, sha: data.sha };
        });
    }

    /**
     * githubPut(path, base64Content, message, sha) — GitHub Contents API PUT
     * @param {string} path
     * @param {string} base64Content
     * @param {string} message — commit message
     * @param {string} [sha] — existing file SHA (update के लिए जरूरी)
     * @returns {Promise<void>}
     */
    function githubPut(path, base64Content, message, sha) {
        var url = 'https://api.github.com/repos/' + CONFIG.owner + '/' + CONFIG.repo +
            '/contents/' + path;
        var body = {
            message: message,
            content: base64Content,
            branch: CONFIG.branch
        };
        if (sha) {
            body.sha = sha;
        }
        return fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': 'token ' + CONFIG.token,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(function (res) {
            if (!res.ok) {
                throw new Error('GitHub PUT failed: ' + res.status);
            }
            return res.json();
        });
    }

    /**
     * _setLoading(isLoading) — loading state toggle
     * button disable/enable + indicator show/hide
     */
    function _setLoading(isLoading) {
        var btnUpload = document.getElementById('btn-upload');
        var loadingEl = document.getElementById('upload-loading');

        if (btnUpload) {
            btnUpload.disabled = isLoading;
        }
        if (loadingEl) {
            loadingEl.hidden = !isLoading;
        }
    }

    /**
     * uploadStory(title) — async upload flow
     * 1. Audio file PUT to audio/{filename}.{ext}
     * 2. stories.json GET (current SHA)
     * 3. New entry prepend, stories.json PUT
     * @param {string} title
     * @returns {Promise<void>}
     */
    function uploadStory(title) {
        // Validate title
        if (!validateTitle(title)) {
            showMessage('कृपया कहानी का शीर्षक लिखें।', 'error');
            return Promise.resolve();
        }

        _setLoading(true);

        var timestamp = Date.now();
        var filename = 'story-' + timestamp;
        var ext = (_audioBlob && _audioBlob.type && _audioBlob.type.includes('webm')) ? 'webm' : 'mp4';
        var audioPath = CONFIG.audioFolder + '/' + filename + '.' + ext;

        return encodeToBase64(_audioBlob)
            .then(function (base64Audio) {
                return githubPut(audioPath, base64Audio, 'Add story: ' + title);
            })
            .then(function () {
                return githubGet(CONFIG.storiesJsonPath);
            })
            .then(function (result) {
                var content = result.content;
                var sha = result.sha;

                // base64 decode — atob handles newlines in GitHub API response
                var decoded = atob(content.replace(/\n/g, ''));
                var storiesData = JSON.parse(decoded);

                var newStory = {
                    id: filename,
                    title: title.trim(),
                    audioUrl: audioPath,
                    date: new Date().toISOString(),
                    duration: _duration
                };
                storiesData.stories.unshift(newStory);

                var updatedJson = JSON.stringify(storiesData, null, 2);
                // UTF-8 safe base64 encode
                var base64Json = btoa(unescape(encodeURIComponent(updatedJson)));

                return githubPut(CONFIG.storiesJsonPath, base64Json, 'Update stories.json', sha);
            })
            .then(function () {
                _setLoading(false);
                showMessage('आपकी कहानी सफलतापूर्वक साझा हो गई! 🎉', 'success');
                showScreen('home-screen');
            })
            .catch(function (err) {
                console.error('Upload error:', err);
                _setLoading(false);
                showMessage('Upload नहीं हो सका। कृपया internet connection जाँचें और पुनः प्रयास करें।', 'error');
            });
    }

    return {
        init: init,
        validateTitle: validateTitle,
        encodeToBase64: encodeToBase64,
        uploadStory: uploadStory
    };
})();
