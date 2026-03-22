(function() {
  'use strict';
  if (window.__cnu_loaded) return;
  window.__cnu_loaded = true;

  // ==================== 翻译API ====================
  async function doTranslate(text, src, tgt) {
    if (!text || !text.trim()) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (d && d[0]) return d[0].map(i => i[0] || '').join('');
    } catch(e) {}
    try {
      const lp = `${src === 'auto' ? 'en' : src}|${tgt}`;
      const r2 = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${lp}`, { signal: AbortSignal.timeout(8000) });
      const d2 = await r2.json();
      if (d2?.responseData?.translatedText) return d2.responseData.translatedText;
    } catch(e) {}
    throw new Error('翻译失败');
  }

  // ==================== 设置 ====================
  let cfg = { on: true, auto: false, tgt: 'zh-CN', sendLang: 'en', autoSend: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('__cnu') || '{}')); } catch(e) {}
  function saveCfg() { localStorage.setItem('__cnu', JSON.stringify(cfg)); }

  const LANGS = {
    'zh-CN':'中文简体','zh-TW':'中文繁体','en':'English','es':'Español',
    'fr':'Français','de':'Deutsch','ar':'العربية','pt':'Português',
    'ru':'Русский','ja':'日本語','ko':'한국어','it':'Italiano','tr':'Türkçe'
  };
  function langOpts(sel) {
    return Object.entries(LANGS).map(([v,l]) =>
      `<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');
  }

  // ==================== 样式 ====================
  const style = document.createElement('style');
  style.textContent = `
    #cnu-fab {
      position: fixed;
      right: 14px;
      bottom: 80px;
      width: 48px; height: 48px;
      background: linear-gradient(135deg,#667eea,#764ba2);
      border-radius: 50%;
      border: none;
      color: white;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(102,126,234,.5);
      z-index: 99998;
      display: flex; align-items: center; justify-content: center;
      transition: bottom .2s, opacity .2s;
    }
    #cnu-fab.hidden { opacity: 0; pointer-events: none; }
    #cnu-panel {
      position: fixed;
      right: 10px; left: 10px;
      bottom: 80px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18);
      z-index: 99999;
      overflow: hidden;
      display: none;
      max-width: 360px;
      margin: 0 auto;
    }
    #cnu-panel.show { display: block; }
    .cnu-hd {
      background: linear-gradient(135deg,#667eea,#764ba2);
      color: white;
      padding: 12px 14px;
      font-weight: 700;
      font-size: 14px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .cnu-close { background:none;border:none;color:white;font-size:18px;cursor:pointer;padding:0; }
    .cnu-body { padding: 10px 14px; }
    .cnu-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px; color: #333;
    }
    .cnu-row:last-child { border: none; }
    .cnu-sw { position:relative;width:42px;height:23px;flex-shrink:0; }
    .cnu-sw input { opacity:0;width:0;height:0; }
    .cnu-sl {
      position:absolute;inset:0;background:#ccc;border-radius:23px;
      cursor:pointer;transition:.3s;
    }
    .cnu-sl::before {
      content:'';position:absolute;width:17px;height:17px;
      left:3px;bottom:3px;background:white;border-radius:50%;transition:.3s;
    }
    input:checked+.cnu-sl { background:#667eea; }
    input:checked+.cnu-sl::before { transform:translateX(19px); }
    .cnu-sel {
      border:1.5px solid #e0e0e0;border-radius:8px;
      padding:4px 8px;font-size:12px;background:white;max-width:120px;
    }
    .cnu-foot { padding:8px;text-align:center;font-size:11px;color:#bbb;background:#fafafa; }
    .cnu-tbtn {
      display:inline-flex;align-items:center;gap:3px;
      background:#667eea;color:white;border:none;border-radius:10px;
      padding:2px 8px;font-size:11px;cursor:pointer;
      margin:3px 0 0 4px;vertical-align:middle;font-family:inherit;
    }
    .cnu-result {
      display:block;font-size:12px;color:#667eea;
      margin-top:4px;padding-top:4px;
      border-top:1px solid rgba(102,126,234,.2);line-height:1.5;
    }
    .cnu-toast {
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(0,0,0,.75);color:white;
      padding:9px 18px;border-radius:20px;
      font-size:13px;z-index:999999;pointer-events:none;
    }
  `;
  document.head.appendChild(style);

  // ==================== FAB & 面板 ====================
  const fab = document.createElement('button');
  fab.id = 'cnu-fab'; fab.textContent = '🌐';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'cnu-panel';
  panel.innerHTML = `
    <div class="cnu-hd">
      <span>🌐 ChinaCNU 翻译助手</span>
      <button class="cnu-close" id="cnuX">✕</button>
    </div>
    <div class="cnu-body">
      <div class="cnu-row">
        <span>启用翻译</span>
        <label class="cnu-sw"><input type="checkbox" id="cnuOn"><span class="cnu-sl"></span></label>
      </div>
      <div class="cnu-row">
        <span>自动翻译新消息</span>
        <label class="cnu-sw"><input type="checkbox" id="cnuAuto"><span class="cnu-sl"></span></label>
      </div>
      <div class="cnu-row">
        <span>翻译为</span>
        <select class="cnu-sel" id="cnuTgt">${langOpts(cfg.tgt)}</select>
      </div>
      <div class="cnu-row">
        <span>输入中文自动翻译发送</span>
        <label class="cnu-sw"><input type="checkbox" id="cnuSend"><span class="cnu-sl"></span></label>
      </div>
      <div class="cnu-row" id="cnuSendRow" style="opacity:${cfg.autoSend?1:.4}">
        <span>发送语言</span>
        <select class="cnu-sel" id="cnuSendLang">${langOpts(cfg.sendLang)}</select>
      </div>
    </div>
    <div class="cnu-foot">ChinaCNU · 外贸专业翻译 · 免费</div>
  `;
  document.body.appendChild(panel);

  document.getElementById('cnuOn').checked = cfg.on;
  document.getElementById('cnuAuto').checked = cfg.auto;
  document.getElementById('cnuSend').checked = cfg.autoSend;

  fab.addEventListener('click', () => panel.classList.toggle('show'));
  document.getElementById('cnuX').addEventListener('click', () => panel.classList.remove('show'));

  ['cnuOn','cnuAuto','cnuSend','cnuTgt','cnuSendLang'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      cfg.on       = document.getElementById('cnuOn').checked;
      cfg.auto     = document.getElementById('cnuAuto').checked;
      cfg.autoSend = document.getElementById('cnuSend').checked;
      cfg.tgt      = document.getElementById('cnuTgt').value;
      cfg.sendLang = document.getElementById('cnuSendLang').value;
      document.getElementById('cnuSendRow').style.opacity = cfg.autoSend ? '1' : '.4';
      saveCfg();
    });
  });

  // ==================== 键盘弹出时隐藏FAB ====================
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const kbHeight = window.innerHeight - window.visualViewport.height;
      if (kbHeight > 150) {
        fab.classList.add('hidden');
        panel.classList.remove('show');
      } else {
        fab.classList.remove('hidden');
      }
    });
  }

  // ==================== Toast ====================
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'cnu-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 1800);
  }

  // ==================== 消息翻译按钮 ====================
  const done = new WeakSet();

  function addBtn(el) {
    if (done.has(el)) return;
    done.add(el);
    const textEl = el.querySelector('span.selectable-text')
                || el.querySelector('[class*="copyable-text"]');
    if (!textEl) return;
    const text = textEl.innerText?.trim();
    if (!text || text.length < 1) return;

    const btn = document.createElement('button');
    btn.className = 'cnu-tbtn'; btn.innerHTML = '🌐 译';
    btn.onclick = async e => {
      e.stopPropagation();
      btn.textContent = '…'; btn.disabled = true;
      try {
        const res = await doTranslate(text, 'auto', cfg.tgt);
        let r = el.querySelector('.cnu-result');
        if (!r) { r = document.createElement('span'); r.className='cnu-result'; textEl.after(r); }
        r.textContent = '🌐 ' + res;
      } catch(err) {
        toast('翻译失败，请检查网络');
      }
      btn.innerHTML = '🌐 译'; btn.disabled = false;
    };

    const foot = el.querySelector('[data-testid="msg-meta"]')
               || el.querySelector('[class*="tail"]')
               || textEl.parentElement;
    if (foot) foot.appendChild(btn);

    if (cfg.auto && cfg.on) btn.click();
  }

  function scan() {
    if (!cfg.on) return;
    document.querySelectorAll('[class*="message-in"]').forEach(m => {
      try { addBtn(m); } catch(e) {}
    });
  }

  new MutationObserver(() => {
    clearTimeout(window.__cnuT);
    window.__cnuT = setTimeout(scan, 600);
  }).observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 2000);

  // ==================== 发送翻译（中文→目标语言）====================
  function getInput() {
    return document.querySelector('footer [contenteditable="true"]')
        || document.querySelector('div[role="textbox"][contenteditable="true"]')
        || document.querySelector('[data-tab="10"][contenteditable="true"]');
  }

  function getSendBtn() {
    return document.querySelector('[data-testid="send"]')
        || document.querySelector('[data-tab="11"]')
        || document.querySelector('button[aria-label*="Send"]')
        || document.querySelector('span[data-icon="send"]')?.closest('button');
  }

  function setContent(el, text) {
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, text);
  }

  document.addEventListener('keydown', async e => {
    if (!cfg.autoSend || !cfg.on) return;
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;

    const input = getInput();
    if (!input) return;

    const text = input.innerText?.trim();
    if (!text) return;

    // 只翻译包含中文的内容
    if (!/[\u4e00-\u9fa5]/.test(text)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    toast('翻译中…');
    try {
      const translated = await doTranslate(text, 'zh-CN', cfg.sendLang);
      setContent(input, translated);
      await new Promise(r => setTimeout(r, 250));
      const btn = getSendBtn();
      if (btn) {
        btn.click();
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown',
          { key:'Enter', code:'Enter', keyCode:13, which:13, bubbles:true }));
      }
    } catch(err) {
      toast('翻译失败，原文已保留');
    }
  }, true);

  toast('🌐 翻译助手已启动');
})();
