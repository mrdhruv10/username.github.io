// Feature: दिल की बात
// share.js — ShareModule: Web Share API + WhatsApp fallback + Clipboard

var ShareModule = (function () {

    /**
     * buildShareText(story) — share message बनाता है
     * Format: "{title}\n{baseUrl}/?story={id}"
     */
    function buildShareText(story) {
        var url = CONFIG.baseUrl + '/?story=' + story.id;
        return story.title + '\n' + url;
    }

    /**
     * copyToClipboard(url) — Clipboard API से URL copy करता है
     * Success पर "Link copy हो गया! ✓" confirmation दिखाता है
     */
    function copyToClipboard(url) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                showMessage('Link copy हो गया! ✓', 'success');
            }).catch(function () {
                showMessage('Link copy नहीं हो सका।', 'error');
            });
        } else {
            // Fallback: execCommand (older browsers)
            try {
                var textarea = document.createElement('textarea');
                textarea.value = url;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showMessage('Link copy हो गया! ✓', 'success');
            } catch (e) {
                showMessage('Link copy नहीं हो सका।', 'error');
            }
        }
    }

    /**
     * showFallback(story) — WhatsApp link + "Link Copy करें" button दिखाता है
     * Container id: share-fallback-{story.id}
     */
    function showFallback(story) {
        var containerId = 'share-fallback-' + story.id;
        var container = document.getElementById(containerId);
        if (!container) return;

        var shareText = buildShareText(story);
        var storyUrl = CONFIG.baseUrl + '/?story=' + story.id;
        var waUrl = 'https://wa.me/?text=' + encodeURIComponent(shareText);

        container.innerHTML =
            '<a href="' + waUrl + '" target="_blank" rel="noopener noreferrer" ' +
            'class="btn btn-whatsapp" aria-label="WhatsApp पर share करें">📲 WhatsApp</a>' +
            '<button class="btn btn-copy" aria-label="Link copy करें">🔗 Link Copy करें</button>';

        var copyBtn = container.querySelector('.btn-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                copyToClipboard(storyUrl);
            });
        }

        container.style.display = 'flex';
    }

    /**
     * share(story) — Web Share API try करता है, नहीं तो fallback दिखाता है
     * Requirements: 6.3, 6.4
     */
    function share(story) {
        var shareText = buildShareText(story);
        var storyUrl = CONFIG.baseUrl + '/?story=' + story.id;

        if (navigator.share) {
            navigator.share({
                title: story.title,
                text: shareText,
                url: storyUrl
            }).catch(function (err) {
                // User ने cancel किया या error — fallback दिखाओ
                if (err.name !== 'AbortError') {
                    showFallback(story);
                }
            });
        } else {
            showFallback(story);
        }
    }

    return {
        buildShareText: buildShareText,
        share: share,
        copyToClipboard: copyToClipboard
    };

})();
