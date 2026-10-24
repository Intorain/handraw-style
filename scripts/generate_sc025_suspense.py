#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import base64
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT_DIR / "output" / "sc025-suspense-story"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

API_URL = "http://localhost:3000/v1/images/generations"
API_KEY = "chatgpt2api"
MODEL = "gpt-image-2"

CARDS = [
    {
        "id": "card_01",
        "title": "深渊合租协议 · 01 禁忌入住",
        "prompt": (
            "图型：对话气泡社媒卡。主题色：佩恩灰（Payne's Grey）。"
            "主题：现代都市悬疑系列故事第一幕《深渊合租协议：禁忌入住》。"
            "排版要求：小红书社媒卡。上文下图版式，上方画面是留白无缝衔接的冷灰区域，悬浮两个手绘半透明对话与独白气泡，包含清晰手写文案："
            "气泡一：'月租只要八百。但千万记住——凌晨十二点后，绝对不能看猫眼。' "
            "气泡二：'这间屋子的温度，比走廊外面至少低了五度……' "
            "图文无明显边界自然过渡。下方画面为昏暗的老旧复古公寓玄关，身着深色夹克的年轻租客手提黑色行李箱站在门前，门内走廊地毯上有一道隐秘拖拽暗痕延伸向深处半掩的红木房门，门缝漆黑，微透冷绿阴影。"
            "风格名称：Retro 90s Cel Anime & Korean Mood Webtoon。参考作者/风格名称：日系90s赛璐珞与韩系情绪条漫。"
            "核心风格特征：日系二维与现代韩系融合的插画风格，具备1990年代手绘赛璐珞动画视觉质感，二维平涂，手绘墨色线条，硬边缘阴影，冷暖对比，低饱和胶片颗粒，电影级故事氛围。"
            "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
        )
    },
    {
        "id": "card_02",
        "title": "深渊合租协议 · 02 承重墙的响动",
        "prompt": (
            "图型：对话气泡社媒卡。主题色：佩恩灰（Payne's Grey）。"
            "主题：现代都市悬疑系列故事第二幕《深渊合租协议：承重墙的响动》。"
            "排版要求：小红书社媒卡。上文下图版式，上方悬浮着神经紧绷的思维对话气泡，包含清晰手写文案："
            "气泡一：''笃……笃……笃。'又是这个节奏，每隔三分钟一次。' "
            "气泡二：'等等……根据户型图，这面墙背后明明是实心承重墙，根本没有隔壁房间！' "
            "图文无明显边界自然衔接。下方画面为深夜极简卧室，微弱台灯照亮惊醒坐起的青年，床头墙壁壁纸有一道微小裂缝，阴影深处正有微小灰尘颗粒簌簌飘落，墙体深处散发隐蔽诡异冷光。"
            "风格名称：Retro 90s Cel Anime & Korean Mood Webtoon。参考作者/风格名称：日系90s赛璐珞与韩系情绪条漫。"
            "核心风格特征：日系二维与现代韩系融合的插画风格，具备1990年代手绘赛璐珞动画视觉质感，二维平涂，手绘墨色线条，硬边缘阴影，冷暖对比，低饱和胶片颗粒，电影级故事氛围。"
            "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
        )
    },
    {
        "id": "card_03",
        "title": "深渊合租协议 · 03 猫眼里的瞳孔",
        "prompt": (
            "图型：对话气泡社媒卡。主题色：佩恩灰（Payne's Grey）。"
            "主题：现代都市悬疑系列故事第三幕《深渊合租协议：猫眼里的瞳孔》。"
            "排版要求：小红书社媒卡。上文下图版式，上方悬浮着惊悚战栗的独白气泡，包含清晰手写文案："
            "气泡一：'好奇心害死猫……我还是走到了防盗门前。' "
            "气泡二：'门外感应灯亮着，走廊空无一人……那猫眼正中央转动的那颗血丝眼球，到底是谁的？！' "
            "图文无明显边界。下方画面为具有极强冲击力的金属门猫眼鱼眼特写视界，猫眼凸面镜内倒映着空荡走廊，然而正中贴着一只布满血丝向内张望的冰冷眼眸，同时锈蚀的金属门把手正在无声地缓缓下压到底。"
            "风格名称：Retro 90s Cel Anime & Korean Mood Webtoon。参考作者/风格名称：日系90s赛璐珞与韩系情绪条漫。"
            "核心风格特征：日系二维与现代韩系融合的插画风格，具备1990年代手绘赛璐珞动画视觉质感，二维平涂，手绘墨色线条，硬边缘阴影，冷暖对比，低饱和胶片颗粒，电影级故事氛围。"
            "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
        )
    },
    {
        "id": "card_04",
        "title": "深渊合租协议 · 04 记忆的第四次循环",
        "prompt": (
            "图型：对话气泡社媒卡。主题色：佩恩灰（Payne's Grey）。"
            "主题：现代都市悬疑系列故事第四幕《深渊合租协议：记忆的第四次循环》。"
            "排版要求：小红书社媒卡。上文下图版式，上方悬浮着高潮反转独白气泡，包含清晰手写文案："
            "气泡一：'在床板最底下的暗槽里，我摸出了一支老式录音笔。' "
            "气泡二：'按下播放键，里面传出的竟是我自己的声音：'你好林巡，欢迎来到第四次循环。'' "
            "图文无明显边界。下方画面为青年半跪在阴暗地板上，手电筒光柱聚焦在床底深处一只带红灯的黑色金属录音笔上，周围散落着多份不同年份的泛黄租房合同，每份签名都赫然写着他自己的名字。"
            "风格名称：Retro 90s Cel Anime & Korean Mood Webtoon。参考作者/风格名称：日系90s赛璐珞与韩系情绪条漫。"
            "核心风格特征：日系二维与现代韩系融合的插画风格，具备1990年代手绘赛璐珞动画视觉质感，二维平涂，手绘墨色线条，硬边缘阴影，冷暖对比，低饱和胶片颗粒，电影级故事氛围。"
            "【如果主题直白包含画面元素那就按主题出图，文案由你来升华，但是不要直接描述画面。 如果主题比较概念化，那么文案和主题尽量保持一致，如果文案较长由你提炼，由你先设计画面隐喻（人类和非人类都行）再出图   。    文字参与构图，图文一体】"
        )
    }
]


