#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HandRaw Style Studio - 本地服务端 (Local Client Server)
零外部依赖，使用 Python 标准库提供 REST API 与静态资源服务。
"""

import os
import sys
import json
import time
import uuid
import base64
import urllib.request
import urllib.error
import urllib.parse
import mimetypes
import subprocess
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Windows 终端编码保护
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 基础目录定位
CLIENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CLIENT_DIR.parent
IMAGES_DIR = ROOT_DIR / "images"
HISTORY_DIR = CLIENT_DIR / "history"
HISTORY_FILE = HISTORY_DIR / "history.json"
PARTNERS_FILE = CLIENT_DIR / "partners.json"
VERSION_FILE = CLIENT_DIR / "version.json"
CACHE_DIR = CLIENT_DIR / "cache"
CACHE_IMG_DIR = CACHE_DIR / "images"

# 云端同步与 CDN 地址
CLOUD_MANIFEST_URL = "https://static.handraw-style.com/manifest.json"
CLOUD_IMG_BASE_URL = "https://img.handraw-style.com/images/"

# 引用数据定位
REFERENCES_DIR = ROOT_DIR / "skills" / "handdraw-style-prompter" / "references"

HISTORY_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_IMG_DIR.mkdir(parents=True, exist_ok=True)

if not HISTORY_FILE.exists():
    HISTORY_FILE.write_text("[]", encoding="utf-8")


def load_json_safe(filepath, default=None):
    if default is None:
        default = {}
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Warn] Failed to read {filepath}: {e}")
        return default


def save_json_safe(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[Error] Failed to save {filepath}: {e}")
        return False


# ---------------- 云端动态同步与多级缓存引擎 ----------------

def fetch_url_json(url, timeout=4.0):
    req = urllib.request.Request(url, headers={"User-Agent": "HandRawStudio-Client/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status == 200:
            return json.loads(resp.read().decode("utf-8"))
    return None

def check_and_sync_cloud_data(force=False):
    """
    检查云端 static.handraw-style.com/manifest.json 是否有新画风或配置，
    若有更新则静默拉取并写入 client/cache/，实现【无需更新客户端，自动拉新画风】
    """
    cache_manifest_file = CACHE_DIR / "manifest.cache.json"
    local_cache_manifest = load_json_safe(cache_manifest_file, {})

    try:
        remote_manifest = fetch_url_json(CLOUD_MANIFEST_URL, timeout=3.5)
        if not remote_manifest:
            return {"synced": False, "reason": "无法连接云端静态源"}

        remote_ver = remote_manifest.get("data_version", "")
        remote_count = remote_manifest.get("styles_count", 0)
        local_ver = local_cache_manifest.get("data_version", "")
        local_count = local_cache_manifest.get("styles_count", 0)

        need_sync = force or (remote_ver != local_ver) or (remote_count > local_count)

        if need_sync:
            print(f"[Cloud Sync] 检测到云端新数据 (版本: {remote_ver}, 画风数: {remote_count})，正在静默拉取...")
            urls = remote_manifest.get("data_urls", {})
            for key, url in urls.items():
                try:
                    data = fetch_url_json(url, timeout=8.0)
                    if data is not None:
                        save_json_safe(CACHE_DIR / f"{key}.json", data)
                except Exception as e:
                    print(f"[Cloud Sync Error] 拉取 {key} 失败: {e}")

            save_json_safe(cache_manifest_file, remote_manifest)
            added = remote_count - local_count if local_count > 0 else 0
            print(f"[Cloud Sync] 云端数据同步成功！新增画风: {added}")
            return {"synced": True, "data_version": remote_ver, "styles_count": remote_count, "new_styles": added}
        else:
            return {"synced": False, "reason": "已是最新云端数据", "data_version": local_ver, "styles_count": local_count}
    except Exception as e:
        return {"synced": False, "reason": f"探测云端异常: {str(e)}"}


def compare_versions(v1, v2):
    """返回 1 (v1 > v2), 0 (v1 == v2), -1 (v1 < v2)"""
    def parse(v):
        return [int(x) for x in str(v).lstrip("v").split(".") if x.isdigit()]
    p1 = parse(v1)
    p2 = parse(v2)
    for a, b in zip(p1, p2):
        if a > b:
            return 1
        elif a < b:
            return -1
    return len(p1) - len(p2)


class StudioHandler(BaseHTTPRequestHandler):
    server_version = "HandRawStudio/1.0.0"

    def log_message(self, format, *args):
        # 简化日志，避免静态文件请求刷屏
        if "/api/" in str(args[0]):
            sys.stdout.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")

    def end_headers_with_cors(self, content_type="application/json", status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

    def do_OPTIONS(self):
        self.end_headers_with_cors()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API 路由
        if path == "/api/data":
            self.handle_api_data()
        elif path == "/api/partners":
            self.handle_api_partners()
        elif path == "/api/version":
            self.handle_api_version()
        elif path == "/api/cloud-sync-status":
            self.handle_api_cloud_sync_status()
        elif path == "/api/history":
            self.handle_api_history()
        # 2. 静态图片路由 (支持本地+云端按需缓存)
        elif path.startswith("/images/"):
            rel_path = path[len("/images/"):]
            local_file = IMAGES_DIR / rel_path
            self.serve_file(local_file, is_image=True, rel_image_path=rel_path)
        elif path.startswith("/history-images/"):
            rel_path = path[len("/history-images/"):]
            local_file = HISTORY_DIR / rel_path
            self.serve_file(local_file)
        # 3. 客户端前端静态文件
        else:
            if path == "/" or path == "":
                local_file = CLIENT_DIR / "index.html"
            else:
                local_file = CLIENT_DIR / path.lstrip("/")
            self.serve_file(local_file)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        body_len = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(body_len) if body_len > 0 else b"{}"
        try:
            body = json.loads(body_raw.decode("utf-8")) if body_raw else {}
        except Exception:
            body = {}

        if path == "/api/test-connection":
            self.handle_test_connection(body)
        elif path == "/api/generate":
            self.handle_generate(body)
        elif path == "/api/edit":
            self.handle_edit(body)
        elif path == "/api/upgrade":
            self.handle_upgrade()
        elif path == "/api/cloud-sync":
            self.handle_api_cloud_sync()
        else:
            self.end_headers_with_cors(status=404)
            self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/history"):
            query = urllib.parse.parse_qs(parsed.query)
            item_id = query.get("id", [""])[0]
            self.handle_delete_history(item_id)
        else:
            self.end_headers_with_cors(status=404)

    # ---------------- 业务处理器 ----------------

    def handle_api_data(self):
        """返回风格、排版、色彩与影调的完整数据集合（优先读取本地增量缓存，无缓存回退到预置）"""
        styles = load_json_safe(CACHE_DIR / "styles.json") or load_json_safe(REFERENCES_DIR / "styles.json", [])
        layouts = load_json_safe(CACHE_DIR / "layouts.json") or load_json_safe(REFERENCES_DIR / "layouts.json", [])
        colors = load_json_safe(CACHE_DIR / "colors.json") or load_json_safe(REFERENCES_DIR / "colors.json", [])
        tones = load_json_safe(CACHE_DIR / "tones.json") or load_json_safe(REFERENCES_DIR / "tones.json", [])
        cache_manifest = load_json_safe(CACHE_DIR / "manifest.cache.json", {})

        # 整理分组与统计信息
        groups_map = {}
        for s in styles:
            grp = s.get("group", "Other")
            prefix = s.get("number", "")[:2] if s.get("number") else "Other"
            if prefix not in groups_map:
                groups_map[prefix] = {"code": prefix, "name": grp, "count": 0}
            groups_map[prefix]["count"] += 1

        payload = {
            "styles": styles,
            "layouts": layouts,
            "colors": colors,
            "tones": tones,
            "groups": list(groups_map.values()),
            "total_styles": len(styles),
            "total_layouts": len(layouts),
            "total_colors": len(colors),
            "data_version": cache_manifest.get("data_version", "local-preset"),
            "cloud_synced": bool(cache_manifest)
        }
        self.end_headers_with_cors()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def handle_api_partners(self):
        """返回中转商与赞助商配置（优先读取云端同步缓存）"""
        partners = load_json_safe(CACHE_DIR / "partners.json") or load_json_safe(PARTNERS_FILE, [])
        self.end_headers_with_cors()
        self.wfile.write(json.dumps({"partners": partners}, ensure_ascii=False).encode("utf-8"))

    def handle_api_cloud_sync_status(self):
        cache_manifest = load_json_safe(CACHE_DIR / "manifest.cache.json", {})
        self.end_headers_with_cors()
        self.wfile.write(json.dumps({
            "cache_manifest": cache_manifest,
            "is_cached": bool(cache_manifest)
        }, ensure_ascii=False).encode("utf-8"))

    def handle_api_cloud_sync(self):
        res = check_and_sync_cloud_data(force=True)
        self.end_headers_with_cors()
        self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))

    def handle_api_version(self):
        """Codex 风格版本检查：本地版本 vs 远端最新版本"""
        local_ver_data = load_json_safe(VERSION_FILE, {
            "version": "1.0.0",
            "release_date": "2026-10-17",
            "channel": "stable",
            "check_url": "https://raw.githubusercontent.com/yang0/handraw-style/master/client/version.json",
            "changelog": []
        })

        current_ver = local_ver_data.get("version", "1.0.0")
        check_url = local_ver_data.get("check_url", "")
        remote_data = None
        has_update = False

        if check_url:
            try:
                req = urllib.request.Request(
                    check_url,
                    headers={"User-Agent": "HandRawStudio-Client/1.0"}
                )
                with urllib.request.urlopen(req, timeout=3.0) as resp:
                    if resp.status == 200:
                        remote_data = json.loads(resp.read().decode("utf-8"))
                        remote_ver = remote_data.get("version", current_ver)
                        if compare_versions(remote_ver, current_ver) > 0:
                            has_update = True
            except Exception as e:
                # 远端网络不可达时静默回退
                pass

        resp_payload = {
            "current_version": current_ver,
            "local": local_ver_data,
            "remote": remote_data,
            "has_update": has_update,
            "latest_version": remote_data.get("version", current_ver) if remote_data else current_ver,
            "changelog": remote_data.get("changelog", local_ver_data.get("changelog", [])) if remote_data else local_ver_data.get("changelog", [])
        }
        self.end_headers_with_cors()
        self.wfile.write(json.dumps(resp_payload, ensure_ascii=False).encode("utf-8"))

    def handle_upgrade(self):
        """一键升级机制：尝试 git pull 或拉取更新"""
        result = {"success": False, "message": ""}
        try:
            # 检查是否处于 git 仓库中
            git_check = subprocess.run(
                ["git", "status"],
                cwd=str(ROOT_DIR),
                capture_output=True,
                text=True,
                timeout=5
            )
            if git_check.returncode == 0:
                pull_res = subprocess.run(
                    ["git", "pull", "--ff-only"],
                    cwd=str(ROOT_DIR),
                    capture_output=True,
                    text=True,
                    timeout=20
                )
                if pull_res.returncode == 0:
                    result["success"] = True
                    result["message"] = f"升级成功！Git 输出：\n{pull_res.stdout.strip()}"
                else:
                    # 尝试正常 pull
                    pull_res2 = subprocess.run(
                        ["git", "pull"],
                        cwd=str(ROOT_DIR),
                        capture_output=True,
                        text=True,
                        timeout=20
                    )
                    if pull_res2.returncode == 0:
                        result["success"] = True
                        result["message"] = f"升级成功！\n{pull_res2.stdout.strip()}"
                    else:
                        result["message"] = f"Git 更新冲突或失败：\n{pull_res2.stderr.strip()}"
            else:
                result["message"] = "未检测到 Git 仓库环境。请直接下载最新压缩包覆盖。"
        except Exception as e:
            result["message"] = f"升级过程发生异常: {str(e)}"

        self.end_headers_with_cors()
        self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))

    def handle_test_connection(self, body):
        """测试 API Key 与 Base URL 连通性"""
        base_url = body.get("base_url", "").rstrip("/")
        api_key = body.get("api_key", "").strip()

        if not base_url:
            self.end_headers_with_cors(status=400)
            self.wfile.write(json.dumps({"success": False, "error": "Base URL 不能为空"}).encode("utf-8"))
            return

        # 尝试请求 /models
        test_url = f"{base_url}/models"
        req = urllib.request.Request(
            test_url,
            headers={
                "Authorization": f"Bearer {api_key}" if api_key else "",
                "User-Agent": "HandRawStudio/1.0"
            }
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                elapsed_ms = int((time.time() - start_time) * 1000)
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("id") for m in data.get("data", []) if isinstance(m, dict)]
                self.end_headers_with_cors()
                self.wfile.write(json.dumps({
                    "success": True,
                    "latency_ms": elapsed_ms,
                    "models_count": len(models),
                    "sample_models": models[:10],
                    "message": f"连接成功！延迟 {elapsed_ms}ms"
                }, ensure_ascii=False).encode("utf-8"))
        except urllib.error.HTTPError as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            # 部分中转站对 /models 限制权限，但 /images/generations 可用
            if e.code in [401, 403]:
                msg = f"认证失败 (HTTP {e.code})：请检查 API Key 是否正确"
            elif e.code == 404:
                msg = f"连接通畅，但服务商不支持 /models 查询 (HTTP 404)，仍可直接生图"
            else:
                msg = f"HTTP 错误 {e.code}: {e.reason}"
            self.end_headers_with_cors()
            self.wfile.write(json.dumps({
                "success": (e.code == 404),
                "latency_ms": elapsed_ms,
                "error": msg,
                "status_code": e.code
            }, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            self.end_headers_with_cors()
            self.wfile.write(json.dumps({
                "success": False,
                "error": f"连接超时或网络异常: {str(e)}"
            }, ensure_ascii=False).encode("utf-8"))

    def handle_generate(self, body):
        """执行文生图 (Text-to-Image)"""
        base_url = body.get("base_url", "").rstrip("/")
        api_key = body.get("api_key", "").strip()
        model = body.get("model", "dall-e-3")
        prompt = body.get("prompt", "").strip()
        aspect_ratio = body.get("aspect_ratio", "1:1")
        quality = body.get("quality", "standard")
        params_meta = body.get("params_meta", {})

        if not base_url or not prompt:
            self.end_headers_with_cors(status=400)
            self.wfile.write(json.dumps({"success": False, "error": "Base URL 和 Prompt 提示词均不能为空"}).encode("utf-8"))
            return

        # 计算尺寸
        size = "1024x1024"
        if aspect_ratio == "3:4" or aspect_ratio == "2:3":
            size = "1024x1792" if "dall-e-3" in model else "768x1024"
        elif aspect_ratio == "4:3" or aspect_ratio == "3:2":
            size = "1792x1024" if "dall-e-3" in model else "1024x768"
        elif aspect_ratio == "9:16":
            size = "1024x1792"
        elif aspect_ratio == "16:9":
            size = "1792x1024"

        gen_url = f"{base_url}/images/generations"
        req_payload = {
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": size,
        }
        if "dall-e-3" in model:
            req_payload["quality"] = quality
            req_payload["response_format"] = "b64_json"  # 优先拿 base64 本地持久化

        data_bytes = json.dumps(req_payload).encode("utf-8")
        req = urllib.request.Request(
            gen_url,
            data=data_bytes,
            headers={
                "Authorization": f"Bearer {api_key}" if api_key else "",
                "Content-Type": "application/json",
                "User-Agent": "HandRawStudio/1.0"
            }
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                elapsed = round(time.time() - start_time, 2)
                res_json = json.loads(resp.read().decode("utf-8"))
                
                # 解析返回图像
                item_data = res_json.get("data", [{}])[0]
                img_filename = f"gen_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
                img_filepath = HISTORY_DIR / img_filename

                if "b64_json" in item_data and item_data["b64_json"]:
                    img_bytes = base64.b64decode(item_data["b64_json"])
                    img_filepath.write_bytes(img_bytes)
                elif "url" in item_data and item_data["url"]:
                    # 下载远程图片至本地保存
                    remote_img_url = item_data["url"]
                    req_img = urllib.request.Request(remote_img_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req_img, timeout=30.0) as img_resp:
                        img_filepath.write_bytes(img_resp.read())
                else:
                    raise Exception("服务商返回的数据中未找到有效的图片 URL 或 Base64 数据")

                # 记录入历史文件
                history_list = load_json_safe(HISTORY_FILE, [])
                history_entry = {
                    "id": str(uuid.uuid4()),
                    "timestamp": int(time.time()),
                    "time_str": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "filename": img_filename,
                    "url": f"/history-images/{img_filename}",
                    "prompt": prompt,
                    "model": model,
                    "aspect_ratio": aspect_ratio,
                    "size": size,
                    "elapsed_sec": elapsed,
                    "type": "text2img",
                    "meta": params_meta
                }
                history_list.insert(0, history_entry)
                save_json_safe(HISTORY_FILE, history_list)

                self.end_headers_with_cors()
                self.wfile.write(json.dumps({
                    "success": True,
                    "image": history_entry,
                    "elapsed": elapsed,
                    "revised_prompt": item_data.get("revised_prompt", "")
                }, ensure_ascii=False).encode("utf-8"))

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"[Generate Error] HTTP {e.code}: {err_body}")
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get("error", {}).get("message", err_body)
            except Exception:
                err_msg = err_body
            self.end_headers_with_cors(status=e.code)
            self.wfile.write(json.dumps({"success": False, "error": f"生图接口报错 (HTTP {e.code}): {err_msg}"}, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            print(f"[Generate Error] {e}")
            self.end_headers_with_cors(status=500)
            self.wfile.write(json.dumps({"success": False, "error": f"生图请求发生异常: {str(e)}"}).encode("utf-8"))

    def handle_edit(self, body):
        """执行图生图与改图 (Image-to-Image / Edit)"""
        base_url = body.get("base_url", "").rstrip("/")
        api_key = body.get("api_key", "").strip()
        model = body.get("model", "dall-e-2")
        prompt = body.get("prompt", "").strip()
        base_image_data = body.get("base_image", "")  # 可以是 data:image/png;base64,... 或 /history-images/...
        params_meta = body.get("params_meta", {})

        if not base_url or not prompt or not base_image_data:
            self.end_headers_with_cors(status=400)
            self.wfile.write(json.dumps({"success": False, "error": "Base URL、提示词与底图数据均不能为空"}).encode("utf-8"))
            return

        # 准备底图二进制
        try:
            if base_image_data.startswith("data:image"):
                base64_str = base_image_data.split(",", 1)[1]
                input_bytes = base64.b64decode(base64_str)
            elif base_image_data.startswith("/history-images/"):
                fn = base_image_data[len("/history-images/"):]
                input_bytes = (HISTORY_DIR / fn).read_bytes()
            else:
                input_bytes = base64.b64decode(base_image_data)
        except Exception as e:
            self.end_headers_with_cors(status=400)
            self.wfile.write(json.dumps({"success": False, "error": f"底图解析失败: {str(e)}"}).encode("utf-8"))
            return

        # 构建 multipart/form-data
        boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
        c_lines = []
        
        def add_field(name, value):
            c_lines.append(f"--{boundary}".encode())
            c_lines.append(f'Content-Disposition: form-data; name="{name}"'.encode())
            c_lines.append(b"")
            c_lines.append(str(value).encode("utf-8"))

        def add_file(name, filename, file_bytes, content_type="image/png"):
            c_lines.append(f"--{boundary}".encode())
            c_lines.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode())
            c_lines.append(f"Content-Type: {content_type}".encode())
            c_lines.append(b"")
            c_lines.append(file_bytes)

        add_field("model", model)
        add_field("prompt", prompt)
        add_field("n", 1)
        add_field("size", "1024x1024")
        add_field("response_format", "b64_json")
        add_file("image", "source.png", input_bytes, "image/png")

        c_lines.append(f"--{boundary}--".encode())
        c_lines.append(b"")
        body_payload = b"\r\n".join(c_lines)

        edit_url = f"{base_url}/images/edits"
        req = urllib.request.Request(
            edit_url,
            data=body_payload,
            headers={
                "Authorization": f"Bearer {api_key}" if api_key else "",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "HandRawStudio/1.0"
            }
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                elapsed = round(time.time() - start_time, 2)
                res_json = json.loads(resp.read().decode("utf-8"))
                item_data = res_json.get("data", [{}])[0]

                img_filename = f"edit_{int(time.time())}_{uuid.uuid4().hex[:6]}.png"
                img_filepath = HISTORY_DIR / img_filename

                if "b64_json" in item_data and item_data["b64_json"]:
                    img_bytes = base64.b64decode(item_data["b64_json"])
                    img_filepath.write_bytes(img_bytes)
                elif "url" in item_data and item_data["url"]:
                    remote_img_url = item_data["url"]
                    req_img = urllib.request.Request(remote_img_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req_img, timeout=30.0) as img_resp:
                        img_filepath.write_bytes(img_resp.read())
                else:
                    raise Exception("改图接口未返回有效的图片数据")

                # 保存至历史记录
                history_list = load_json_safe(HISTORY_FILE, [])
                history_entry = {
                    "id": str(uuid.uuid4()),
                    "timestamp": int(time.time()),
                    "time_str": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "filename": img_filename,
                    "url": f"/history-images/{img_filename}",
                    "prompt": prompt,
                    "model": model,
                    "elapsed_sec": elapsed,
                    "type": "img2img",
                    "meta": params_meta
                }
                history_list.insert(0, history_entry)
                save_json_safe(HISTORY_FILE, history_list)

                self.end_headers_with_cors()
                self.wfile.write(json.dumps({
                    "success": True,
                    "image": history_entry,
                    "elapsed": elapsed
                }, ensure_ascii=False).encode("utf-8"))

        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"[Edit Error] HTTP {e.code}: {err_body}")
            self.end_headers_with_cors(status=e.code)
            self.wfile.write(json.dumps({"success": False, "error": f"改图接口报错 (HTTP {e.code}): {err_body}"}, ensure_ascii=False).encode("utf-8"))
        except Exception as e:
            print(f"[Edit Error] {e}")
            self.end_headers_with_cors(status=500)
            self.wfile.write(json.dumps({"success": False, "error": f"改图处理异常: {str(e)}"}).encode("utf-8"))

    def handle_api_history(self):
        """获取本地历史生成图列表"""
        history_list = load_json_safe(HISTORY_FILE, [])
        self.end_headers_with_cors()
        self.wfile.write(json.dumps({"history": history_list}, ensure_ascii=False).encode("utf-8"))

    def handle_delete_history(self, item_id):
        """删除单张历史生成图"""
        history_list = load_json_safe(HISTORY_FILE, [])
        new_list = []
        deleted = False
        for item in history_list:
            if item.get("id") == item_id:
                deleted = True
                fn = item.get("filename")
                if fn and (HISTORY_DIR / fn).exists():
                    try:
                        (HISTORY_DIR / fn).unlink()
                    except Exception:
                        pass
            else:
                new_list.append(item)

        if deleted:
            save_json_safe(HISTORY_FILE, new_list)
        self.end_headers_with_cors()
        self.wfile.write(json.dumps({"success": deleted}, ensure_ascii=False).encode("utf-8"))

    # ---------------- 静态资源提供 ----------------

    def serve_file(self, file_path: Path, is_image=False, rel_image_path=""):
        if is_image:
            # 1. 本地源图片存在
            if file_path.exists() and not file_path.is_dir():
                return self.send_file_bytes(file_path)

            # 2. 客户端缓存图片
            cached_file = CACHE_IMG_DIR / rel_image_path
            if cached_file.exists() and not cached_file.is_dir():
                return self.send_file_bytes(cached_file)

            # 3. 本地无此图（云端新增画风），从云端 CDN 拉取并持久化缓存在本地
            cloud_url = f"{CLOUD_IMG_BASE_URL}{rel_image_path.replace(os.sep, '/')}"
            try:
                req = urllib.request.Request(cloud_url, headers={"User-Agent": "HandRawStudio-Client/1.0"})
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    if resp.status == 200:
                        img_bytes = resp.read()
                        cached_file.parent.mkdir(parents=True, exist_ok=True)
                        cached_file.write_bytes(img_bytes)
                        return self.send_raw_bytes(img_bytes, cached_file.suffix)
            except Exception as e:
                pass

            # 4. 兜底默认风格图
            fallback = IMAGES_DIR / "individual" / "FA" / "FA-001.webp"
            if fallback.exists():
                return self.send_file_bytes(fallback)

        if not file_path.exists() or file_path.is_dir():
            self.end_headers_with_cors(status=404)
            self.wfile.write(b"404 Not Found")
            return

        self.send_file_bytes(file_path)

    def send_file_bytes(self, file_path: Path):
        ctype, _ = mimetypes.guess_type(str(file_path))
        if not ctype:
            if file_path.suffix == ".webp":
                ctype = "image/webp"
            elif file_path.suffix == ".json":
                ctype = "application/json"
            else:
                ctype = "application/octet-stream"

        try:
            content = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=86400" if "/images/" in str(file_path) else "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.end_headers_with_cors(status=500)
            self.wfile.write(f"500 Internal Error: {e}".encode("utf-8"))

    def send_raw_bytes(self, content: bytes, suffix: str):
        ctype = "image/webp" if suffix == ".webp" else "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        self.wfile.write(content)


def run_server(port=8765, no_browser=False):
    # 端口自增防冲突
    server = None
    target_port = port
    for offset in range(100):
        try:
            p = target_port + offset
            server = HTTPServer(("127.0.0.1", p), StudioHandler)
            port = p
            break
        except OSError:
            continue

    if not server:
        print("[Error] 无法绑定可用端口，请检查网络占用。")
        sys.exit(1)

    url = f"http://127.0.0.1:{port}"
    print("=" * 60)
    print(f"🎨 HandRaw Style Studio 客户端已成功启动！")
    print(f"🌐 访问地址: {url}")
    print(f"📁 根目录: {ROOT_DIR}")
    print(f"☁️ 云端同步源: {CLOUD_MANIFEST_URL}")
    print("=" * 60)
    print("提示：客户端正在运行，按 Ctrl+C 即可退出服务端。")

    # 延迟 0.6 秒自动打开浏览器 (可通过 --no-browser 禁用)
    if not no_browser:
        def open_browser():
            time.sleep(0.6)
            webbrowser.open(url)

        threading.Thread(target=open_browser, daemon=True).start()

    # 启动 1.5 秒后异步检测云端画风增量更新
    def async_sync_probe():
        time.sleep(1.5)
        check_and_sync_cloud_data(force=False)

    threading.Thread(target=async_sync_probe, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[HandRaw Studio] 服务端已正常停止。")
        server.server_close()


if __name__ == "__main__":
    p = 8765
    no_b = False
    for arg in sys.argv[1:]:
        if arg.isdigit():
            p = int(arg)
        elif arg == "--no-browser":
            no_b = True
    run_server(port=p, no_browser=no_b)
