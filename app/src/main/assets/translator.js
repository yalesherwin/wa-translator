(function () {
  'use strict';
  if (window.__cnu_loaded) return;
  window.__cnu_loaded = true;

  const VER = 'v1.0.15';

  // ─── AbortSignal 兼容包装 ─────────────────────────────────────
  function abortAfter(ms) {
    try {
      if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
    } catch (_) {}
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  // ─── DeepL 语言映射 ───────────────────────────────────────────
  const DEEPL_LANG = {
    'zh-CN':'ZH','zh-TW':'ZH','en':'EN','es':'ES','fr':'FR',
    'de':'DE','ar':'AR','pt':'PT-BR','ru':'RU','ja':'JA',
    'ko':'KO','it':'IT','tr':'TR','id':'ID'
  };

  // ─── 翻译（DeepL > Google > MyMemory）────────────────────────
  async function trDeepL(text, tgt, key) {
    const dlTgt = DEEPL_LANG[tgt];
    if (!dlTgt || !key) throw new Error('skip');
    const r = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Authorization': 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], target_lang: dlTgt }),
      signal: abortAfter(8000)
    });
    if (!r.ok) throw new Error('deepl_' + r.status);
    const d = await r.json();
    const res = d?.translations?.[0]?.text;
    if (!res) throw new Error('empty');
    return res;
  }

  async function trGoogle(text, src, tgt) {
    const r = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`,
      { signal: abortAfter(8000) }
    );
    const d = await r.json();
    if (d?.[0]) return d[0].map(x => x[0] || '').join('');
    throw new Error('empty');
  }

  async function trMyMemory(text, src, tgt) {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src === 'auto' ? 'en' : src}|${tgt}`,
      { signal: abortAfter(8000) }
    );
    const d = await r.json();
    if (d?.responseData?.translatedText) return d.responseData.translatedText;
    throw new Error('empty');
  }

  async function tr(text, src, tgt) {
    if (!text || !text.trim() || src === tgt) return text;
    if (cfg.deeplKey) {
      try { return await trDeepL(text, tgt, cfg.deeplKey); } catch (_) {}
    }
    try { return await trGoogle(text, src, tgt); } catch (_) {}
    try { return await trMyMemory(text, src, tgt); } catch (_) {}
    throw new Error('all_failed');
  }

  // ─── 设置 ─────────────────────────────────────────────────────
  let cfg = { tgt: 'zh-CN', sendLang: 'en', deeplKey: '130905f4-7b9e-43c3-981c-79890049c3d6:fx' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('__cnu3') || '{}')); } catch (_) {}
  const save = () => localStorage.setItem('__cnu3', JSON.stringify(cfg));

  const LANGS = {
    'zh-CN':'中文（简体）','zh-TW':'中文（繁体）','en':'English',
    'es':'Español','fr':'Français','de':'Deutsch','ar':'العربية',
    'pt':'Português','ru':'Русский','ja':'日本語','ko':'한국어',
    'it':'Italiano','tr':'Türkçe','vi':'Tiếng Việt','id':'Bahasa Indonesia'
  };
  const opts = sel => Object.entries(LANGS)
    .map(([v,l]) => `<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');

  // ─── 全局样式 ─────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    /* ── 手机单栏布局（以 data-cnu 属性标记面板）────────────────── */
    [data-cnu="left"] {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      /* 不加 overflow-y，让 WA 自己管理内部滚动 */
      background: #fff;
      transform: translateX(0);
      transition: transform .28s cubic-bezier(.4,0,.2,1);
      z-index: 200 !important;
    }
    [data-cnu="right"] {
      position: fixed !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important; height: 100% !important;
      /* 不加 overflow-y，让 WA 内部 flex 布局自己处理（输入栏贴底、消息列表滚动）*/
      background: #fff;
      transform: translateX(100%);
      transition: transform .28s cubic-bezier(.4,0,.2,1);
      z-index: 200 !important;
    }
    html.cnu-chat-open [data-cnu="left"]  { transform: translateX(-100%); }
    html.cnu-chat-open [data-cnu="right"] { transform: translateX(0); }

    /* ── 翻译结果 ───────────────────────────────────────────────── */
    .cnu-r {
      display: block; font-size: 12.5px;
      color: #5a6fd6; margin-top: 4px; line-height: 1.5;
      border-top: 1px solid rgba(0,0,0,.07); padding-top: 3px;
      font-style: italic;
    }

    /* ── 发送翻译条 ─────────────────────────────────────────────── */
    #cnu-bar {
      position: fixed; left: 0; right: 0; bottom: 0;
      background: #f0f2fe; border-top: 1px solid #d0d5f8;
      display: none; flex-direction: column;
      z-index: 999999;
    }
    #cnu-bar.show { display: flex; }
    #cnu-bar-preview {
      display: flex; align-items: center;
      padding: 8px 14px 8px 12px; gap: 10px;
      border-left: 3px solid #667eea;
      margin: 8px 10px 0;
      background: rgba(102,126,234,.09); border-radius: 6px;
    }
    #cnu-bar-preview .icon { font-size: 16px; flex-shrink: 0; }
    #cnu-bar-preview .texts { flex: 1; min-width: 0; }
    #cnu-bar-preview .from {
      font-size: 11px; color: #888;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #cnu-bar-preview .to {
      font-size: 13px; color: #333; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #cnu-bar-preview .cancel {
      background: none; border: none; color: #999;
      font-size: 20px; cursor: pointer; padding: 2px 0 2px 6px;
      flex-shrink: 0; line-height: 1;
    }
    #cnu-bar-actions { display: flex; gap: 8px; padding: 8px 10px 10px; }
    #cnu-btn-orig {
      flex: 1; background: #e9e9e9; color: #555;
      border: none; border-radius: 22px; padding: 10px;
      font-size: 13px; cursor: pointer;
    }
    #cnu-btn-tr {
      flex: 2; background: #25d366; color: #fff;
      border: none; border-radius: 22px; padding: 10px 18px;
      font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    #cnu-btn-tr:disabled { background: #a8e6c3; }

    /* ── 设置齿轮：放在右下角，输入栏上方，不遮 WA 内容 ──────── */
    #cnu-cfg-btn {
      position: fixed; bottom: 76px; right: 14px;
      width: 36px; height: 36px;
      background: rgba(37,211,102,.9);
      border: none; border-radius: 50%;
      font-size: 16px; cursor: pointer;
      z-index: 999998;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
    }

    /* ── 设置底部弹窗 ───────────────────────────────────────────── */
    #cnu-drawer {
      position: fixed; inset: 0;
      background: rgba(0,0,0,.5);
      z-index: 9999999;
      display: none; align-items: flex-end;
    }
    #cnu-drawer.show { display: flex; }
    #cnu-sheet {
      background: #fff; border-radius: 18px 18px 0 0;
      width: 100%; padding: 0 0 32px;
      animation: cnuUp .22s ease;
    }
    @keyframes cnuUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .sh-drag {
      width: 36px; height: 4px; background: #ddd;
      border-radius: 2px; margin: 10px auto 0;
    }
    .sh-title {
      font-size: 16px; font-weight: 700; color: #111;
      padding: 16px 20px 8px; border-bottom: 1px solid #f0f0f0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .sh-ver { font-size: 11px; color: #bbb; font-weight: 400; }
    .sh-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px; border-bottom: 1px solid #f5f5f5;
      font-size: 15px; color: #222;
    }
    select.sh-sel {
      border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 7px 12px; font-size: 13px;
      background: #fafafa; color: #333; max-width: 160px;
    }
    .sh-key-wrap {
      padding: 10px 20px 14px; border-bottom: 1px solid #f5f5f5;
    }
    .sh-key-label {
      font-size: 13px; color: #555; margin-bottom: 6px;
      display: flex; align-items: center; gap: 6px;
    }
    input.sh-key {
      width: 100%; border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 9px 12px; font-size: 12px;
      background: #fafafa; color: #333; box-sizing: border-box;
    }
    .sh-key-hint { font-size: 11px; color: #25d366; margin-top: 4px; min-height: 14px; }
    .sh-done {
      margin: 8px 16px 0; width: calc(100% - 32px);
      background: #25d366; color: #fff; border: none;
      border-radius: 12px; padding: 14px;
      font-size: 16px; font-weight: 700; cursor: pointer;
    }
  `;
  document.head.appendChild(css);

  // ─── 手机单栏布局：把桌面双栏变成手机单栏滑动 ────────────────
  let layoutDone = false;

  function setupMobileLayout() {
    const main = document.getElementById('main');
    if (!main) return false;

    // 左面板 = #main 的前一个兄弟节点（无论 WhatsApp 叫它什么）
    const left = main.previousElementSibling;
    if (!left) return false;

    if (layoutDone) return true;
    layoutDone = true;

    // 标记两个面板
    left.setAttribute('data-cnu', 'left');
    main.setAttribute('data-cnu', 'right');

    // 隐藏父容器里的其他兄弟节点（如图标导航栏等额外列）
    const parent = left.parentElement;
    if (parent) {
      Array.from(parent.children).forEach(c => {
        if (c !== left && c !== main) {
          c.style.setProperty('display', 'none', 'important');
        }
      });
    }

    // 检测当前是否在聊天界面
    function checkChatState() {
      const header = main.querySelector('header');
      const inChat = !!header && header.children.length > 0;
      document.documentElement.classList.toggle('cnu-chat-open', inChat);
    }

    new MutationObserver(checkChatState)
      .observe(document.body, { childList: true, subtree: true });
    checkChatState();
    return true;
  }

  function tryLayout() {
    if (!setupMobileLayout()) setTimeout(tryLayout, 800);
  }
  setTimeout(tryLayout, 1500);

  // ─── 设置 UI ──────────────────────────────────────────────────
  const cfgBtn = document.createElement('button');
  cfgBtn.id = 'cnu-cfg-btn'; cfgBtn.textContent = '⚙️';
  document.body.appendChild(cfgBtn);

  const drawer = document.createElement('div');
  drawer.id = 'cnu-drawer';
  drawer.innerHTML = `
    <div id="cnu-sheet">
      <div class="sh-drag"></div>
      <div class="sh-title">
        🌐 翻译设置
        <span class="sh-ver">${VER}</span>
      </div>
      <div class="sh-row">
        <span>收到消息翻译为</span>
        <select class="sh-sel" id="cfgTgt">${opts(cfg.tgt)}</select>
      </div>
      <div class="sh-row">
        <span>中文发送翻译为</span>
        <select class="sh-sel" id="cfgSend">${opts(cfg.sendLang)}</select>
      </div>
      <div class="sh-key-wrap">
        <div class="sh-key-label">🔑 DeepL API Key（免费，翻译质量更好）</div>
        <input class="sh-key" id="cfgKey" type="password"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
          value="${cfg.deeplKey || ''}" autocomplete="off"/>
        <div class="sh-key-hint" id="cfgHint">
          ${cfg.deeplKey ? '✓ 已配置 DeepL（最高质量翻译）' : '未配置，使用 Google 翻译'}
        </div>
      </div>
      <button class="sh-done" id="cfgDone">完成</button>
    </div>`;
  document.body.appendChild(drawer);

  cfgBtn.onclick = () => drawer.classList.add('show');
  drawer.addEventListener('click', e => { if (e.target === drawer) drawer.classList.remove('show'); });
  document.getElementById('cfgKey').addEventListener('input', e => {
    document.getElementById('cfgHint').textContent =
      e.target.value.trim() ? '✓ 保存后使用 DeepL' : '未配置，使用 Google 翻译';
  });
  document.getElementById('cfgDone').onclick = () => {
    cfg.tgt = document.getElementById('cfgTgt').value;
    cfg.sendLang = document.getElementById('cfgSend').value;
    cfg.deeplKey = document.getElementById('cfgKey').value.trim();
    save();
    drawer.classList.remove('show');
    retranslateAll();
  };

  // ─── 消息翻译 ─────────────────────────────────────────────────
  const translated = new WeakSet();

  // 从消息气泡里提取文字（多重选择器兼容各版本）
  function extractText(el) {
    const SELECTORS = [
      '[data-testid="balloon-text-content"]',
      'span.selectable-text.copyable-text',
      'span.selectable-text',
      '[class*="selectable-text"]',
      '[class*="copyable-text"] span',
      'span[dir="ltr"]',
      'span[dir="rtl"]',
    ];
    for (const sel of SELECTORS) {
      const node = el.querySelector(sel);
      if (node) {
        // 跳过已含翻译结果的节点
        if (node.classList?.contains('cnu-r')) continue;
        const text = node.innerText?.trim();
        if (text && text.length > 1) return { node, text };
      }
    }
    return null;
  }

  function addTranslation(el) {
    if (translated.has(el)) return;
    translated.add(el);

    const found = extractText(el);
    if (!found) return;
    const { node, text } = found;

    // 避免翻译自己发出的内容
    if (el.closest('[class*="message-out"]') || el.closest('[data-cnu-out]')) return;

    tr(text, 'auto', cfg.tgt).then(res => {
      if (!res || res.trim() === text.trim()) return;
      // 再次检查（避免重复）
      if (node.nextElementSibling?.classList?.contains('cnu-r')) return;
      const tag = document.createElement('span');
      tag.className = 'cnu-r';
      tag.textContent = res;
      node.after(tag);
    }).catch(() => {});
  }

  function scan() {
    // 主选择器
    document.querySelectorAll('[class*="message-in"]').forEach(m => {
      try { addTranslation(m); } catch (_) {}
    });
    // 备用：所有含文字的消息气泡（排除已发送）
    document.querySelectorAll('[data-pre-plain-text]').forEach(m => {
      if (m.closest('[class*="message-out"]')) return;
      try { addTranslation(m); } catch (_) {}
    });
  }

  function retranslateAll() {
    // 清除已有翻译，重新翻译（设置改变后调用）
    document.querySelectorAll('.cnu-r').forEach(el => el.remove());
    setTimeout(scan, 300);
  }

  new MutationObserver(() => {
    clearTimeout(window.__cnuScanT);
    window.__cnuScanT = setTimeout(scan, 800);
  }).observe(document.body, { childList: true, subtree: true });

  // 多次扫描确保 WhatsApp 内容加载完毕
  setTimeout(scan, 2500);
  setTimeout(scan, 5000);
  setTimeout(scan, 9000);

  // ─── 发送翻译条 ───────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'cnu-bar';
  bar.innerHTML = `
    <div id="cnu-bar-preview">
      <span class="icon">🌐</span>
      <div class="texts">
        <div class="from" id="cnuFrom"></div>
        <div class="to" id="cnuTo">翻译中…</div>
      </div>
      <button class="cancel" id="cnuCancel">✕</button>
    </div>
    <div id="cnu-bar-actions">
      <button id="cnu-btn-orig">发送原文</button>
      <button id="cnu-btn-tr" disabled>🌐 发送翻译</button>
    </div>`;
  document.body.appendChild(bar);

  let pending = '';

  const getInput = () =>
    document.querySelector('[data-tab="10"][contenteditable="true"]') ||
    document.querySelector('footer [contenteditable="true"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]') ||
    document.querySelector('div[contenteditable="true"][spellcheck]');

  const getSendBtn = () =>
    document.querySelector('[data-testid="send"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('span[data-icon="send"]')?.closest('button');

  function setContent(el, text) {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(r);
    document.execCommand('insertText', false, text);
  }

  function doSend() {
    const btn = getSendBtn();
    if (btn) btn.click();
    else getInput()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
  }

  function hideBar() {
    bar.classList.remove('show');
    pending = '';
    document.getElementById('cnu-btn-tr').disabled = true;
    document.getElementById('cnuTo').textContent = '翻译中…';
  }

  document.getElementById('cnuCancel').onclick = hideBar;
  document.getElementById('cnu-btn-orig').onclick = () => { hideBar(); setTimeout(doSend, 100); };
  document.getElementById('cnu-btn-tr').onclick = async () => {
    if (!pending) return;
    const inp = getInput();
    if (inp) setContent(inp, pending);
    hideBar();
    await new Promise(r => setTimeout(r, 220));
    doSend();
  };

  if (window.visualViewport) {
    function onVPResize() {
      const vph = window.visualViewport.height;
      const kbH = Math.max(0, window.innerHeight - vph);
      // 键盘弹出时，让面板高度等于可视区域高度，避免被键盘遮住
      document.querySelectorAll('[data-cnu]').forEach(el => {
        el.style.height = vph + 'px';
      });
      // 发送条和设置按钮跟随键盘顶部
      bar.style.bottom = kbH > 50 ? kbH + 'px' : '0';
      cfgBtn.style.bottom = kbH > 50 ? (kbH + 8) + 'px' : '76px';
    }
    window.visualViewport.addEventListener('resize', onVPResize);
    window.visualViewport.addEventListener('scroll', onVPResize);
  }

  // ─── 监听中文输入，弹出翻译发送条 ────────────────────────────
  let trTimer, lastInput = '';

  function watchInput() {
    const inp = getInput();
    if (!inp) return;
    inp.addEventListener('input', () => {
      const text = inp.innerText?.trim() || '';
      if (text === lastInput) return;
      lastInput = text;
      clearTimeout(trTimer);
      hideBar();
      if (!text || !/[\u4e00-\u9fa5]/.test(text)) return;

      document.getElementById('cnuFrom').textContent = text.length > 30 ? text.slice(0,30)+'…' : text;
      document.getElementById('cnuTo').textContent = '翻译中…';
      document.getElementById('cnu-btn-tr').disabled = true;
      bar.classList.add('show');

      trTimer = setTimeout(async () => {
        try {
          const res = await tr(text, 'zh-CN', cfg.sendLang);
          pending = res;
          document.getElementById('cnuTo').textContent = res.length > 40 ? res.slice(0,40)+'…' : res;
          document.getElementById('cnu-btn-tr').disabled = false;
        } catch (_) { hideBar(); }
      }, 700);
    });
  }

  const inputObs = new MutationObserver(() => {
    if (getInput()) { watchInput(); inputObs.disconnect(); }
  });
  inputObs.observe(document.body, { childList: true, subtree: true });
  if (getInput()) watchInput();

})();