def generate_image(prompt: str, target_file: Path) -> bool:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "size": "1024x1024",
        "n": 1
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }
    )
    for attempt in range(1, 3):
        try:
            print(f"  [Requesting] Attempt {attempt} for {target_file.name}...", flush=True)
            with urllib.request.urlopen(req, timeout=120) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                item = res["data"][0]
                if "b64_json" in item and item["b64_json"]:
                    img_bytes = base64.b64decode(item["b64_json"])
                    target_file.write_bytes(img_bytes)
                    print(f"  [Saved] B64 image saved to {target_file} ({len(img_bytes)} bytes)", flush=True)
                    return True
                elif "url" in item and item["url"]:
                    url = item["url"]
                    if url.startswith("data:image"):
                        b64 = url.split(",", 1)[1]
                        img_bytes = base64.b64decode(b64)
                    else:
                        with urllib.request.urlopen(url, timeout=30) as r:
                            img_bytes = r.read()
                    target_file.write_bytes(img_bytes)
                    print(f"  [Saved] URL image saved to {target_file} ({len(img_bytes)} bytes)", flush=True)
                    return True
        except Exception as e:
            print(f"  [Error] Attempt {attempt} failed: {e}", flush=True)
            time.sleep(3)
    return False


def main():
    print(f"=== Starting Generation for 4 SC-025 Suspense Cards ===")
    results = []
    for idx, card in enumerate(CARDS, 1):
        target = OUTPUT_DIR / f"{card['id']}.png"
        print(f"\n[{idx}/4] Generating {card['title']} -> {target.name}...")
        ok = generate_image(card["prompt"], target)
        results.append((card["id"], card["title"], target, ok))
        time.sleep(1)

    print("\n=== Generation Summary ===")
    for cid, title, target, ok in results:
        status = "SUCCESS" if ok and target.exists() else "FAILED"
        print(f"- {title}: {status} ({target})")


if __name__ == "__main__":
    main()
