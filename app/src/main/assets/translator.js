(function () {
  'use strict';
  if (window.__cnu_loaded) return;
  window.__cnu_loaded = true;

  const VER = 'v1.0.19';

  /* ── 配置 ─────────────────────────────────────────────────── */
  let cfg = { tgt: 'zh-CN', sendLang: 'en', deeplKey: '130905f4-7b9e-43c3-981c-79890049c3d6:fx' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('__cnu4') || '{}')); } catch (_) {}
  const save = () => localStorage.setItem('__cnu4', JSON.stringify(cfg));

  /* ── 样式（最小侵入，不动任何布局） ─────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* 启动徽章 */
    #cnu-badge {
      position: fixed; top: 6px; right: 6px;
      background: #25d366; color: #fff;
      border-radius: 12px; padding: 3px 10px;
      font-size: 11px; font-weight: 700;
      z-index: 2147483647; pointer-events: none;
      opacity: 1; transition: opacity 2s;
    }
    #cnu-badge.hide { opacity: 0; }

    /* 消息下方翻译文字 */
    .cnu-r {
      display: block; font-size: 12px; color: #5a6fd6;
      margin-top: 3px; padding-top: 3px;
      border-top: 1px solid rgba(0,0,0,.08);
      line-height: 1.4; pointer-events: none;
    }

    /* 设置按钮 */
    #cnu-fab {
      position: fixed; bottom: 80px; right: 12px;
      width: 40px; height: 40px; border-radius: 50%;
      background: #25d366; border: none; color: #fff;
      font-size: 18px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
      z-index: 2147483646;
      display: flex; align-items: center; justify-content: center;
    }

    /* 发送翻译条 */
    #cnu-bar {
      position: fixed; left:0; right:0; bottom:0;
      background: #f0f2fe; border-top: 1px solid #d0d5f8;
      z-index: 2147483645;
      display: none; flex-direction: column;
    }
    #cnu-bar.show { display: flex; }
    #cnu-bar-row1 {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-left: 3px solid #667eea;
      margin: 6px 8px 0; background: rgba(102,126,234,.08); border-radius: 6px;
    }
    #cnu-bar-from { font-size: 11px; color: #999; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    #cnu-bar-to   { font-size: 13px; color: #333; font-weight:600; flex:2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    #cnu-bar-x    { background:none; border:none; color:#bbb; font-size:18px; cursor:pointer; padding:0 4px; }
    #cnu-bar-row2 { display: flex; gap:6px; padding: 6px 8px 8px; }
    #cnu-b-orig   { flex:1; background:#e9e9e9; color:#555; border:none; border-radius:20px; padding:9px; font-size:13px; cursor:pointer; }
    #cnu-b-send   { flex:2; background:#25d366; color:#fff; border:none; border-radius:20px; padding:9px; font-size:14px; font-weight:700; cursor:pointer; }
    #cnu-b-send:disabled { background:#a8e6c3; }

    /* 设置面板 */
    #cnu-panel {
      position: fixed; inset:0; background: rgba(0,0,0,.5);
      z-index: 2147483647; display:none; align-items:flex-end;
    }
    #cnu-panel.open { display:flex; }
    #cnu-sheet {
      background:#fff; width:100%; border-radius:16px 16px 0 0;
      padding: 0 0 28px; animation: sheetUp .2s ease;
    }
    @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
    .cnu-handle { width:32px; height:3px; background:#ddd; border-radius:2px; margin:10px auto; }
    .cnu-row { display:flex; align-items:center; justify-content:space-between; padding:12px 18px; border-bottom:1px solid #f0f0f0; font-size:14px; color:#222; }
    .cnu-sel { border:1px solid #e0e0e0; border-radius:8px; padding:6px 10px; font-size:13px; background:#fafafa; max-width:155px; }
    .cnu-ok  { margin:8px 14px 0; width:calc(100% - 28px); background:#25d366; color:#fff; border:none; border-radius:10px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; }
  `;
  document.head.appendChild(style);

  /* ── 启动确认徽章（3秒后淡出） ──────────────────────────── */
  const badge = document.createElement('div');
  badge.id = 'cnu-badge';
  badge.textContent = '🌐 WA译 ' + VER;
  document.body.appendChild(badge);
  setTimeout(() => badge.classList.add('hide'), 3000);
  setTimeout(() => badge.remove(), 5500);

  /* ── 翻译 API ─────────────────────────────────────────────── */
  function abortAfter(ms) {
    try { if (AbortSignal.timeout) return AbortSignal.timeout(ms); } catch(_) {}
    const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal;
  }

  const DEEPL = { 'zh-CN':'ZH','zh-TW':'ZH','en':'EN','es':'ES','fr':'FR','de':'DE','ar':'AR','pt':'PT-BR','ru':'RU','ja':'JA','ko':'KO','it':'IT','tr':'TR','id':'ID' };

  async function translate(text, tgt) {
    if (!text || text.length < 2) throw new Error('skip');
    // DeepL
    if (cfg.deeplKey && DEEPL[tgt]) {
      try {
        const r = await fetch('https://api-free.deepl.com/v2/translate', {
          method:'POST',
          headers:{'Authorization':'DeepL-Auth-Key '+cfg.deeplKey,'Content-Type':'application/json'},
          body: JSON.stringify({text:[text], target_lang:DEEPL[tgt]}),
          signal: abortAfter(7000)
        });
        if (r.ok) { const d=await r.json(); const t=d?.translations?.[0]?.text; if(t) return t; }
      } catch(_) {}
    }
    // Google
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`, {signal:abortAfter(7000)});
      const d=await r.json(); if(d?.[0]) return d[0].map(x=>x[0]||'').join('');
    } catch(_) {}
    throw new Error('failed');
  }

  /* ── 消息翻译 ─────────────────────────────────────────────── */
  const seen = new WeakSet();

  // 从消息节点里提取文字
  function getText(el) {
    // 尝试多种 WhatsApp Web 的文字容器
    const candidates = [
      el.querySelector('[data-testid="balloon-text-content"] span'),
      el.querySelector('[data-testid="balloon-text-content"]'),
      el.querySelector('span.selectable-text.copyable-text'),
      el.querySelector('span.selectable-text'),
      el.querySelector('[class*="selectable-text"]'),
      el.querySelector('[class*="copyable-text"] span'),
      el.querySelector('span[dir]'),
    ];
    for (const n of candidates) {
      if (!n || n.classList?.contains('cnu-r')) continue;
      const t = n.innerText?.trim();
      if (t && t.length > 1) return {node: n, text: t};
    }
    return null;
  }

  function processMsg(el) {
    if (seen.has(el)) return;
    // 跳过自己发出的消息
    if (el.closest('[class*="message-out"]') || el.closest('[class*="tail-out"]')) return;
    seen.add(el);
    const found = getText(el);
    if (!found) return;
    const {node, text} = found;
    // 避免重复翻译
    if (node.nextElementSibling?.classList?.contains('cnu-r')) return;
    translate(text, cfg.tgt).then(res => {
      if (!res || res.trim() === text.trim()) return;
      if (node.nextElementSibling?.classList?.contains('cnu-r')) return;
      const tag = document.createElement('span');
      tag.className = 'cnu-r';
      tag.textContent = res;
      node.after(tag);
    }).catch(()=>{});
  }

  function scanAll() {
    // 主选择器
    document.querySelectorAll('[class*="message-in"]').forEach(m => { try{processMsg(m);}catch(_){} });
    // 备用：data-pre-plain-text（接收消息都有这个属性）
    document.querySelectorAll('[data-pre-plain-text]').forEach(m => {
      if (!m.closest('[class*="message-out"]')) { try{processMsg(m);}catch(_){}; }
    });
  }

  // 防抖扫描（不在键盘弹出期间扫描，避免干扰输入）
  let scanTimer = null;
  let keyboardOpen = false;

  function scheduleScan() {
    if (keyboardOpen) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAll, 1000);
  }

  new MutationObserver(scheduleScan).observe(document.body, {childList:true, subtree:true});
  setTimeout(scanAll, 3000);
  setTimeout(scanAll, 7000);

  /* ── 检测键盘状态（暂停扫描，防止 DOM 修改导致键盘消失）──── */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const kbH = window.innerHeight - window.visualViewport.height;
      keyboardOpen = kbH > 100;
      if (!keyboardOpen) setTimeout(scanAll, 500);
      // 发送条跟随键盘
      bar.style.bottom = keyboardOpen ? kbH + 'px' : '0';
      fab.style.bottom  = keyboardOpen ? (kbH + 8) + 'px' : '80px';
    });
  }

  /* ── 设置按钮 & 面板 ─────────────────────────────────────── */
  const LANGS = {'zh-CN':'中文（简体）','zh-TW':'中文（繁体）','en':'English','es':'Español','fr':'Français','de':'Deutsch','ar':'العربية','pt':'Português','ru':'Русский','ja':'日本語','ko':'한국어','it':'Italiano','tr':'Türkçe','id':'Bahasa Indonesia'};
  const opts = s => Object.entries(LANGS).map(([v,l])=>`<option value="${v}"${v===s?' selected':''}>${l}</option>`).join('');

  const fab = document.createElement('button');
  fab.id = 'cnu-fab'; fab.textContent = '⚙️';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.id = 'cnu-panel';
  panel.innerHTML = `<div id="cnu-sheet">
    <div class="cnu-handle"></div>
    <div class="cnu-row" style="font-size:15px;font-weight:700;color:#25d366;border-bottom:2px solid #f0f0f0">🌐 WA Translator <span style="font-size:11px;color:#bbb;font-weight:400">${VER}</span></div>
    <div class="cnu-row"><span>收到消息翻译为</span><select class="cnu-sel" id="cSel1">${opts(cfg.tgt)}</select></div>
    <div class="cnu-row"><span>中文发送翻译为</span><select class="cnu-sel" id="cSel2">${opts(cfg.sendLang)}</select></div>
    <div class="cnu-row" style="flex-direction:column;align-items:flex-start;gap:8px">
      <span>🔑 DeepL Key（免费，质量更好）</span>
      <input id="cKey" type="password" value="${cfg.deeplKey||''}"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
        style="width:100%;border:1px solid #e0e0e0;border-radius:8px;padding:8px 10px;font-size:12px;background:#fafafa;box-sizing:border-box">
    </div>
    <button class="cnu-ok" id="cOk">保存</button>
  </div>`;
  document.body.appendChild(panel);

  fab.onclick = () => panel.classList.add('open');
  panel.addEventListener('click', e => { if (e.target === panel) panel.classList.remove('open'); });
  document.getElementById('cOk').onclick = () => {
    cfg.tgt      = document.getElementById('cSel1').value;
    cfg.sendLang = document.getElementById('cSel2').value;
    cfg.deeplKey = document.getElementById('cKey').value.trim();
    save(); panel.classList.remove('open');
    document.querySelectorAll('.cnu-r').forEach(e=>e.remove());
    seen.forEach=()=>{}; // clear seen (WeakSet has no clear, just let GC handle it)
    setTimeout(scanAll, 300);
  };

  /* ── 发送翻译条（打中文时弹出，检测到翻译后可选发送） ────── */
  const bar = document.createElement('div');
  bar.id = 'cnu-bar';
  bar.innerHTML = `
    <div id="cnu-bar-row1">
      <span style="font-size:15px">🌐</span>
      <div id="cnu-bar-from"></div>
      <div id="cnu-bar-to">翻译中…</div>
      <button id="cnu-bar-x">✕</button>
    </div>
    <div id="cnu-bar-row2">
      <button id="cnu-b-orig">发送原文</button>
      <button id="cnu-b-send" disabled>🌐 发送翻译</button>
    </div>`;
  document.body.appendChild(bar);

  let pending = '', trTimer = null, lastText = '';

  function hideBar() {
    bar.classList.remove('show'); pending = '';
    document.getElementById('cnu-b-send').disabled = true;
    document.getElementById('cnu-bar-to').textContent = '翻译中…';
  }

  const getInput = () =>
    document.querySelector('[data-tab="10"][contenteditable="true"]') ||
    document.querySelector('footer [contenteditable="true"]') ||
    document.querySelector('div[role="textbox"][contenteditable="true"]');

  const getSend = () =>
    document.querySelector('[data-testid="send"]') ||
    document.querySelector('button[aria-label*="Send"]') ||
    document.querySelector('span[data-icon="send"]')?.closest('button');

  function doSend() { const b=getSend(); if(b) b.click(); }

  function inject(el, text) {
    el.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  }

  document.getElementById('cnu-bar-x').onclick = hideBar;
  document.getElementById('cnu-b-orig').onclick = () => { hideBar(); setTimeout(doSend, 80); };
  document.getElementById('cnu-b-send').onclick = async () => {
    if (!pending) return;
    const inp = getInput(); if(inp) inject(inp, pending);
    hideBar(); await new Promise(r=>setTimeout(r,200)); doSend();
  };

  function watchInput() {
    const inp = getInput(); if (!inp) return;
    inp.addEventListener('input', () => {
      const text = inp.innerText?.trim() || '';
      if (text === lastText) return;
      lastText = text; clearTimeout(trTimer); hideBar();
      if (!text || !/[\u4e00-\u9fa5]/.test(text)) return;

      document.getElementById('cnu-bar-from').textContent = text.slice(0,28) + (text.length>28?'…':'');
      document.getElementById('cnu-bar-to').textContent = '翻译中…';
      document.getElementById('cnu-b-send').disabled = true;
      bar.classList.add('show');

      trTimer = setTimeout(async () => {
        try {
          const res = await translate(text, cfg.sendLang);
          pending = res;
          document.getElementById('cnu-bar-to').textContent = res.slice(0,38) + (res.length>38?'…':'');
          document.getElementById('cnu-b-send').disabled = false;
        } catch(_) { hideBar(); }
      }, 600);
    });
  }

  // 等待输入框出现
  const io = new MutationObserver(() => { const inp=getInput(); if(inp){watchInput();io.disconnect();} });
  io.observe(document.body, {childList:true, subtree:true});
  if (getInput()) watchInput();

})();
