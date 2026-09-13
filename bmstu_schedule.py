#!/usr/bin/env python3
"""
Выгрузка расписания группы МГТУ им. Баумана из ЛКС (lks.bmstu.ru)
в единый самодостаточный HTML-файл.

Авторизация НЕ требуется — используются публичные эндпоинты бэкенда ЛКС
(найдены разбором JS-бандла lks.bmstu.ru/schedule/list):

  BASE = https://lks.bmstu.ru/lks-back/api/v1
  GET  {BASE}/structure                          -- дерево факультет/кафедра/группа
  GET  {BASE}/schedules/groups/{uuid}/public      -- расписание группы

Страница показывает ДВЕ таблицы одна под другой: сверху — числитель
(верхняя неделя), снизу — знаменатель (нижняя неделя). Занятия "на обе
недели" показываются в обеих. Прямо в браузере, без установки чего-либо
ещё, доступны:

  - переключатель светлой/тёмной темы (запоминается в браузере);
  - подсветка одинаковых предметов при наведении;
  - скачивание PNG-снимка расписания (html2canvas);
  - скачивание Excel-файла (SheetJS);
  - просмотр и скачивание расписания в виде JSON.

Файл сохраняется рядом со скриптом (а не в текущей папке терминала).

Использование:
    python3 bmstu_schedule.py "АК2-51"                  # найти группу и сохранить
    python3 bmstu_schedule.py "АК2-51" -o "Моё расписание"
    python3 bmstu_schedule.py --uuid 81594c57-...
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

BASE = "https://lks.bmstu.ru/lks-back/api/v1"
HEADERS = {"User-Agent": "Mozilla/5.0 (schedule-export-script)"}

DAY_NAMES = {1: "Понедельник", 2: "Вторник", 3: "Среда", 4: "Четверг", 5: "Пятница", 6: "Суббота"}

# Палитра для подсветки предметов (IBM Carbon categorical) — хорошо читается
# и на светлой, и на тёмной теме, т.к. используется только как акцент.
SUBJECT_PALETTE = [
    "6929c4", "1192e8", "005d5d", "9f1853", "fa4d56", "570408", "198038",
    "002d9c", "ee538b", "b28600", "009d9a", "8a3800", "a56eff", "1c7c54",
]


# --------------------------------------------------------------------------- #
# Загрузка данных
# --------------------------------------------------------------------------- #

def fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)["data"]


def flatten_groups(node: dict, path: list[str], out: list[dict]) -> None:
    """Рекурсивно собирает листья дерева /structure, у которых есть 'uuid' и нет children."""
    children = node.get("children") or []
    label = node.get("abbr") or node.get("name") or ""
    new_path = path + [label] if label else path

    if node.get("uuid") and not children:
        out.append({"name": node.get("abbr") or node.get("name"), "uuid": node["uuid"], "path": " / ".join(new_path)})
        return

    for child in children:
        flatten_groups(child, new_path, out)


def find_groups(query: str) -> list[dict]:
    structure = fetch_json(f"{BASE}/structure")
    all_leaves: list[dict] = []
    flatten_groups(structure, [], all_leaves)
    q = query.strip().lower()
    return [g for g in all_leaves if g["name"] and q in g["name"].lower()]


def fetch_group_schedule(group_uuid: str) -> dict:
    return fetch_json(f"{BASE}/schedules/groups/{group_uuid}/public")


# --------------------------------------------------------------------------- #
# Разбор занятий в общий вид
# --------------------------------------------------------------------------- #

def lesson_info(lesson: dict) -> dict:
    disc = lesson.get("discipline") or {}
    name = disc.get("shortName") or disc.get("fullName") or disc.get("abbr") or "?"
    act_type = disc.get("actType", "")
    teachers = lesson.get("teachers") or []
    teacher = ", ".join(
        f"{t.get('lastName', '')} {t.get('firstName', '')[:1]}.{t.get('middleName', '')[:1]}."
        for t in teachers
    )
    rooms = lesson.get("audiences") or []
    room = ", ".join(r.get("name", "") for r in rooms if r.get("name"))
    week = lesson.get("week")
    week = "both" if week in (None, "all") else week
    return {"name": name, "type": act_type, "teacher": teacher, "room": room, "week": week}


def build_grid(schedule: list[dict]) -> tuple[dict[int, tuple[str, str]], dict[tuple[int, int], list[dict]]]:
    """Возвращает {номер_пары: (start,end)} и {(день,пара): [lesson_info, ...]}."""
    time_slots: dict[int, tuple[str, str]] = {}
    cells: dict[tuple[int, int], list[dict]] = {}

    for lesson in schedule:
        day, time_num = lesson["day"], lesson["time"]
        time_slots.setdefault(time_num, (lesson.get("startTime", ""), lesson.get("endTime", "")))
        cells.setdefault((day, time_num), []).append(lesson_info(lesson))

    return time_slots, cells


def compute_axes(time_slots: dict, cells: dict) -> tuple[list[int], list[int]]:
    days = sorted(d for d in DAY_NAMES if any(k[0] == d for k in cells))
    if not days:
        days = list(range(1, 7))
    pairs = sorted(time_slots) or list(range(1, 8))
    return days, pairs


def week_entries(entries: list[dict], week_code: str) -> list[dict]:
    return [e for e in entries if e["week"] in ("both", week_code)]


def subject_colors(cells: dict) -> dict[str, str]:
    colors: dict[str, str] = {}
    for key in sorted(cells):
        for e in cells[key]:
            if e["name"] not in colors:
                colors[e["name"]] = SUBJECT_PALETTE[len(colors) % len(SUBJECT_PALETTE)]
    return colors


# --------------------------------------------------------------------------- #
# HTML
# --------------------------------------------------------------------------- #

def lesson_html(e: dict, colors: dict[str, str]) -> str:
    color = colors.get(e["name"], "888888")
    subj = html.escape(e["name"], quote=True)
    first = html.escape(e["name"])
    if e["type"]:
        first += f" <span class='act'>({html.escape(e['type'])})</span>"
    parts = [first]
    if e["teacher"]:
        parts.append(html.escape(e["teacher"]))
    if e["room"]:
        parts.append(html.escape(e["room"]))
    body = "<br>".join(parts)
    return (f"<div class='lesson' data-subj=\"{subj}\" style='--subj:#{color}'>"
            f"<span class='dot'></span><div class='ltext'>{body}</div></div>")


def render_html_table(days: list[int], pairs: list[int], time_slots: dict, cells: dict,
                       colors: dict[str, str]) -> str:
    head_cells = "".join(f"<th>{DAY_NAMES[d]}</th>" for d in days)
    rows = []
    for p in pairs:
        start, end = time_slots.get(p, ("", ""))
        row = [f"<td class='pairno'>{p}<br><span class='time'>{start}&ndash;{end}</span></td>"]
        for d in days:
            entries = cells.get((d, p), [])
            content = "".join(lesson_html(e, colors) for e in entries)
            row.append(f"<td>{content}</td>")
        rows.append("<tr>" + "".join(row) + "</tr>")

    return f"""<table>
    <thead><tr><th>Пара</th>{head_cells}</tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>"""


def build_schedule_json(title: str, days: list[int], pairs: list[int], time_slots: dict,
                         cells: dict) -> dict:
    lessons = []
    for (d, p), entries in cells.items():
        for e in entries:
            lessons.append({"day": d, "pair": p, "week": e["week"], "name": e["name"],
                             "type": e["type"], "teacher": e["teacher"], "room": e["room"]})
    return {
        "title": title,
        "days": [{"num": d, "name": DAY_NAMES[d]} for d in days],
        "pairs": [{"num": p, "start": time_slots.get(p, ("", ""))[0], "end": time_slots.get(p, ("", ""))[1]}
                  for p in pairs],
        "lessons": lessons,
    }


PAGE_TEMPLATE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<style>
  :root {{
    --bg: #eef1f5;
    --card-bg: #ffffff;
    --ink: #2b2b2b;
    --muted: #7a828c;
    --border: #d8dde3;
    --header-bg: #f3f4f7;
    --stripe: #fbfcfe;
    --accent-ch: #8c1d2f;
    --accent-zn: #1f5ea8;
    --btn-bg: #2b2b2b;
    --btn-ink: #ffffff;
  }}
  :root[data-theme="dark"] {{
    --bg: #14161a;
    --card-bg: #1e2126;
    --ink: #e7e9ec;
    --muted: #9aa2ad;
    --border: #333841;
    --header-bg: #262a31;
    --stripe: #22262c;
    --accent-ch: #c23a52;
    --accent-zn: #3f83c9;
    --btn-bg: #e7e9ec;
    --btn-ink: #14161a;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg: #14161a;
      --card-bg: #1e2126;
      --ink: #e7e9ec;
      --muted: #9aa2ad;
      --border: #333841;
      --header-bg: #262a31;
      --stripe: #22262c;
      --accent-ch: #c23a52;
      --accent-zn: #3f83c9;
      --btn-bg: #e7e9ec;
      --btn-ink: #14161a;
    }}
  }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: var(--ink);
    background: var(--bg);
    margin: 0;
    padding: 24px;
  }}
  h1 {{ font-size: 20px; margin: 0 0 4px; text-align: center; }}
  .toolbar {{
    display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    margin: 14px 0 22px;
  }}
  .toolbar button {{
    font: inherit; cursor: pointer; border: none; border-radius: 8px;
    padding: 8px 14px; background: var(--btn-bg); color: var(--btn-ink);
    box-shadow: 0 1px 4px rgba(0,0,0,.15);
  }}
  .toolbar button:hover {{ opacity: .85; }}
  #schedule-root .section {{
    background: var(--card-bg);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,.10);
    margin-bottom: 22px;
  }}
  .caption {{
    padding: 10px 16px; font-size: 15px; font-weight: 600; color: #fff; letter-spacing: .3px;
  }}
  .section.ch .caption {{ background: var(--accent-ch); }}
  .section.zn .caption {{ background: var(--accent-zn); }}
  table {{ border-collapse: collapse; width: 100%; table-layout: fixed; }}
  th, td {{ border: 1px solid var(--border); padding: 6px 8px; vertical-align: top; text-align: left; }}
  th {{ background: var(--header-bg); font-weight: 600; text-align: center; }}
  td.pairno {{ width: 64px; text-align: center; font-weight: 700; background: var(--header-bg); color: var(--muted); }}
  .time {{ font-weight: normal; font-size: 10.5px; color: var(--muted); }}
  tbody tr:nth-child(even) td:not(.pairno) {{ background: var(--stripe); }}
  .act {{ color: var(--muted); font-weight: 400; }}
  .lesson {{ display: flex; gap: 6px; padding: 3px 2px; border-radius: 5px; transition: background .15s; }}
  .lesson + .lesson {{ border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 6px; }}
  .lesson .dot {{ width: 8px; height: 8px; margin-top: 4px; border-radius: 50%; background: var(--subj); flex: 0 0 auto; }}
  .lesson.hl {{ background: color-mix(in srgb, var(--subj) 20%, transparent); }}
  #json-view {{
    display: none; white-space: pre-wrap; word-break: break-all; max-height: 420px; overflow: auto;
    background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; font-size: 12px;
  }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .toolbar {{ display: none; }}
    .section {{ box-shadow: none; break-inside: avoid; }}
  }}
</style>
</head>
<body data-filename="{filename_base}">
  <h1>{title}</h1>
  <div class="toolbar">
    <button id="btn-theme">🌓 Тема</button>
    <button id="btn-png">🖼 Скачать PNG</button>
    <button id="btn-xlsx">📊 Скачать Excel</button>
    <button id="btn-json-toggle">📄 Показать JSON</button>
    <button id="btn-json-download">⬇ Скачать JSON</button>
  </div>

  <div id="schedule-root">
    <div class="section ch">
      <div class="caption">Числитель — верхняя неделя</div>
      {table_ch}
    </div>
    <div class="section zn">
      <div class="caption">Знаменатель — нижняя неделя</div>
      {table_zn}
    </div>
  </div>

  <pre id="json-view"></pre>

<script id="schedule-data" type="application/json">{schedule_json}</script>
<script>
(function() {{
  var DATA = JSON.parse(document.getElementById('schedule-data').textContent);
  var FILENAME = document.body.dataset.filename;

  // --- тема ---
  var stored = localStorage.getItem('bmstu-theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  document.getElementById('btn-theme').addEventListener('click', function() {{
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : (cur === 'light' ? null : (
      matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
    if (next) {{
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bmstu-theme', next);
    }} else {{
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('bmstu-theme');
    }}
  }});

  // --- подсветка одинаковых предметов ---
  document.querySelectorAll('.lesson').forEach(function(el) {{
    el.addEventListener('mouseenter', function() {{
      var subj = el.getAttribute('data-subj');
      document.querySelectorAll('.lesson[data-subj="' + CSS.escape(subj) + '"]').forEach(function(x) {{
        x.classList.add('hl');
      }});
    }});
    el.addEventListener('mouseleave', function() {{
      document.querySelectorAll('.lesson.hl').forEach(function(x) {{ x.classList.remove('hl'); }});
    }});
  }});

  function downloadBlob(blob, filename) {{
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() {{ URL.revokeObjectURL(url); }}, 2000);
  }}

  // --- PNG ---
  document.getElementById('btn-png').addEventListener('click', function() {{
    var bg = getComputedStyle(document.body).backgroundColor;
    html2canvas(document.getElementById('schedule-root'), {{backgroundColor: bg, scale: 2}}).then(function(canvas) {{
      canvas.toBlob(function(blob) {{ downloadBlob(blob, FILENAME + '.png'); }});
    }});
  }});

  // --- Excel ---
  function lessonText(l) {{
    var s = l.name + (l.type ? ' (' + l.type + ')' : '');
    if (l.teacher) s += '\\n' + l.teacher;
    if (l.room) s += '\\n' + l.room;
    return s;
  }}

  function buildAoa(weekKey, caption) {{
    var rows = [[caption], ['Пара'].concat(DATA.days.map(function(d) {{ return d.name; }}))];
    DATA.pairs.forEach(function(p) {{
      var row = [p.num + ' (' + p.start + '\\u2013' + p.end + ')'];
      DATA.days.forEach(function(d) {{
        var lessons = DATA.lessons.filter(function(l) {{
          return l.day === d.num && l.pair === p.num && (l.week === 'both' || l.week === weekKey);
        }});
        row.push(lessons.map(lessonText).join('\\n---\\n'));
      }});
      rows.push(row);
    }});
    rows.push([]);
    return rows;
  }}

  document.getElementById('btn-xlsx').addEventListener('click', function() {{
    var aoa = [[DATA.title], []]
      .concat(buildAoa('ch', 'Числитель — верхняя неделя'))
      .concat(buildAoa('zn', 'Знаменатель — нижняя неделя'));
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{{wch: 18}}].concat(DATA.days.map(function() {{ return {{wch: 30}}; }}));
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Расписание');
    XLSX.writeFile(wb, FILENAME + '.xlsx');
  }});

  // --- JSON ---
  var jsonView = document.getElementById('json-view');
  jsonView.textContent = JSON.stringify(DATA, null, 2);
  document.getElementById('btn-json-toggle').addEventListener('click', function() {{
    jsonView.style.display = jsonView.style.display === 'block' ? 'none' : 'block';
  }});
  document.getElementById('btn-json-download').addEventListener('click', function() {{
    downloadBlob(new Blob([JSON.stringify(DATA, null, 2)], {{type: 'application/json'}}), FILENAME + '.json');
  }});
}})();
</script>
</body>
</html>"""


