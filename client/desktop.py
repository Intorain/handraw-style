#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HandRaw Style Studio - 桌面原生客户端主入口 (Native Desktop App)
使用 Microsoft Edge WebView2 提供无地址栏、无黑框的纯粹桌面应用体验。
"""

import os
import sys
import time
import socket
import threading
import webbrowser
from pathlib import Path
from http.server import HTTPServer

# 引入基础服务端组件
from server import StudioHandler, check_and_sync_cloud_data, CLIENT_DIR, IS_FROZEN

def find_available_port(start_port=8765):
    for offset in range(100):
        port = start_port + offset
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    return start_port

def start_background_server(port):
    server = HTTPServer(("127.0.0.1", port), StudioHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    # 启动 2 秒后异步触发一次云端画风库自动拉新探测
    def async_sync():
        time.sleep(2.0)
        try:
            check_and_sync_cloud_data(force=False)
        except Exception:
            pass

    threading.Thread(target=async_sync, daemon=True).start()
    return server

def main():
    # 命令行参数解析
    server_only = "--server-only" in sys.argv
    use_browser = "--browser" in sys.argv
    custom_port = None
    for arg in sys.argv[1:]:
        if arg.isdigit():
            custom_port = int(arg)

    port = custom_port or find_available_port(8765)
    app_url = f"http://127.0.0.1:{port}"

    # 启动后台本地 HTTP 引擎
    server = start_background_server(port)
    time.sleep(0.3)

    icon_path = CLIENT_DIR / "assets" / "app_icon.ico"
    if not icon_path.exists():
        icon_path = CLIENT_DIR.parent / "client" / "assets" / "app_icon.ico"

    if server_only:
        print(f"HandRaw Style Studio 服务端已启动: {app_url} (按 Ctrl+C 退出)")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)

    # 尝试启动原生 WebView2 桌面窗口
    webview_launched = False
    if not use_browser:
        try:
            import webview

            window = webview.create_window(
                title="HandRaw Style Studio - 独立手绘创作客户端",
                url=app_url,
                width=1380,
                height=880,
                min_size=(1024, 680),
                background_color="#F7F4EE",
                text_select=True,
                zoomable=True
            )

            # 启动 WebView 消息循环 (Edge Chromium 内核，轻量极速)
            webview.start(gui="edgechromium", debug=False)
            webview_launched = True
        except Exception as e:
            print(f"[Warn] 原生 WebView2 启动受阻，自动回退到默认浏览器: {e}")

    # 若 WebView 不可用或用户指定使用浏览器，则调用默认浏览器
    if not webview_launched:
        webbrowser.open(app_url)
        print(f"HandRaw Style Studio 已在浏览器打开: {app_url}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            sys.exit(0)

if __name__ == "__main__":
    main()
