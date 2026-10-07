// =========================================
// CHARAN MEDIA — Video & Audio Downloader
// Modular Platform Architecture
// =========================================

'use strict';

// ─────────────────────────────────────────
// PLATFORM MANAGER — Modular Configuration
// ─────────────────────────────────────────

const PlatformManager = {
    platforms: {
        youtube: {
            name: 'YouTube',
            label: 'YouTube Video & Audio Downloader',
            placeholder: 'https://www.youtube.com/watch?v=...',
            domains: ['youtube.com', 'youtu.be'],
            color: '#ff4040',
            validator: (url) => {
                const h = getHost(url);
                return h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be';
            },
        },
        instagram: {
            name: 'Instagram',
            label: 'Instagram Video & Audio Downloader',
            placeholder: 'https://www.instagram.com/p/...',
            domains: ['instagram.com'],
            color: '#e1306c',
            validator: (url) => {
                const h = getHost(url);
                return h === 'instagram.com' || h.endsWith('.instagram.com');
            },
        },
        whatsapp: {
            name: 'WhatsApp',
            label: 'WhatsApp Media Downloader',
            placeholder: 'Paste a WhatsApp media link here',
            domains: ['whatsapp.com', 'wa.me'],
            color: '#25d366',
            validator: (url) => {
                const h = getHost(url);
                return h === 'whatsapp.com' || h.endsWith('.whatsapp.com') || h === 'wa.me';
            },
        },
        facebook: {
            name: 'Facebook',
            label: 'Facebook Video & Audio Downloader',
            placeholder: 'https://www.facebook.com/video/...',
            domains: ['facebook.com', 'fb.watch'],
            color: '#1877f2',
            validator: (url) => {
                const h = getHost(url);
                return h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.watch';
            },
        },
        other: {
            name: 'Other',
            label: 'Video & Audio Downloader',
            placeholder: 'Paste any supported video link here',
            domains: ['vimeo.com', 'dailymotion.com', 'twitch.tv', 'tiktok.com', 'twitter.com', 'x.com'],
            color: '#38bdf8',
            validator: (url) => {
                const h = getHost(url);
                const extra = ['vimeo.com','dailymotion.com','twitch.tv','tiktok.com','twitter.com','x.com'];
                return extra.some(d => h === d || h.endsWith('.' + d));
            },
        },
    },

    detectFromUrl(url) {
        for (const [key, cfg] of Object.entries(this.platforms)) {
            if (cfg.validator(url)) return key;
        }
        return null;
    },

    get(platformKey) {
        return this.platforms[platformKey] || null;
    },
};

function getHost(url) {
    try {
        return new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

function isValidUrl(url) {
    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────

const state = {
    currentPlatform: 'youtube',
    selectedType: null,      // 'mp3' | 'mp4' | null
    analyzed: false,
    analysisData: null,
};

// ─────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────

const $ = id => document.getElementById(id);

function show(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
function hide(id) { const el = $(id); if (el) el.classList.add('hidden'); }

function setAnalyzeStatus(msg, type = '') {
    const el = $('analyzeStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'analyze-status' + (type ? ' ' + type : '');
}

function setDownloadStatus(msg, type = '') {
    const el = $('downloadStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'download-status' + (type ? ' ' + type : '');
    if (msg) show('downloadStatus'); else hide('downloadStatus');
}

// ─────────────────────────────────────────
// PLATFORM TABS
// ─────────────────────────────────────────

function selectTab(platformKey) {
    state.currentPlatform = platformKey;
    state.analyzed = false;
    state.analysisData = null;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === platformKey);
        btn.setAttribute('aria-selected', btn.dataset.tab === platformKey ? 'true' : 'false');
    });

    // Update label and placeholder
    const cfg = PlatformManager.get(platformKey);
    const label = $('platformLabel');
    const input = $('mediaUrl');
    if (label && cfg) label.textContent = cfg.label;
    if (input && cfg) input.placeholder = cfg.placeholder;

    // Reset UI
    hide('mediaInfo');
    hide('qualityPanel');
    hide('downloadButtons');
    hide('downloadStatus');
    hide('downloadResult');
    setAnalyzeStatus('');
}

// Open downloader from platform card
function openDownloader(platformKey, type) {
    document.querySelector('#downloader').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
        selectTab(platformKey);
        if (type !== 'both') {
            selectType(type === 'mp3' ? 'mp3' : 'mp4');
        }
        // Update tab button visually
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === platformKey);
        });
    }, 400);
}

