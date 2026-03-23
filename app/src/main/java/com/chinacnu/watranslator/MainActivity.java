package com.chinacnu.watranslator;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    // Desktop Chrome 134 UA
    private static final String CHROME_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/134.0.6998.89 Safari/537.36";

    // 全面伪装 WebView 指纹，包含 userAgentData（WhatsApp 用此检测 WebView）
    private static final String ANTI_DETECT_JS =
        "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});" +
        "Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});" +
        "Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','zh','en-US','en']});" +
        "Object.defineProperty(navigator,'platform',{get:()=>'Win32'});" +
        "window.chrome={runtime:{},loadTimes:function(){},csi:function(){},app:{}};" +
        // userAgentData 是关键 — 真实 Chrome 有，WebView 没有，WhatsApp 用此区分
        "try{Object.defineProperty(navigator,'userAgentData',{get:()=>({" +
        "  brands:[{brand:'Chromium',version:'134'},{brand:'Google Chrome',version:'134'},{brand:'Not-A.Brand',version:'24'}]," +
        "  mobile:false,platform:'Windows'," +
        "  getHighEntropyValues:(h)=>Promise.resolve({" +
        "    architecture:'x86',bitness:'64',mobile:false,model:''," +
        "    platform:'Windows',platformVersion:'15.0.0'," +
        "    uaFullVersion:'134.0.6998.89'," +
        "    fullVersionList:[{brand:'Google Chrome',version:'134.0.6998.89'},{brand:'Chromium',version:'134.0.6998.89'}]" +
        "  })" +
        "})});}catch(e){}";


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 全屏沉浸式（去掉 FLAG_LAYOUT_NO_LIMITS，避免国产机渲染异常）
        getWindow().setStatusBarColor(android.graphics.Color.parseColor("#111b21"));
        setContentView(R.layout.activity_main);
        progressBar = findViewById(R.id.progressBar);
        webView = findViewById(R.id.webView);
        setupWebView();
        requestPermissions();
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("https://web.whatsapp.com");
        }
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setUserAgentString(CHROME_UA);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false);
        }

        // Inject anti-detection JS before any page script runs
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.addJavascriptInterface(new Object() {}, "__cnu__");
        }

        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setBackgroundColor(Color.WHITE);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                // Inject anti-detection as early as possible
                view.evaluateJavascript(ANTI_DETECT_JS, null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                view.evaluateJavascript(ANTI_DETECT_JS, null);
                injectTranslationScript();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                // 不再自动重试（会造成死循环），让用户手动刷新
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://web.whatsapp.com") ||
                    url.startsWith("https://www.whatsapp.com") ||
                    url.startsWith("https://static.whatsapp.net") ||
                    url.startsWith("blob:") ||
                    url.startsWith("https://wa.me")) {
                    return false;
                }
                return true;
            }

            // 关键修复：拦截 GET 请求，去掉 X-Requested-With 头
            // Android WebView 会自动加 X-Requested-With: com.chinacnu.watranslator
            // WhatsApp 服务器检测到此头后返回 4xx，触发 ERR_HTTP_RESPONSE_CODE_FAILURE
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // 只拦截 GET 请求，POST 让 WebView 正常处理（避免破坏登录流程）
                if (!"GET".equals(request.getMethod())) return null;
                // 只处理 WhatsApp 相关域名
                if (!url.startsWith("https://web.whatsapp.com") &&
                    !url.startsWith("https://static.whatsapp.net") &&
                    !url.startsWith("https://www.whatsapp.com") &&
                    !url.startsWith("https://mmg.whatsapp.net")) {
                    return null;
                }
                try {
                    java.net.URL u = new java.net.URL(url);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) u.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setInstanceFollowRedirects(true);
                    // 转发原始请求头，但去掉 X-Requested-With
                    for (Map.Entry<String, String> h : request.getRequestHeaders().entrySet()) {
                        if (!h.getKey().equalsIgnoreCase("X-Requested-With")) {
                            conn.setRequestProperty(h.getKey(), h.getValue());
                        }
                    }
                    conn.setRequestProperty("User-Agent", CHROME_UA);
                    // 转发 Cookie
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) conn.setRequestProperty("Cookie", cookies);
                    int code = conn.getResponseCode();
                    // 解析 Content-Type
                    String ct = conn.getContentType();
                    String mime = "text/html", enc = "UTF-8";
                    if (ct != null) {
                        String[] parts = ct.split(";");
                        mime = parts[0].trim();
                        for (String p : parts) {
                            p = p.trim();
                            if (p.startsWith("charset=")) {
                                enc = p.substring(8).trim();
                            }
                        }
                    }
                    // 保存响应 Cookie
                    List<String> setCookies = conn.getHeaderFields().get("Set-Cookie");
                    if (setCookies != null) {
                        for (String c : setCookies) {
                            CookieManager.getInstance().setCookie(url, c);
                        }
                    }
                    // 构建响应头 Map
                    Map<String, String> respHeaders = new HashMap<>();
                    for (Map.Entry<String, List<String>> e : conn.getHeaderFields().entrySet()) {
                        if (e.getKey() != null && !e.getValue().isEmpty()) {
                            respHeaders.put(e.getKey(), e.getValue().get(0));
                        }
                    }
                    InputStream is = (code >= 400 && conn.getErrorStream() != null)
                        ? conn.getErrorStream() : conn.getInputStream();
                    if (is == null) is = new java.io.ByteArrayInputStream(new byte[0]);
                    return new WebResourceResponse(mime, enc, code,
                        code >= 400 ? "Error" : "OK", respHeaders, is);
                } catch (Exception e) {
                    return null; // 出错则退回 WebView 默认处理
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setProgress(progress);
            }
        });

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        CookieManager.getInstance().setAcceptCookie(true);
    }

    private void injectTranslationScript() {
        // 用 Java 线程从服务器下载脚本，再通过 evaluateJavascript 注入
        // 此方式完全绕过 WhatsApp Web 的 CSP 限制
        new Thread(() -> {
            String script = fetchRemoteScript();
            if (script == null) script = loadAssetScript();
            if (script == null) return;
            final String finalScript = script;
            webView.post(() -> webView.evaluateJavascript(finalScript, null));
        }).start();
    }

    private String fetchRemoteScript() {
        try {
            java.net.URL url = new java.net.URL(
                "https://wa.cnuday.com/translator.js?t=" + System.currentTimeMillis());
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("User-Agent", CHROME_UA);
            if (conn.getResponseCode() != 200) return null;
            java.io.InputStream is = conn.getInputStream();
            byte[] buf = new byte[65536];
            StringBuilder sb = new StringBuilder();
            int n;
            while ((n = is.read(buf)) != -1) sb.append(new String(buf, 0, n, "UTF-8"));
            is.close();
            return sb.toString();
        } catch (Exception e) { return null; }
    }

    private String loadAssetScript() {
        try {
            InputStream is = getAssets().open("translator.js");
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[4096]; int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            is.close();
            return out.toString("UTF-8");
        } catch (IOException e) { return null; }
    }

    private void requestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO},
                CAMERA_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
