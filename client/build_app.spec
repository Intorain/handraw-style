# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec - HandRaw Style Studio 桌面应用打包规约
"""

import sys
import os
from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

SPEC_DIR = Path(SPEC).resolve().parent if 'SPEC' in locals() else Path('.').resolve()
ROOT_DIR = SPEC_DIR.parent if SPEC_DIR.name == 'client' else SPEC_DIR
CLIENT_DIR = ROOT_DIR / 'client'
IMAGES_DIR = ROOT_DIR / 'images'
REF_DIR = ROOT_DIR / 'skills' / 'handdraw-style-prompter' / 'references'
ASSETS_DIR = CLIENT_DIR / 'assets'

datas = [
    # 核心网页前端
    (str(CLIENT_DIR / 'index.html'), 'client'),
    (str(CLIENT_DIR / 'css'), 'client/css'),
    (str(CLIENT_DIR / 'js'), 'client/js'),
    (str(CLIENT_DIR / 'assets'), 'client/assets'),
    (str(CLIENT_DIR / 'partners.json'), 'client'),
    (str(CLIENT_DIR / 'version.json'), 'client'),
    # 离线手绘风格参考数据与色彩
    (str(REF_DIR), 'references'),
    # 预置 331 种画风大图 (提供初次启动即离线可用的极致画廊体验)
    (str(IMAGES_DIR), 'images'),
]

# 收集 pywebview 与 pythonnet 相关依赖
hiddenimports = [
    'webview',
    'webview.platforms.winforms',
    'clr',
    'pythonnet',
    'proxy_tools',
    'urllib.request',
    'urllib.parse',
    'http.server',
    'json',
    'mimetypes',
    'threading',
    'webbrowser',
    'socket',
    'ssl',
    'hashlib',
]

a = Analysis(
    [str(CLIENT_DIR / 'desktop.py')],
    pathex=[str(CLIENT_DIR), str(ROOT_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'torch', 'torchvision', 'transformers'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='HandRawStyleStudio',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,  # 无控制台黑框 (纯净 GUI 应用)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ASSETS_DIR / 'app_icon.ico'),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='HandRawStyleStudio',
)