// ─────────────────────────────────────────
// DOWNLOAD TYPE SELECTOR
// ─────────────────────────────────────────

function selectType(type) {
    state.selectedType = type;

    const audioCard = $('typeAudio');
    const videoCard = $('typeVideo');
    const checkAudio = $('checkAudio');
    const checkVideo = $('checkVideo');

    if (type === 'mp3') {
        audioCard.classList.add('selected-type');
        videoCard.classList.remove('selected-type');
        checkAudio.classList.add('checked');
        checkVideo.classList.remove('checked');
        audioCard.setAttribute('aria-pressed', 'true');
        videoCard.setAttribute('aria-pressed', 'false');
    } else {
        videoCard.classList.add('selected-type');
        audioCard.classList.remove('selected-type');
        checkVideo.classList.add('checked');
        checkAudio.classList.remove('checked');
        videoCard.setAttribute('aria-pressed', 'true');
        audioCard.setAttribute('aria-pressed', 'false');
    }

    // Show/hide quality rows based on type
    if (state.analyzed) {
        updateQualityVisibility(type);
    }
}

function updateQualityVisibility(type) {
    const audioRow = $('audioQualityRow');
    const videoRow = $('videoQualityRow');
    if (!audioRow || !videoRow) return;
    audioRow.style.display = type === 'mp3' ? '' : 'none';
    videoRow.style.display = type === 'mp4' ? '' : 'none';
}

// ─────────────────────────────────────────
// PASTE FROM CLIPBOARD
// ─────────────────────────────────────────

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const input = $('mediaUrl');
        if (input && text.trim()) {
            input.value = text.trim();
            setAnalyzeStatus('Link pasted — click Analyze Link to continue.', 'info');
        }
    } catch {
        setAnalyzeStatus('Paste manually: Ctrl+V (clipboard permission not available).', '');
    }
}

// ─────────────────────────────────────────
// ANALYZE LINK
// ─────────────────────────────────────────

