#!/usr/bin/env python3
"""Downloads Incarnon evolution tables from the wiki ("<family> Incarnon Genesis" pages and the native Incarnon weapons)
and writes { weapon English name: {page, tiers:[{tier, perks:[{name, lines, notes}]}]} } with each variant's X/Y values
filled in. Usage: fetch_incarnon.py <out.json>. If too little parses, the previous file is kept."""
import json, os, re, sys, time, urllib.parse, urllib.request
UA = {"User-Agent": "wf-build-calc (github.com/oxford1436/wf-build-calc)"}

def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            time.sleep(2 + i * 3)
    return None

def raw(title):
    return get("https://wiki.warframe.com/w/" + urllib.parse.quote(title.replace(" ", "_")) + "?action=raw")

def members(cat):
    t = get("https://wiki.warframe.com/api.php?action=query&list=categorymembers&cmlimit=500&format=json&cmtitle=Category:" + urllib.parse.quote(cat))
    return [m["title"] for m in json.loads(t)["query"]["categorymembers"]] if t else []

def clean(s):
    s = re.sub(r"\{\{(?:D|M|A|Weapon|Resource|Proc|Tooltip|S|PT)\|([^}|]+)(?:\|[^}]*)?\}\}", r"\1", s)
    s = re.sub(r"\[\[File:[^\]]*\]\]", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"'''?", "", s)
    s = re.sub(r"<br\s*/?>", "; ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\{\{[^}]*\}\}", "", s)
    return re.sub(r"\s+", " ", s).strip()

def cell_text(c):   # drop "style=... |" attribute prefix
    m = re.match(r"^\s*(?:[a-z]+=\"[^\"]*\"\s*|[a-z]+=[^|\s]+\s*)+\|(?!\|)", c)
    return c[m.end():] if m else c

def colspan(c):
    m = re.search(r"colspan=\"?(\d+)", c.split("|")[0] if "|" in c else "")
    return int(m.group(1)) if m else 1

def parse(text, single=None):
    i = text.find("===Evolutions===")
    if i < 0: i = text.find("=== Evolutions ===")
    if i < 0: return None
    j = text.find("\n|}", i)
    tbl = text[i:j]
    head = tbl.split("\n|-", 2)
    head_ = re.split(r"\n!\s*(?:rowspan=\"?\d+\"?\s*\|)?\s*EVO", tbl)[0]      # header row only ("! EVO1" or "!EVO1")
    hdr = list(dict.fromkeys(clean(v) for v in re.findall(r"\{\{Weapon\|([^}|]+)", head_)))
    variants = hdr or ([single] if single else [])
    nval = len(hdr)          # value columns (one per variant on Genesis pages); native Incarnon pages have none
    rows = re.split(r"\n\|-[^\n]*\n", tbl)
    out = {v: [] for v in variants}
    cur = None
    for row in rows:
        if "Evolution Challenge" in row: continue
        m = re.search(r"^!\s*(?:rowspan=\"?\d+\"?\s*\|)?\s*EVO\s*(\d)", row, re.M)
        if m:
            cur = int(m.group(1))
            for v in variants: out[v].append({"tier": cur, "perks": []})
        if cur is None: continue
        body = row
        if row.lstrip().startswith("!"):
            parts = row.split("\n", 1); body = parts[1] if len(parts) > 1 else ""
        cells = re.split(r"\n\|\s?", "\n" + body)[1:]
        if not cells or "File:" not in cells[0]: continue
        name = clean(cell_text(cells[0]).split("[[File:")[0])
        eff = cells[1] if len(cells) > 1 else ""
        rest = cells[2:]
        # variant value cells: one cell spanning all variants, or one per variant; last cell = notes
        vals, k = [], 0
        while k < len(rest) and len(vals) < nval:
            span = colspan(rest[k]); vals += [cell_text(rest[k])] * span; k += 1
        notes = rest[k] if k < len(rest) else ""
        bl = lambda c: [clean(x) for x in re.findall(r"^\*+([^\n]+)", c, re.M) if clean(x)]
        lines, nts = bl(eff), bl(notes)
        for vi, v in enumerate(variants):
            subs = dict(re.findall(r"\b([XYZW])\s*=\s*([-+]?[\d.]+%?)", vals[vi] if vi < len(vals) else ""))
            sub = lambda s: re.sub(r"\b([XYZW])\b", lambda mm: subs.get(mm.group(1), mm.group(1)), s)
            out[v][-1]["perks"].append({"name": name or "Incarnon Form", "lines": [sub(x).replace("%%", "%") for x in lines], "notes": nts})
    return {v: t for v, t in out.items() if t}

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "data/raw/incarnon_evos.json"
    res = {}
    for page in members("Incarnon") + members("Incarnon_Weapons"):
        if page == "Incarnon" or page in res: continue
        t = raw(page)
        if not t: continue
        native = not page.endswith("Incarnon Genesis")
        p = parse(t, page if native else None)
        if p:
            for v, tiers in p.items(): res[v] = {"page": page, "tiers": tiers}
        time.sleep(0.3)
    prev = json.load(open(out, encoding="utf-8")) if os.path.exists(out) else {}
    if len(res) < max(20, len(prev) * 0.7): print("only", len(res), "parsed — keeping the previous file"); return
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("incarnon weapons:", len(res))

if __name__ == "__main__": main()
