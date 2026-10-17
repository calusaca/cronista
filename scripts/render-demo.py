"""Offline preview: genuine screen excerpts + stills, English captions, no voice/music.

Requires a complete capture:demo run, the two rendered HTML cards, and FFmpeg
with libx264/libass. No application or model responses are modified.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import textwrap

ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / ".cache/demo-recording"
OUT = ROOT / ".cache/demo-edit"
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = os.environ.get("CRONISTA_FFMPEG", "ffmpeg")
manifest = json.loads((CAPTURE / "manifest.json").read_text())
times = {s["name"]: s["elapsedMs"] / 1000 for s in manifest["scenes"]}


def run(args):
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-filter_threads", "2", "-y", *args], cwd=OUT, check=True)


def stamp(seconds, ass=False):
    centis = round(seconds * 100)
    hours, rest = divmod(centis, 360000)
    minutes, rest = divmod(rest, 6000)
    secs, cs = divmod(rest, 100)
    if ass:
        return f"{hours}:{minutes:02}:{secs:02}.{cs:02}"
    return f"{hours:02}:{minutes:02}:{secs:02},{cs * 10:03}"


def seconds(text):
    minutes, secs = text.split(":")
    return int(minutes) * 60 + int(secs)


cues = []
for line in (ROOT / "docs/entrega/guion-video.md").read_text().splitlines():
    if not re.match(r"\| [01]:\d\d", line):
        continue
    cells = [c.strip() for c in line.split("|")][1:-1]
    start, end = map(seconds, cells[0].split("–"))
    words = cells[-1].split()
    chunks = [words[i:i + 12] for i in range(0, len(words), 12)]
    if len(chunks) > 1 and len(chunks[-1]) < 5:
        chunks[-2].extend(chunks.pop())
    used = 0
    for chunk in chunks:
        a = start + (end - start) * used / len(words)
        used += len(chunk)
        b = start + (end - start) * used / len(words)
        cues.append((a, b, textwrap.fill(" ".join(chunk), width=78)))

srt = "\n\n".join(f"{i}\n{stamp(a)} --> {stamp(b)}\n{text}" for i, (a, b, text) in enumerate(cues, 1)) + "\n"
(ROOT / "docs/entrega/subtitulos-en.srt").write_text(srt)
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 900
WrapStyle: 2
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,26,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,35,35,24,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
for a, b, text in cues:
    text = text.replace("\n", r"\N")
    ass += f"Dialogue: 0,{stamp(a, True)},{stamp(b, True)},Default,,0,0,0,,{text}\n"
(OUT / "subtitles.ass").write_text(ass)

# 110 seconds. Excerpts are slowed to let the viewer inspect them; stills are held.
# The unchanged raw recording and its scene times remain available for comparison.
scenes = [
    ("clip", 0, times["03-process"] - 0.3, 12),
    ("still", "05-analyst.png", None, 18),
    ("still", "03-process.png", None, 15),
    ("clip", times["04-spanish"] - 0.45, times["05-analyst"] + 0.4, 15),
    ("clip", times["06-goal-2d"], times["07-goal-3d"], 17),
    ("still", "08-dataset.png", None, 9),
    ("still", "architecture.png", None, 6),
    ("still", "evaluation.png", None, 18),
]
for i, (kind, source, end, duration) in enumerate(scenes):
    if kind == "clip":
        args = ["-ss", str(source), "-t", str(end - source), "-i", manifest["video"]]
        filters = f"setpts={(duration / (end - source)):.9f}*(PTS-STARTPTS),"
    else:
        args = ["-loop", "1", "-i", str(CAPTURE / source)]
        filters = ""
    filters += "scale=1280:800:flags=lanczos,setsar=1,pad=1280:900:0:0:color=0x151c17,fps=25"
    run([*args, "-vf", filters, "-t", str(duration), "-an", "-c:v", "libx264", "-threads", "4", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", f"scene-{i}.mp4"])
    print(f"Scene {i + 1}/{len(scenes)}: {duration}s", flush=True)

(OUT / "concat.txt").write_text("".join(f"file 'scene-{i}.mp4'\n" for i in range(len(scenes))))
video = OUT / "cronista-demo-en.mp4"
run(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-vf", "ass=subtitles.ass", "-an", "-c:v", "libx264", "-threads", "4", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video)])
report = {
    "video": str(video.relative_to(ROOT)), "seconds": sum(s[3] for s in scenes),
    "size": [1280, 900], "fps": 25, "audio": False,
    "subtitles": "docs/entrega/subtitulos-en.srt", "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
    "sourceCapture": ".cache/demo-recording/manifest.json",
    "editing": "Real local model output; clips slowed and stills held; captions and original cards added. No app data, drafts or verdicts modified. Not publicly hosted or submitted.",
}
(OUT / "render.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