async function analyzeLink() {
    const urlInput = $('mediaUrl');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        setAnalyzeStatus('Please paste a link first.', 'error');
        return;
    }

    if (!isValidUrl(url)) {
        setAnalyzeStatus('That does not look like a valid URL. Please paste a complete https:// link.', 'error');
        return;
    }

    // Auto-detect platform from URL if possible
    const detected = PlatformManager.detectFromUrl(url);
    if (detected && detected !== state.currentPlatform) {
        selectTab(detected);
    }

    const cfg = PlatformManager.get(state.currentPlatform);

    // Validate against selected platform
    if (cfg && !cfg.validator(url)) {
        // Allow for 'other' category — just check it's http/https
        const allKnown = Object.values(PlatformManager.platforms).some(p => p.validator(url));
        if (allKnown && state.currentPlatform === 'other') {
            // fine
        } else if (!allKnown && state.currentPlatform !== 'other') {
            setAnalyzeStatus(`This link does not appear to be from ${cfg.name}. Switch to the correct platform tab.`, 'error');
            return;
        }
    }

    // Proceed to analyze via backend
    const analyzeBtn = $('analyzeBtn');
    if (analyzeBtn) { analyzeBtn.disabled = true; analyzeBtn.textContent = '🔍 Analyzing…'; }

    hide('mediaInfo');
    hide('qualityPanel');
    hide('downloadButtons');
    hide('downloadStatus');
    hide('downloadResult');
    setAnalyzeStatus('Fetching media information…', 'info');

    try {
        const base = await getServerBase();
        if (!base) {
            throw new Error('Conversion server is not running. Start the server first.');
        }

        const formData = new FormData();
        formData.append('url', url);

        const res = await fetch(`${base}/analyze-url`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.detail || `Server error (${res.status})`);
        }

        // Populate media info panel
        state.analyzed = true;
        state.analysisData = { url, info: data };

        const platformCfg = PlatformManager.get(state.currentPlatform);

        // Thumbnail
        const thumb = $('mediaThumbnail');
        const thumbPlaceholder = $('thumbPlaceholder');
        if (data.thumbnail) {
            if (thumb) { thumb.src = data.thumbnail; thumb.classList.remove('hidden'); }
            if (thumbPlaceholder) thumbPlaceholder.classList.add('hidden');
        } else {
            if (thumb) thumb.classList.add('hidden');
            if (thumbPlaceholder) thumbPlaceholder.classList.remove('hidden');
        }

        const titleEl = $('mediaTitle');
        if (titleEl) titleEl.textContent = data.title || 'Media';

        const badgeEl = $('platformBadge');
        if (badgeEl) badgeEl.textContent = (platformCfg && platformCfg.name) || 'Media';

        const durationEl = $('mediaDuration');
        if (durationEl) {
            if (data.duration) {
                const secs = Math.round(data.duration);
                const m = Math.floor(secs / 60);
                const s = secs % 60;
                durationEl.textContent = `⏱ ${m}:${s.toString().padStart(2, '0')}`;
            } else {
                durationEl.textContent = '⏱ —';
            }
        }

        const formatsEl = $('mediaFormats');
        if (formatsEl) {
            const fmts = [];
            if (data.has_audio !== false) fmts.push('MP3');
            if (data.has_video !== false) fmts.push('MP4');
            formatsEl.textContent = '📁 ' + (fmts.join(', ') || 'MP3, MP4');
        }

        show('mediaInfo');

        // Quality panel
        if (state.selectedType) {
            updateQualityVisibility(state.selectedType);
        }
        show('qualityPanel');
        show('downloadButtons');

        // Disable MP4 if no video
        const mp4Btn = $('downloadMp4Btn');
        if (mp4Btn) {
            mp4Btn.disabled = (data.has_video === false);
            mp4Btn.title = (data.has_video === false) ? 'Video not available for this link' : '';
        }

        setAnalyzeStatus(`✓ ${data.title || 'Media'} found — choose your download format below.`, 'success');

    } catch (err) {
        setAnalyzeStatus(err.message || 'Could not analyze this link.', 'error');
    } finally {
        if (analyzeBtn) { analyzeBtn.disabled = false; analyzeBtn.textContent = '🔍 Analyze Link'; }
    }
}

// ─────────────────────────────────────────
// SERVER BASE DISCOVERY
// ─────────────────────────────────────────

async function getServerBase() {
    const candidates = [];
    if (window.location.origin && window.location.origin.startsWith('http')) {
        candidates.push(window.location.origin);
    }
    candidates.push('http://127.0.0.1:8000', 'http://localhost:8000');
    const unique = [...new Set(candidates)];

    for (const base of unique) {
        try {
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 3000);
            const r = await fetch(`${base.replace(/\/$/, '')}/health`, { signal: ctrl.signal });
            clearTimeout(tid);
            if (r.ok) return base.replace(/\/$/, '');
        } catch { /* keep trying */ }
    }
    return null;
}

// ─────────────────────────────────────────
// TRIGGER DOWNLOAD — MP3 or MP4 independently
// ─────────────────────────────────────────

