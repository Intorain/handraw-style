#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HandRaw Style Studio - 独立桌面应用与安装包构建流水线 (Build Pipeline)
1. PyInstaller 编译无控制台桌面应用程序 (dist/HandRawStyleStudio/)
2. Inno Setup 编译标准 Windows 安装向导 (release/HandRawStyleStudio_Setup_v1.0.0.exe)
3. 打包绿色便携版 Zip (release/HandRawStyleStudio_v1.0.0_Portable.zip)
"""

import os
import sys
import time
import shutil
import hashlib
import zipfile
import argparse
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CLIENT_DIR = ROOT_DIR / "client"
DIST_DIR = ROOT_DIR / "dist"
RELEASE_DIR = ROOT_DIR / "release"
SPEC_FILE = CLIENT_DIR / "build_app.spec"
ISS_FILE = CLIENT_DIR / "installer.iss"

# Windows 终端编码保护
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def find_iscc_compiler():
    """多路径探测 Inno Setup 命令行编译器 ISCC.exe"""
    possible_paths = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6" / "ISCC.exe",
        Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files (x86)\Inno Setup 7\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 7\ISCC.exe"),
    ]

    # 优先检查常见安装路径
    for p in possible_paths:
        if p.exists():
            return str(p)

    # 检查环境变量 PATH
    which_iscc = shutil.which("ISCC.exe") or shutil.which("iscc")
    if which_iscc:
        return which_iscc

    return None

def calc_file_hash(filepath):
    """计算 SHA256 与文件大小 (MB)"""
    sha256 = hashlib.sha256()
    size_bytes = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        while chunk := f.read(1024 * 1024):
            sha256.update(chunk)
    size_mb = size_bytes / (1024 * 1024)
    return size_mb, sha256.hexdigest()

def step1_pyinstaller():
    print("\n" + "=" * 60)
    print("🚀 [Step 1/3] 正在通过 PyInstaller 构建无黑框桌面程序...")
    print("=" * 60)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        str(SPEC_FILE),
        "--clean",
        "--noconfirm",
        "--distpath",
        str(DIST_DIR),
        "--workpath",
        str(ROOT_DIR / "build"),
    ]

    print("执行命令:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=str(ROOT_DIR))
    if res.returncode != 0:
        print("[Error] PyInstaller 构建失败，退出码:", res.returncode)
        sys.exit(1)

    exe_target = DIST_DIR / "HandRawStyleStudio" / "HandRawStyleStudio.exe"
    if not exe_target.exists():
        print("[Error] 未找到生成的桌面程序:", exe_target)
        sys.exit(1)

    print(f"✅ PyInstaller 编译成功: {exe_target}")

def step2_make_portable_zip():
    print("\n" + "=" * 60)
    print("📦 [Step 2/3] 正在打包绿色免安装便携版 (.zip)...")
    print("=" * 60)

    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RELEASE_DIR / "HandRawStyleStudio_v1.0.0_Portable.zip"
    source_folder = DIST_DIR / "HandRawStyleStudio"

    if zip_path.exists():
        zip_path.unlink()

    file_count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for root, _, files in os.walk(source_folder):
            for file in files:
                full_p = Path(root) / file
                rel_p = full_p.relative_to(source_folder.parent)
                zf.write(full_p, arcname=str(rel_p))
                file_count += 1

    size_mb, sha = calc_file_hash(zip_path)
    print(f"✅ 绿色便携版生成完毕 ({file_count} 个文件)")
    print(f"   路径: {zip_path}")
    print(f"   体积: {size_mb:.2f} MB")
    print(f"   SHA256: {sha}")

def step3_compile_installer():
    print("\n" + "=" * 60)
    print("💿 [Step 3/3] 正在通过 Inno Setup 编译标准 Windows 安装包 (.exe)...")
    print("=" * 60)

    iscc_path = find_iscc_compiler()
    if not iscc_path:
        print("[Error] 未找到 Inno Setup 编译器 ISCC.exe，请确保已安装 Inno Setup！")
        sys.exit(1)

    print(f"使用编译器: {iscc_path}")
    cmd = [iscc_path, str(ISS_FILE)]
    res = subprocess.run(cmd, cwd=str(CLIENT_DIR))
    if res.returncode != 0:
        print("[Error] Inno Setup 编译失败，退出码:", res.returncode)
        sys.exit(1)

    installer_target = RELEASE_DIR / "HandRawStyleStudio_Setup_v1.0.0.exe"
    if not installer_target.exists():
        print("[Error] 未找到生成的安装程序:", installer_target)
        sys.exit(1)

    size_mb, sha = calc_file_hash(installer_target)
    print("✅ Windows 一键安装向导打包完成！")
    print(f"   安装包: {installer_target}")
    print(f"   体积:   {size_mb:.2f} MB")
    print(f"   SHA256: {sha}")

def main():
    parser = argparse.ArgumentParser(description="HandRaw Style Studio Installer Builder")
    parser.add_argument("--skip-pyinstaller", action="store_true", help="跳过 PyInstaller 阶段（仅重新打包安装包与 Zip）")
    parser.add_argument("--installer-only", action="store_true", help="仅执行 Inno Setup 安装包编译")
    args = parser.parse_args()

    start_time = time.time()

    if not args.skip_pyinstaller and not args.installer_only:
        step1_pyinstaller()

    if not args.installer_only:
        step2_make_portable_zip()

    step3_compile_installer()

    elapsed = time.time() - start_time
    print("\n" + "=" * 60)
    print(f"🎉 全部发布介质构建成功！总耗时: {elapsed:.1f} 秒")
    print(f"📂 输出目录: {RELEASE_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    main()
