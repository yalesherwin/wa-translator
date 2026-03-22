(function () {
  'use strict';
  if (window.__cnu_loaded) return;
  window.__cnu_loaded = true;

  // ─── 翻译 API ────────────────────────────────────────────────
  async function tr(text, src, tgt) {
    if (!text || !text.trim()) return '';
    try {
      const r = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const d = await r.json();
      if (d?.[0]) return d[0].map(x => x[0] || '').join('');
    } catch (_) {}
    try {
      const r2 = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src === 'auto' ? 'en' : src}|${tgt}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const d2 = await r2.json();
      if (d2?.responseData?.translatedText) return d2.responseData.translatedText;
    } catch (_) {}
    throw new Error('failed');
  }

  // ─── 设置 ────────────────────────────────────────────────────
  const DEF = { tgt: 'zh-CN', sendLang: 'en' };
  let cfg = { ...DEF };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('__cnu') || '{}')); } catch (_) {}
  const save = () => localStorage.setItem('__cnu', JSON.stringify(cfg));

  // ─── 样式 ────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
    /* 接收消息的翻译文字 */
    .cnu-r {
      font-size: 11.5px;
      color: #667eea;
      margin-top: 3px;
      line-height: 1.45;
      display: block;
      padding: 2px 0;
      opacity: .9;
    }
    .cnu-r.loading { color: #bbb; font-style: italic; }

    /* 发送栏 - 浮在输入框上方 */
    #cnu-bar {
      position: fixed;
      left: 0; right: 0;
      bottom: 0;
      background: #f0f2ff;
      border-top: 1.5px solid #c5ceff;
      display: none;
      align-items: center;
      padding: 8px 12px;
      gap: 10px;
      z-index: 99999;
      transition: bottom .15s;
    }
    #cnu-bar.show { display: flex; }
    #cnu-preview {
      flex: 1;
      font-size: 13px;
      color: #444;
      line-height: 1.4;
      max-height: 54px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    #cnu-preview .arrow { color: #667eea; font-weight: 700; margin: 0 4px; }
    #cnu-send-btn {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 22px;
      padding: 9px 18px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #cnu-send-btn:disabled { opacity: .6; }
    #cnu-cancel {
      background: none;
      border: none;
      color: #aaa;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      flex-shrink: 0;
    }

    /* 设置入口 - 右上角极小图标 */
    #cnu-cfg-btn {
      position: fixed;
      top: 10px; right: 10px;
      width: 28px; height: 28px;
      background: rgba(102,126,234,.15);
      border: none;
      border-radius: 50%;
      font-size: 14px;
      cursor: pointer;
      z-index: 99997;
      display: flex; align-items: center; justify-content: center;
      opacity: .6;
    }
    #cnu-cfg-btn:active { opacity: 1; }

    /* 设置抽屉 */
    #cnu-drawer {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,.45);
      z-index: 99999;
      display: none;
      align-items: flex-end;
    }
    #cnu-drawer.show { display: flex; }
    #cnu-sheet {
      background: white;
      border-radius: 20px 20px 0 0;
      width: 100%;
      padding: 20px 20px 36px;
    }
    .cnu-sh-title {
      font-size: 15px; font-weight: 700; margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px; color: #333;
    }
    .cnu-sh-row {
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px; color: #333;
    }
    .cnu-sh-row:last-child { border: none; }
    select.cnu-s {
      border: 1.5px solid #ddd; border-radius: 8px;
      padding: 5px 10px; font-size: 13px;
      background: white; max-width: 140px;
    }
    .cnu-done {
      margin-top: 14px; width: 100%;
      background: linear-gradient(135deg,#667eea,#764ba2);
      color: white; border: none; border-radius: 12px;
      padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer;
    }
  `;
  document.head.appendChild(css);

  // ─── 设置按钮 & 抽屉 ─────────────────────────────────────────
  const LANGS = {
    'zh-CN':'中文简体','zh-TW':'中文繁体','en':'English','es':'Español',
    'fr':'Français','de':'Deutsch','ar':'العربية','pt':'Português',
    'ru':'Русский','ja':'日本語','ko':'한국어','it':'Italiano','tr':'Türkçe',
    'vi':'Tiếng Việt','id':'Bahasa Indonesia'
  };
  const opts = sel => Object.entries(LANGS)
    .map(([v,l]) => `<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');

  const cfgBtn = document.createElement('button');
  cfgBtn.id = 'cnu-cfg-btn'; cfgBtn.textContent = '⚙';
  document.body.appendChild(cfgBtn);

  const drawer = document.createElement('div');
  drawer.id = 'cnu-drawer';
  drawer.innerHTML = `
    <div id="cnu-sheet">
      <div class="cnu-sh-title">🌐 ChinaCNU 翻译设置</div>
      <div class="cnu-sh-row">
        <span>收到消息翻译为</span>
        <select class="cnu-s" id="cfgTgt">${opts(cfg.tgt)}</select>
      </div>
      <div class="cnu-sh-row">
        <span>发送语言</span>
        <select class="cnu-s" id="cfgSend">${opts(cfg.sendLang)}</select>
      </div>
      <button class="cnu-done" id="cfgClose">完成</button>
    </div>`;
  document.body.appendChild(drawer);

  cfgBtn.onclick = () => drawer.classList.add('show');
  drawer.onclick = e => { if (e.target === drawer) drawer.classList.remove('show'); };
  document.getElementById('cfgClose').onclick = () => {
    cfg.tgt = document.getElementById('cfgTgt').value;
    cfg.sendLang = document.getElementById('cfgSend').value;
    save(); drawer.classList.remove('show');
  };

  // ─── 接收消息自动翻译 ─────────────────────────────────────────
  const done = new WeakSet();

  function addTranslation(el) {
    if (done.has(el)) return;
    done.add(el);

    const textEl = el.querySelector('span.selectable-text')
                || el.querySelector('[class*="copyable-text"]');
    if (!textEl) return;
    const text = textEl.innerText?.trim();
    if (!text || text.length < 2) return;

    const tag = document.createElement('span');
    tag.className = 'cnu-r loading';
    tag.textContent = '翻译中…';
    textEl.after(tag);

    tr(text, 'auto', cfg.tgt).then(res => {
      tag.classList.remove('loading');
      tag.textContent = res;
    }).catch(() => {
      tag.remove();
      done.delete(el); // 允许重试
    });
  }

  function scan() {
    document.querySelectorAll('[class*="message-in"]').forEach(m => {
      try { addTranslation(m); } catch (_) {}
    });
  }

  new MutationObserver(() => {
    clearTimeout(window.__cnuT);
    window.__cnuT = setTimeout(scan, 500);
  }).observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 2000);

  // ─── 发送翻译条 ───────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = 'cnu-bar';
  bar.innerHTML = `
    <div id="cnu-preview"><span class="arrow">→</span><span id="cnu-translated">…</span></div>
    <button id="cnu-cancel">✕</button>
    <button id="cnu-send-btn">发送翻译</button>
  `;
  document.body.appendChild(bar);

  const preview  = document.getElementById('cnu-preview');
  const cancelBtn= document.getElementById('cnu-cancel');
  const sendBtn  = document.getElementById('cnu-send-btn');
  let pendingTranslation = '';

  function getInput() {
    return document.querySelector('footer [contenteditable="true"]')
        || document.querySelector('div[role="textbox"][contenteditable="true"]')
        || document.querySelector('[data-tab="10"][contenteditable="true"]');
  }

  function getSendBtn() {
    return document.querySelector('[data-testid="send"]')
        || document.querySelector('button[aria-label*="Send"]')
        || document.querySelector('span[data-icon="send"]')?.closest('button');
  }

  function setContent(el, text) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('insertText', false, text);
  }

  // 键盘适配
  let kbHeight = 0;
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      kbHeight = Math.max(0, window.innerHeight - window.visualViewport.height);
      bar.style.bottom = kbHeight > 50 ? kbHeight + 'px' : '0';
      cfgBtn.style.display = kbHeight > 150 ? 'none' : 'flex';
    });
  }

  let trTimer;
  let lastText = '';

  function watchInput() {
    const input = getInput();
    if (!input) return;

    input.addEventListener('input', () => {
      const text = input.innerText?.trim() || '';
      if (text === lastText) return;
      lastText = text;

      clearTimeout(trTimer);
      bar.classList.remove('show');
      pendingTranslation = '';

      if (!text || !/[\u4e00-\u9fa5]/.test(text)) return;

      // 延迟翻译预览
      trTimer = setTimeout(async () => {
        document.getElementById('cnu-translated').textContent = '翻译中…';
        bar.classList.add('show');
        sendBtn.disabled = true;
        try {
          const res = await tr(text, 'zh-CN', cfg.sendLang);
          pendingTranslation = res;
          document.getElementById('cnu-translated').textContent = res;
          sendBtn.disabled = false;
        } catch (_) {
          bar.classList.remove('show');
        }
      }, 800);
    });
  }

  // 点"发送翻译"
  sendBtn.onclick = async () => {
    if (!pendingTranslation) return;
    const input = getInput();
    if (!input) return;
    setContent(input, pendingTranslation);
    bar.classList.remove('show');
    pendingTranslation = '';
    lastText = '';
    await new Promise(r => setTimeout(r, 200));
    const btn = getSendBtn();
    if (btn) btn.click();
    else input.dispatchEvent(new KeyboardEvent('keydown',
      { key:'Enter', keyCode:13, bubbles:true }));
  };

  // 点"✕"取消翻译
  cancelBtn.onclick = () => {
    bar.classList.remove('show');
    clearTimeout(trTimer);
    pendingTranslation = '';
  };

  // 等待输入框出现
  const observer = new MutationObserver(() => {
    if (getInput()) { watchInput(); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (getInput()) watchInput();

})();