def render_html(title: str, filename_base: str, days: list[int], pairs: list[int], time_slots: dict,
                 cells_ch: dict, cells_zn: dict, schedule_json: dict) -> str:
    colors = subject_colors({**cells_ch, **{k: cells_ch.get(k, []) + v for k, v in cells_zn.items()}})
    table_ch = render_html_table(days, pairs, time_slots, cells_ch, colors)
    table_zn = render_html_table(days, pairs, time_slots, cells_zn, colors)
    return PAGE_TEMPLATE.format(
        title=html.escape(title),
        filename_base=html.escape(filename_base, quote=True),
        table_ch=table_ch,
        table_zn=table_zn,
        schedule_json=json.dumps(schedule_json, ensure_ascii=False).replace("</script>", "<\\/script>"),
    )


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
    return name or "schedule"


def main() -> None:
    ap = argparse.ArgumentParser(description="Выгрузка расписания группы МГТУ Баумана в интерактивный HTML")
    ap.add_argument("group", nargs="?", help="Название группы или его часть, например 'АК2-51'")
    ap.add_argument("--uuid", help="UUID группы (если уже известен, пропускает поиск)")
    ap.add_argument("-o", "--output",
                     help="Имя файла без расширения (по умолчанию — по названию группы). "
                          "Сохраняется рядом со скриптом, если не указан путь с папкой.")
    args = ap.parse_args()

    if args.uuid:
        group_uuid, title = args.uuid, args.uuid
    else:
        if not args.group:
            ap.error("укажите название группы или --uuid")
        matches = find_groups(args.group)
        if not matches:
            print(f"Группа по запросу '{args.group}' не найдена.", file=sys.stderr)
            sys.exit(1)
        if len(matches) > 1:
            print("Найдено несколько групп, уточните запрос:", file=sys.stderr)
            for m in matches[:20]:
                print(f"  {m['name']}  ({m['path']})  uuid={m['uuid']}", file=sys.stderr)
            sys.exit(1)
        group_uuid, title = matches[0]["uuid"], matches[0]["name"]

    data = fetch_group_schedule(group_uuid)
    title = data.get("title", title)
    full_title = f"Расписание {title}"

    time_slots, cells = build_grid(data["schedule"])
    days, pairs = compute_axes(time_slots, cells)
    cells_ch = {k: week_entries(v, "ch") for k, v in cells.items()}
    cells_zn = {k: week_entries(v, "zn") for k, v in cells.items()}
    schedule_json = build_schedule_json(full_title, days, pairs, time_slots, cells)

    script_dir = Path(__file__).resolve().parent
    if args.output:
        out_base = Path(args.output).expanduser()
        if not out_base.is_absolute() and out_base.parent == Path("."):
            out_base = script_dir / out_base
        if out_base.suffix:
            out_base = out_base.with_suffix("")
    else:
        out_base = script_dir / sanitize_filename(full_title)

    html_path = out_base.with_suffix(".html")
    html_path.write_text(
        render_html(full_title, out_base.name, days, pairs, time_slots, cells_ch, cells_zn, schedule_json),
        encoding="utf-8",
    )

    print(f"Готово: {html_path}")


if __name__ == "__main__":
    main()
