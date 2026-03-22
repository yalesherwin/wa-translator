(function () {
  'use strict';
  if (window.__cnu_loaded) return;
  window.__cnu_loaded = true;

  const VER = 'v1.0.13';

  // ─── DeepL 语言代码映射 ────────────────────────────────────────
  const DEEPL_LANG = {
    'zh-CN':'ZH','zh-TW':'ZH','en':'EN','es':'ES','fr':'FR',
    'de':'DE','ar':'AR','pt':'PT-BR','ru':'RU','ja':'JA',
    'ko':'KO','it':'IT','tr':'TR','id':'ID','vi':null
  };

  // ─── 翻译 API（DeepL → Google → MyMemory）────────────────────
  async function trDeepL(text, src, tgt, apiKey) {
    const dlTgt = DEEPL_LANG[tgt];
    if (!dlTgt || !apiKey) throw new Error('no_deepl');
    const body = { text: [text], target_lang: dlTgt };
    if (src !== 'auto' && DEEPL_LANG[src]) body.source_lang = DEEPL_LANG[src];
    const r = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': 'DeepL-Auth-Key ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('deepl_err_' + r.status);
    const d = await r.json();
    const res = d?.translations?.[0]?.text;
    if (!res) throw new Error('deepl_empty');
    return res;
  }

  async function trGoogle(text, src, tgt) {
    const r = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    if (d?.[0]) return d[0].map(x => x[0] || '').join('');
    throw new Error('google_empty');
  }

  async function trMyMemory(text, src, tgt) {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src === 'auto' ? 'en' : src}|${tgt}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    if (d?.responseData?.translatedText) return d.responseData.translatedText;
    throw new Error('mymemory_empty');
  }

  async function tr(text, src, tgt) {
    if (!text || !text.trim() || src === tgt) return text;
    if (cfg.deeplKey) {
      try { return await trDeepL(text, src, tgt, cfg.deeplKey); } catch (_) {}
    }
    try { return await trGoogle(text, src, tgt); } catch (_) {}
    try { return await trMyMemory(text, src, tgt); } catch (_) {}
    throw new Error('all_failed');
  }

  // ─── 设置 ─────────────────────────────────────────────────────
  let cfg = { tgt: 'zh-CN', sendLang: 'en', deeplKey: '130905f4-7b9e-43c3-981c-79890049c3d6:fx' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('__cnu2') || '{}')); } catch (_) {}
  const save = () => localStorage.setItem('__cnu2', JSON.stringify(cfg));

  const LANGS = {
    'zh-CN':'中文（简体）','zh-TW':'中文（繁体）','en':'English',
    'es':'Español','fr':'Français','de':'Deutsch','ar':'العربية',
    'pt':'Português','ru':'Русский','ja':'日本語','ko':'한국어',
    'it':'Italiano','tr':'Türkçe','vi':'Tiếng Việt','id':'Bahasa Indonesia'
  };
  const opts = sel => Object.entries(LANGS)
    .map(([v,l]) => `<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');

  // ─── 样式 ─────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    .cnu-r {
      display: block;
      font-size: 12.5px;
      color: #667eea;
      margin-top: 4px;
      line-height: 1.5;
      border-top: 1px solid rgba(0,0,0,.06);
      padding-top: 3px;
      cursor: default;
    }

    #cnu-bar {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      background: #f0f2fe;
      border-top: 1px solid #d0d5f8;
      display: none;
      flex-direction: column;
      z-index: 99999;
      padding: 0;
    }
    #cnu-bar.show { display: flex; }

    #cnu-bar-preview {
      display: flex;
      align-items: center;
      padding: 8px 14px 8px 12px;
      gap: 10px;
      border-left: 3px solid #667eea;
      margin: 8px 10px 0;
      background: rgba(102,126,234,.08);
      border-radius: 6px;
    }
    #cnu-bar-preview .cnu-icon { font-size: 16px; flex-shrink: 0; }
    #cnu-bar-preview .cnu-texts { flex: 1; min-width: 0; }
    #cnu-bar-preview .cnu-from {
      font-size: 11px; color: #888;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #cnu-bar-preview .cnu-to {
      font-size: 13px; color: #333; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #cnu-bar-preview .cnu-cancel {
      background: none; border: none; color: #999;
      font-size: 20px; cursor: pointer; padding: 2px 0 2px 6px;
      flex-shrink: 0; line-height: 1;
    }
    #cnu-bar-actions {
      display: flex;
      gap: 8px;
      padding: 8px 10px 10px;
    }
    #cnu-btn-send-orig {
      flex: 1;
      background: #e9e9e9;
      color: #555;
      border: none; border-radius: 22px;
      padding: 10px;
      font-size: 13px; cursor: pointer;
    }
    #cnu-btn-send-tr {
      flex: 2;
      background: #25d366;
      color: white;
      border: none; border-radius: 22px;
      padding: 10px 18px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    #cnu-btn-send-tr:disabled { background: #a8e6c3; }

    #cnu-cfg-btn {
      position: fixed;
      top: 8px; right: 8px;
      width: 26px; height: 26px;
      background: rgba(255,255,255,.7);
      border: none; border-radius: 50%;
      font-size: 13px; cursor: pointer;
      z-index: 99997;
      display: flex; align-items: center; justify-content: center;
      opacity: .5;
      backdrop-filter: blur(4px);
    }
    #cnu-cfg-btn:active { opacity: 1; }

    #cnu-drawer {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.5);
      z-index: 999999;
      display: none; align-items: flex-end;
    }
    #cnu-drawer.show { display: flex; }
    #cnu-sheet {
      background: #fff;
      border-radius: 18px 18px 0 0;
      width: 100%;
      padding: 0 0 32px;
      animation: slideUp .22s ease;
    }
    @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .cnu-sh-drag {
      width: 36px; height: 4px; background: #ddd; border-radius: 2px;
      margin: 10px auto 0;
    }
    .cnu-sh-title {
      font-size: 16px; font-weight: 700; color: #111;
      padding: 16px 20px 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    .cnu-sh-ver { font-size: 11px; color: #bbb; font-weight: 400; margin-left: 6px; }
    .cnu-sh-row {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid #f5f5f5;
      font-size: 15px; color: #222;
    }
    .cnu-sh-row:last-of-type { border: none; }
    select.cnu-s {
      border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 7px 12px; font-size: 13px;
      background: #fafafa; color: #333;
      max-width: 150px;
    }
    .cnu-sh-key-wrap {
      display: flex; flex-direction: column;
      padding: 10px 20px 14px;
      border-bottom: 1px solid #f5f5f5;
      gap: 6px;
    }
    .cnu-sh-key-label {
      font-size: 13px; color: #555;
      display: flex; align-items: center; gap: 6px;
    }
    .cnu-sh-key-label a { color: #667eea; font-size: 12px; text-decoration: none; }
    input.cnu-key-input {
      width: 100%; border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 9px 12px; font-size: 13px;
      background: #fafafa; color: #333; box-sizing: border-box;
    }
    input.cnu-key-input:focus { border-color: #667eea; outline: none; }
    .cnu-key-status {
      font-size: 11px; color: #25d366; min-height: 14px;
    }
    .cnu-sh-done {
      margin: 4px 16px 0;
      width: calc(100% - 32px);
      background: #25d366;
      color: white; border: none; border-radius: 12px;
      padding: 14px; font-size: 16px; font-weight: 700; cursor: pointer;
    }
  `;
  document.head.appendChild(css);

  // ─── 设置按钮 & 底部弹窗 ─────────────────────────────────────
  const cfgBtn = document.createElement('button');
  cfgBtn.id = 'cnu-cfg-btn'; cfgBtn.textContent = '⚙️';
  document.body.appendChild(cfgBtn);

  const drawer = document.createElement('div');
  drawer.id = 'cnu-drawer';
  drawer.innerHTML = `
    <div id="cnu-sheet">
      <div class="cnu-sh-drag"></div>
      <div class="cnu-sh-title">
        🌐 翻译设置
        <span class="cnu-sh-ver">${VER}</span>
      </div>
      <div class="cnu-sh-row">
        <span>收到消息翻译为</span>
        <select class="cnu-s" id="cfgTgt">${opts(cfg.tgt)}</select>
      </div>
      <div class="cnu-sh-row">
        <span>中文发送为</span>
        <select class="cnu-s" id="cfgSend">${opts(cfg.sendLang)}</select>
      </div>
      <div class="cnu-sh-key-wrap">
        <div class="cnu-sh-key-label">
          🔑 DeepL API Key（高质量翻译，可选）
          <a href="https://www.deepl.com/pro-api" target="_blank">免费申请</a>
        </div>
        <input class="cnu-key-input" id="cfgDeeplKey" type="password"
          placeholder="DeepL-Auth-Key xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
          value="${cfg.deeplKey || ''}" autocomplete="off" />
        <div class="cnu-key-status" id="cfgKeyStatus">${cfg.deeplKey ? '✓ 已配置 DeepL（优先使用）' : '未配置，使用 Google 翻译'}</div>
      </div>
      <button class="cnu-sh-done" id="cfgDone">完成</button>
    </div>`;
  document.body.appendChild(drawer);

  cfgBtn.onclick = () => drawer.classList.add('show');
  drawer.addEventListener('click', e => { if (e.target === drawer) drawer.classList.remove('show'); });

  document.getElementById('cfgDeeplKey').addEventListener('input', e => {
    const v = e.target.value.trim();
    document.getElementById('cfgKeyStatus').textContent =
      v ? '✓ 保存后将优先使用 DeepL' : '未配置，使用 Google 翻译';
  });

  document.getElementById('cfgDone').onclick = () => {
    cfg.tgt = document.getElementById('cfgTgt').value;
    cfg.sendLang = document.getElementById('cfgSend').value;
    cfg.deeplKey = document.getElementById('cfgDeeplKey').value.trim();
    save();
    drawer.classList.remove('show');
  };

  // ─── 收到消息自动翻译 ─────────────────────────────────────────
  const done = new WeakSet();

  // Find the text span inside a message bubble (works across WA Web versions)
  function getTextEl(el) {
    return el.querySelector('span.selectable-text.copyable-text')
        || el.querySelector('span.selectable-text')
        || el.querySelector('[class*="selectable-text"]')
        || el.querySelector('[class*="copyable-text"] span')
        || el.querySelector('span[dir]');
  }

  function addTranslation(el) {
    if (done.has(el)) return;
    done.add(el);
    const textEl = getTextEl(el);
    if (!textEl) return;
    const text = textEl.innerText?.trim();
    if (!text || text.length < 2) return;
    // Skip if translation already injected
    if (textEl.nextElementSibling?.classList?.contains('cnu-r')) return;

    tr(text, 'auto', cfg.tgt).then(res => {
      if (!res || res === text) return;
      const tag = document.createElement('span');
      tag.className = 'cnu-r';
      tag.textContent = res;
      textEl.after(tag);
    }).catch(() => {});
  }

  function scan() {
    // Try multiple selectors for incoming messages across WA Web versions
    const msgs = document.querySelectorAll(
      '[class*="message-in"], [data-id][class*="focusable-list-item"] [class*="in"]'
    );
    msgs.forEach(m => { try { addTranslation(m); } catch (_) {} });
  }

  new MutationObserver(() => {
    clearTimeout(window.__cnuT);
    window.__cnuT = setTimeout(scan, 800);
  }).observe(document.body, { childList: true, subtree: true });
  // Scan multiple times as WA Web loads content asynchronously
  setTimeout(scan, 3000);
  setTimeout(scan, 6000);

  // ─── 发送翻译条（贴键盘顶部）────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'cnu-bar';
  bar.innerHTML = `
    <div id="cnu-bar-preview">
      <span class="cnu-icon">🌐</span>
      <div class="cnu-texts">
        <div class="cnu-from" id="cnuFrom"></div>
        <div class="cnu-to" id="cnuTo">翻译中…</div>
      </div>
      <button class="cnu-cancel" id="cnuCancel">✕</button>
    </div>
    <div id="cnu-bar-actions">
      <button id="cnu-btn-send-orig">发送原文</button>
      <button id="cnu-btn-send-tr" disabled>
        <span>🌐</span><span id="cnuSendLabel">发送翻译</span>
      </button>
    </div>`;
  document.body.appendChild(bar);

  let pending = '';
  let originalText = '';

  const getInput = () =>
    document.querySelector('[data-tab="10"][contenteditable="true"]') ||
    document.querySelector('footer [contenteditable="true"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]') ||
    document.querySelector('[contenteditable="true"][class*="selectable-text"]') ||
    document.querySelector('div[contenteditable="true"][spellcheck]');

  const getWASendBtn = () =>
    document.querySelector('[data-testid="send"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('span[data-icon="send"]')?.closest('button');

  function setContent(el, text) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('insertText', false, text);
  }

  function doSend() {
    const btn = getWASendBtn();
    if (btn) btn.click();
    else getInput()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  }

  function hideBar() {
    bar.classList.remove('show');
    pending = '';
    originalText = '';
    document.getElementById('cnu-btn-send-tr').disabled = true;
    document.getElementById('cnuTo').textContent = '翻译中…';
  }

  document.getElementById('cnuCancel').onclick = hideBar;

  document.getElementById('cnu-btn-send-orig').onclick = () => {
    hideBar();
    setTimeout(doSend, 100);
  };

  document.getElementById('cnu-btn-send-tr').onclick = async () => {
    if (!pending) return;
    const input = getInput();
    if (input) setContent(input, pending);
    hideBar();
    await new Promise(r => setTimeout(r, 220));
    doSend();
  };

  // 键盘弹出时发送条跟随
  let kbH = 0;
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      kbH = Math.max(0, window.innerHeight - window.visualViewport.height);
      bar.style.bottom = kbH > 50 ? kbH + 'px' : '0';
      cfgBtn.style.display = kbH > 150 ? 'none' : 'flex';
    });
  }

  // 监听输入框变化
  let trTimer;
  let lastInput = '';

  function watchInput() {
    const input = getInput();
    if (!input) return;
    input.addEventListener('input', () => {
      const text = input.innerText?.trim() || '';
      if (text === lastInput) return;
      lastInput = text;
      clearTimeout(trTimer);
      hideBar();
      if (!text || !/[\u4e00-\u9fa5]/.test(text)) return;

      originalText = text;
      document.getElementById('cnuFrom').textContent = text.length > 30 ? text.slice(0,30)+'…' : text;
      document.getElementById('cnuTo').textContent = '翻译中…';
      document.getElementById('cnu-btn-send-tr').disabled = true;
      bar.classList.add('show');

      trTimer = setTimeout(async () => {
        try {
          const res = await tr(text, 'zh-CN', cfg.sendLang);
          pending = res;
          document.getElementById('cnuTo').textContent = res.length > 40 ? res.slice(0,40)+'…' : res;
          document.getElementById('cnu-btn-send-tr').disabled = false;
        } catch (_) {
          hideBar();
        }
      }, 700);
    });
  }

  // 等待输入框出现后挂载
  const inputObs = new MutationObserver(() => {
    if (getInput()) { watchInput(); inputObs.disconnect(); }
  });
  inputObs.observe(document.body, { childList: true, subtree: true });
  if (getInput()) watchInput();

})();
