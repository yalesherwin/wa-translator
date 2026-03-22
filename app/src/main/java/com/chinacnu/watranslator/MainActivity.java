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

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private static final int CAMERA_PERMISSION_REQUEST = 100;

    // Desktop Chrome UA — WhatsApp Web blocks mobile UA with redirect page
    private static final String CHROME_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36";

    // JS injected before page runs — masks WebView fingerprint
    private static final String ANTI_DETECT_JS =
        "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});" +
        "Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});" +
        "Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','zh','en']});" +
        "window.chrome={runtime:{}};" +
        "Object.defineProperty(navigator,'platform',{get:()=>'Win32'});";


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        );
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
                // Retry on error
                if (request.isForMainFrame()) {
                    view.loadUrl("https://web.whatsapp.com");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://web.whatsapp.com") ||
                    url.startsWith("https://www.whatsapp.com") ||
                    url.startsWith("blob:")) {
                    return false;
                }
                return true;
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
            byte[] buf = new byte[is.available()];
            is.read(buf); is.close();
            return new String(buf, "UTF-8");
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