async function triggerDownload(type) {
    if (!state.analyzed || !state.analysisData) {
        setDownloadStatus('Please analyze a link first.', 'error');
        return;
    }

    const { url } = state.analysisData;
    const audioQuality = $('audioQuality') ? $('audioQuality').value : '192k';
    const videoQuality = $('videoQuality') ? $('videoQuality').value : '720p';

    const btn = type === 'mp3' ? $('downloadMp3Btn') : $('downloadMp4Btn');
    if (btn) { btn.disabled = true; btn.textContent = type === 'mp3' ? '🎵 Downloading MP3…' : '🎬 Downloading MP4…'; }

    hide('downloadResult');
    setDownloadStatus(`Processing ${type.toUpperCase()}…`, 'info');

    try {
        const base = await getServerBase();
        if (!base) throw new Error('Server not running. Start the conversion server.');

        const endpoint = type === 'mp3' ? '/download-mp3' : '/download-mp4';
        const formData = new FormData();
        formData.append('url', url);
        formData.append('quality', type === 'mp3' ? audioQuality : videoQuality);

        const res = await fetch(`${base}${endpoint}`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.detail || `Download failed (${res.status})`);
        }

        let downloadUrl = data.download_url;
        if (downloadUrl && !downloadUrl.startsWith('http')) {
            downloadUrl = `${base}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
        }

        if (type === 'mp3') {
            show('downloadResult');
            const mp3Row = $('mp3Result');
            if (mp3Row) mp3Row.classList.remove('hidden');
            hide('mp4Result');

            const link = $('mp3DownloadLink');
            if (link) { link.href = downloadUrl; link.download = data.filename || 'audio.mp3'; }

            const preview = $('audioPreview');
            if (preview) { preview.src = downloadUrl; preview.load(); }

        } else {
            show('downloadResult');
            const mp4Row = $('mp4Result');
            if (mp4Row) mp4Row.classList.remove('hidden');

            const link = $('mp4DownloadLink');
            if (link) { link.href = downloadUrl; link.download = data.filename || 'video.mp4'; }
        }

        setDownloadStatus(`✓ ${type.toUpperCase()} ready! Click the button below to download.`, 'success');

    } catch (err) {
        setDownloadStatus(err.message || 'Download failed.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = type === 'mp3' ? '🎵 Download MP3' : '🎬 Download MP4';
        }
    }
}

// ─────────────────────────────────────────
// SERVER STATUS BADGE
// ─────────────────────────────────────────

async function checkServerStatus() {
    const base = await getServerBase();
    const badge = $('serverBadge');
    const text = $('badgeText');
    if (!badge || !text) return;

    if (base) {
        try {
            const r = await fetch(`${base}/health`);
            const d = await r.json().catch(() => ({}));
            badge.className = 'server-badge online';
            text.textContent = d.ffmpeg === 'ready' ? '⚡ FFmpeg Ready' : '⚡ Server Online';
        } catch {
            badge.className = 'server-badge';
            text.textContent = '🌐 Browser Mode';
        }
    } else {
        badge.className = 'server-badge';
        text.textContent = '🌐 Browser Mode';
    }
}

checkServerStatus();
setInterval(checkServerStatus, 20000);

// ─────────────────────────────────────────
// LOCAL FILE CONVERSION (legacy + new)
// ─────────────────────────────────────────

function setStatus(msg, type = '') {
    const el = $('status');
    if (!el) return;
    el.textContent = msg;
    el.className = type ? `status ${type}` : 'status';
}

function getDownloadName(fileName, ext = 'mp3') {
    const base = (fileName || 'converted-audio')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'converted-audio';
    return `${base}.${ext}`;
}

async function convertLocalFile() {
    const fileInput = $('localFile');
    const quality = $('quality');
    const convertBtn = $('convertBtn');
    const resultDiv = $('result');

    const selectedFile = fileInput && fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;

    if (!selectedFile) {
        setStatus('Choose a video file first.', 'error');
        return;
    }

    if (selectedFile.size === 0) {
        setStatus('Selected file is empty (0 bytes).', 'error');
        return;
    }

    const qualityValue = (quality && quality.value) ? quality.value : '192k';
    const bitrateNum = parseInt(qualityValue, 10) || 192;

    if (convertBtn) { convertBtn.disabled = true; convertBtn.textContent = 'Converting…'; }
    if (resultDiv) resultDiv.classList.add('hidden');
    setStatus('Converting file to audio…', 'info');

    try {
        // Try server backend first
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('quality', qualityValue);

        const base = await getServerBase();
        if (base) {
            setStatus('Uploading to conversion engine…', 'info');
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 120000);
            const res = await fetch(`${base}/convert`, {
                method: 'POST',
                body: formData,
                signal: ctrl.signal,
            });
            clearTimeout(tid);

            if (res.ok) {
                const data = await res.json();
                let dlUrl = data.download_url;
                if (dlUrl && !dlUrl.startsWith('http')) dlUrl = `${base}${dlUrl.startsWith('/') ? '' : '/'}${dlUrl}`;

                const preview = $('localAudioPreview');
                const link = $('downloadLink');
                if (preview) { preview.src = dlUrl; preview.load(); }
                if (link) { link.href = dlUrl; link.download = data.filename || getDownloadName(selectedFile.name, 'mp3'); }
                setStatus('Conversion complete!', 'success');
                if (resultDiv) resultDiv.classList.remove('hidden');
                return;
            } else {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Server conversion failed.');
            }
        }

        // Browser-side fallback
        setStatus('Using in-browser audio extraction…', 'info');
        const audioBuffer = await extractAudioBufferFromVideo(selectedFile);

        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error('No audio track found in this file.');
        }

        let blob, ext;
        if (typeof lamejs !== 'undefined') {
            setStatus(`Encoding to MP3 (${bitrateNum} kbps)…`, 'info');
            blob = encodePcmToMp3(audioBuffer, bitrateNum);
            ext = 'mp3';
        } else {
            setStatus('Encoding to WAV…', 'info');
            blob = encodePcmToWav(audioBuffer);
            ext = 'wav';
        }

        const objUrl = URL.createObjectURL(blob);
        const name = getDownloadName(selectedFile.name, ext);

        const preview = $('localAudioPreview');
        const link = $('downloadLink');
        if (preview) { preview.src = objUrl; preview.load(); }
        if (link) { link.href = objUrl; link.download = name; }

        setStatus(`Done! ${ext.toUpperCase()} (${(blob.size / 1024).toFixed(0)} KB)`, 'success');
        if (resultDiv) resultDiv.classList.remove('hidden');

    } catch (err) {
        console.error('Local conversion error:', err);
        setStatus(err.message || 'Conversion failed.', 'error');
    } finally {
        if (convertBtn) { convertBtn.disabled = false; convertBtn.textContent = 'Convert Local File to MP3'; }
    }
}

// ─────────────────────────────────────────
// LOCAL FILE — DRAG & DROP
// ─────────────────────────────────────────

const uploadArea = $('uploadArea');
const localFile = $('localFile');
const fileLabel = $('fileLabel');

if (localFile) {
    localFile.addEventListener('change', function () {
        if (!localFile.files || localFile.files.length === 0) {
            if (fileLabel) fileLabel.textContent = 'Choose a video file';
            setStatus('');
            return;
        }
        const f = localFile.files[0];
        if (fileLabel) fileLabel.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
        setStatus(`Ready: ${f.name}`, 'info');
    });
}

if (uploadArea) {
    ['dragenter', 'dragover'].forEach(ev =>
        uploadArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.add('drag-over'); })
    );
    ['dragleave', 'drop'].forEach(ev =>
        uploadArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); uploadArea.classList.remove('drag-over'); })
    );
    uploadArea.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0 && localFile) {
            localFile.files = dt.files;
            const f = dt.files[0];
            if (fileLabel) fileLabel.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
            setStatus(`Ready: ${f.name}`, 'info');
        }
    });
}

// ─────────────────────────────────────────
// KEYBOARD ACCESSIBILITY — TYPE CARDS
// ─────────────────────────────────────────

document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const type = card.id === 'typeAudio' ? 'mp3' : 'mp4';
            selectType(type);
        }
    });
});

// ─────────────────────────────────────────
// ANALYZE ON ENTER KEY
// ─────────────────────────────────────────

const mediaUrlInput = $('mediaUrl');
if (mediaUrlInput) {
    mediaUrlInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); analyzeLink(); }
    });
    mediaUrlInput.addEventListener('input', () => {
        if (state.analyzed) {
            state.analyzed = false;
            hide('mediaInfo');
            hide('qualityPanel');
            hide('downloadButtons');
            hide('downloadStatus');
            hide('downloadResult');
            setAnalyzeStatus('');
        }
    });
}

// ─────────────────────────────────────────
// BROWSER-SIDE AUDIO EXTRACTION (FALLBACK)
// ─────────────────────────────────────────

async function extractAudioBufferFromVideo(file) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio API not supported in this browser.');

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') await audioContext.resume();

    // Fast path: direct decodeAudioData
    try {
        const ab = await file.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(ab.slice(0));
        await audioContext.close();
        return decoded;
    } catch { /* fall through to media element path */ }

    // Media element capture path
    const fileUrl = URL.createObjectURL(file);
    try {
        const video = document.createElement('video');
        video.src = fileUrl;
        video.playsInline = true;
        video.preload = 'auto';
        video.muted = false;

        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = () => reject(new Error('Cannot read this video file.'));
        });

        const mediaStreamDest = audioContext.createMediaStreamDestination();
        const sourceNode = audioContext.createMediaElementSource(video);
        sourceNode.connect(mediaStreamDest);

        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
            .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';

        if (!mimeType) throw new Error('Audio recording not supported in this browser.');

        const recorder = new MediaRecorder(mediaStreamDest.stream, { mimeType });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

        await new Promise((resolve, reject) => {
            recorder.onstop = resolve;
            recorder.onerror = () => reject(new Error('Audio capture failed.'));
            recorder.start(100);
            video.play().catch(reject);
            video.onended = () => { setTimeout(() => { try { if (recorder.state !== 'inactive') recorder.stop(); } catch {} }, 200); };
            const maxMs = Math.max(10000, ((video.duration || 60) + 5) * 1000);
            setTimeout(() => { try { if (recorder.state !== 'inactive') recorder.stop(); } catch {} }, maxMs);
        });

        const blob = new Blob(chunks, { type: mimeType });
        const buf = await blob.arrayBuffer();
        const decoded = await audioContext.decodeAudioData(buf);
        await audioContext.close();
        return decoded;
    } finally {
        URL.revokeObjectURL(fileUrl);
    }
}

// ─────────────────────────────────────────
// MP3 ENCODER (lamejs)
// ─────────────────────────────────────────

function encodePcmToMp3(audioBuffer, targetBitrate = 192) {
    if (typeof lamejs === 'undefined') throw new Error('MP3 encoder not loaded.');
    const numChannels = Math.min(2, audioBuffer.numberOfChannels);
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, targetBitrate);
    const mp3Data = [];
    const leftFloat = audioBuffer.getChannelData(0);
    const rightFloat = numChannels > 1 ? audioBuffer.getChannelData(1) : leftFloat;
    const length = leftFloat.length;
    const leftPcm = new Int16Array(length);
    const rightPcm = new Int16Array(length);
    for (let i = 0; i < length; i++) {
        const l = Math.max(-1, Math.min(1, leftFloat[i]));
        leftPcm[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
        const r = Math.max(-1, Math.min(1, rightFloat[i]));
        rightPcm[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
    }
    const blockSize = 1152;
    for (let i = 0; i < length; i += blockSize) {
        const lc = leftPcm.subarray(i, i + blockSize);
        const buf = numChannels === 1 ? encoder.encodeBuffer(lc) : encoder.encodeBuffer(lc, rightPcm.subarray(i, i + blockSize));
        if (buf && buf.length > 0) mp3Data.push(buf);
    }
    const end = encoder.flush();
    if (end && end.length > 0) mp3Data.push(end);
    return new Blob(mp3Data, { type: 'audio/mp3' });
}

// ─────────────────────────────────────────
// WAV ENCODER (offline fallback)
// ─────────────────────────────────────────

function encodePcmToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = audioBuffer.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const ws = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
    ws(8, 'WAVE'); ws(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true); view.setUint16(34, bitDepth, true);
    ws(36, 'data'); view.setUint32(40, dataSize, true);
    let offset = 44;
    const channels = Array.from({ length: numChannels }, (_, c) => audioBuffer.getChannelData(c));
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const s = Math.max(-1, Math.min(1, channels[c][i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }
    }
    return new Blob([view], { type: 'audio/wav' });
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────

// Set initial platform tab state
selectTab('youtube');
