/**
 * ChinaCNU WhatsApp 翻译注入脚本
 * 适用于 iOS Safari 书签脚本 + 其他浏览器
 * 在 web.whatsapp.com 运行
 */
(function() {
  'use strict';

  if (window.__chinacnu_translator_loaded) {
    showToast('翻译助手已运行中');
    return;
  }
  window.__chinacnu_translator_loaded = true;

  // ==================== 翻译 API ====================
  async function fetchWithTimeout(url, ms = 10000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      return r;
    } catch(e) { clearTimeout(tid); throw e; }
  }

  async function translate(text, src, tgt) {
    if (!text || !text.trim()) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
      const r = await fetchWithTimeout(url);
      const d = await r.json();
      if (d && d[0]) return d[0].map(i => i[0] || '').join('');
      throw new Error();
    } catch(e) {
      // fallback MyMemory
      const lp = `${src === 'auto' ? 'en' : src}|${tgt}`;
      const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${lp}`;
      const r2 = await fetchWithTimeout(url2);
      const d2 = await r2.json();
      if (d2?.responseData?.translatedText) return d2.responseData.translatedText;
      throw new Error('翻译失败');
    }
  }

  // ==================== 设置 ====================
  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem('__chinacnu_settings') || '{}');
    } catch(e) { return {}; }
  }
  function saveSettings(s) {
    localStorage.setItem('__chinacnu_settings', JSON.stringify(s));
  }

  let settings = Object.assign({ enabled: true, autoTranslate: false, targetLang: 'zh-CN', sendLang: 'en', autoSend: false }, getSettings());

  // ==================== UI Panel ====================
  const LANG_NAMES = {
    'zh-CN':'中文简体','zh-TW':'中文繁体','en':'English','es':'Español',
    'fr':'Français','de':'Deutsch','ar':'العربية','pt':'Português',
    'ru':'Русский','ja':'日本語','ko':'한국어','it':'Italiano',
    'tr':'Türkçe','hi':'हिन्दी','vi':'Tiếng Việt'
  };

  const LANGS = Object.entries(LANG_NAMES).map(([v,l]) => `<option value="${v}">${l}</option>`).join('');

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #cnu-panel {
      position: fixed;
      bottom: 80px;
      right: 16px;
      z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
    #cnu-fab {
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(102,126,234,0.5);
      border: none;
      color: white;
      transition: transform 0.2s;
      margin-left: auto;
    }
    #cnu-fab:active { transform: scale(0.92); }
    #cnu-popup {
      display: none;
      position: fixed;
      bottom: 150px;
      right: 12px;
      width: 300px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 99999;
      overflow: hidden;
    }
    #cnu-popup.show { display: block; }
    .cnu-header {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 700;
      font-size: 14px;
    }
    .cnu-close { cursor: pointer; font-size: 18px; opacity: 0.8; background:none; border:none; color:white; }
    .cnu-body { padding: 14px; }
    .cnu-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
    }
    .cnu-row:last-child { border-bottom: none; }
    .cnu-switch {
      position: relative;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }
    .cnu-switch input { opacity: 0; width: 0; height: 0; }
    .cnu-slider {
      position: absolute;
      inset: 0;
      background: #ccc;
      border-radius: 24px;
      cursor: pointer;
      transition: 0.3s;
    }
    .cnu-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }
    input:checked + .cnu-slider { background: #667eea; }
    input:checked + .cnu-slider::before { transform: translateX(20px); }
    .cnu-select {
      border: 1.5px solid #e0e0e0;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 13px;
      background: white;
      cursor: pointer;
      max-width: 130px;
    }
    .cnu-footer {
      background: #f9f9f9;
      padding: 10px 14px;
      font-size: 11px;
      color: #aaa;
      text-align: center;
    }

    /* Translation label on messages */
    .cnu-translate-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
      margin: 3px 0 0 4px;
      vertical-align: middle;
      font-family: inherit;
    }
    .cnu-translation-result {
      display: block;
      font-size: 12px;
      color: #667eea;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid rgba(102,126,234,0.2);
      line-height: 1.5;
    }
    .cnu-toast {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 999999;
      pointer-events: none;
      transition: opacity 0.3s;
    }
  `;
  document.head.appendChild(style);

  // Toast
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'cnu-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 1800);
  }

  // Panel HTML
  const panelEl = document.createElement('div');
  panelEl.id = 'cnu-panel';
  panelEl.innerHTML = `
    <div id="cnu-popup">
      <div class="cnu-header">
        🌐 ChinaCNU 翻译助手
        <button class="cnu-close" id="cnuClose">✕</button>
      </div>
      <div class="cnu-body">
        <div class="cnu-row">
          <span>启用翻译</span>
          <label class="cnu-switch"><input type="checkbox" id="cnuEnabled" ${settings.enabled?'checked':''}><span class="cnu-slider"></span></label>
        </div>
        <div class="cnu-row">
          <span>自动翻译新消息</span>
          <label class="cnu-switch"><input type="checkbox" id="cnuAuto" ${settings.autoTranslate?'checked':''}><span class="cnu-slider"></span></label>
        </div>
        <div class="cnu-row">
          <span>翻译为</span>
          <select class="cnu-select" id="cnuTargetLang">${LANGS}</select>
        </div>
        <div class="cnu-row">
          <span>中文自动发为</span>
          <label class="cnu-switch"><input type="checkbox" id="cnuAutoSend" ${settings.autoSend?'checked':''}><span class="cnu-slider"></span></label>
        </div>
        <div class="cnu-row" id="cnuSendLangRow" style="${settings.autoSend?'':'opacity:0.4'}">
          <span>发送语言</span>
          <select class="cnu-select" id="cnuSendLang">${LANGS}</select>
        </div>
      </div>
      <div class="cnu-footer">ChinaCNU · 外贸专业翻译工具 · 免费</div>
    </div>
    <button id="cnu-fab" title="ChinaCNU翻译">🌐</button>
  `;
  document.body.appendChild(panelEl);

  // Set values
  document.getElementById('cnuTargetLang').value = settings.targetLang;
  document.getElementById('cnuSendLang').value = settings.sendLang || 'en';

  const popup = document.getElementById('cnu-popup');
  const fab = document.getElementById('cnu-fab');

  fab.addEventListener('click', () => {
    popup.classList.toggle('show');
  });
  document.getElementById('cnuClose').addEventListener('click', () => {
    popup.classList.remove('show');
  });

  // Settings change
  ['cnuEnabled','cnuAuto','cnuAutoSend','cnuTargetLang','cnuSendLang'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => {
      settings.enabled = document.getElementById('cnuEnabled').checked;
      settings.autoTranslate = document.getElementById('cnuAuto').checked;
      settings.autoSend = document.getElementById('cnuAutoSend').checked;
      settings.targetLang = document.getElementById('cnuTargetLang').value;
      settings.sendLang = document.getElementById('cnuSendLang').value;
      document.getElementById('cnuSendLangRow').style.opacity = settings.autoSend ? '1' : '0.4';
      saveSettings(settings);
      showToast('设置已保存');
    });
  });

  // ==================== Message translation ====================
  const processed = new WeakSet();

  function addTranslateButton(msgEl) {
    if (processed.has(msgEl)) return;
    processed.add(msgEl);

    const textEl = msgEl.querySelector('[class*="copyable-text"]') ||
                   msgEl.querySelector('[data-pre-plain-text]') ||
                   msgEl.querySelector('span[class*="_11JPr"]') ||
                   msgEl.querySelector('span[class*="selectable-text"]');
    if (!textEl) return;

    const text = textEl.innerText?.trim();
    if (!text || text.length < 2) return;

    // Skip if already has translation
    if (msgEl.querySelector('.cnu-translation-result')) return;

    const btn = document.createElement('button');
    btn.className = 'cnu-translate-btn';
    btn.innerHTML = '🌐 译';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.textContent = '...';
      btn.disabled = true;
      try {
        const result = await translate(text, 'auto', settings.targetLang);
        let resultEl = msgEl.querySelector('.cnu-translation-result');
        if (!resultEl) {
          resultEl = document.createElement('span');
          resultEl.className = 'cnu-translation-result';
          textEl.parentNode.insertBefore(resultEl, textEl.nextSibling);
        }
        resultEl.textContent = '🌐 ' + result;
        btn.textContent = '✓';
        setTimeout(() => { btn.innerHTML = '🌐 译'; btn.disabled = false; }, 2000);
      } catch(err) {
        btn.textContent = '✗';
        btn.disabled = false;
        showToast('翻译失败，请检查网络');
        setTimeout(() => { btn.innerHTML = '🌐 译'; }, 2000);
      }
    });

    const footer = msgEl.querySelector('[class*="tail"]') ||
                   msgEl.querySelector('[class*="status"]') ||
                   textEl.parentElement;
    if (footer) footer.appendChild(btn);

    // Auto translate
    if (settings.autoTranslate && settings.enabled) {
      btn.click();
    }
  }

  function scanMessages() {
    if (!settings.enabled) return;
    const msgs = document.querySelectorAll('[class*="message-in"], [data-id][class*="focusable-list-item"]');
    msgs.forEach(m => {
      try { addTranslateButton(m); } catch(e) {}
    });
  }

  // Observer for new messages
  const observer = new MutationObserver(() => {
    if (settings.enabled) {
      clearTimeout(window.__cnuScanTimer);
      window.__cnuScanTimer = setTimeout(scanMessages, 500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  scanMessages();

  // ==================== Send translation ====================
  function setupSendTranslation() {
    document.addEventListener('keydown', async (e) => {
      if (!settings.autoSend || !settings.enabled) return;
      if (e.key !== 'Enter' || e.shiftKey) return;

      const input = document.querySelector('[data-tab="10"][contenteditable="true"]') ||
                    document.querySelector('footer [contenteditable="true"]');
      if (!input) return;

      const text = input.innerText?.trim();
      if (!text) return;

      // Only translate if contains Chinese
      if (!/[\u4e00-\u9fa5]/.test(text)) return;

      e.preventDefault();
      e.stopPropagation();

      showToast('翻译中...');
      try {
        const translated = await translate(text, 'zh-CN', settings.sendLang);
        input.innerText = translated;
        // Trigger React/WhatsApp input update
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // Send
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-tab="11"]') ||
                          document.querySelector('button[aria-label*="Send"]') ||
                          document.querySelector('[data-testid="send"]');
          if (sendBtn) sendBtn.click();
        }, 100);
      } catch(err) {
        showToast('翻译失败，已发送原文');
        // Send original
        const sendBtn = document.querySelector('[data-tab="11"]') || document.querySelector('button[aria-label*="Send"]');
        if (sendBtn) sendBtn.click();
      }
    }, true);
  }

  setupSendTranslation();

  showToast('🌐 ChinaCNU翻译助手已启动！');
})();
