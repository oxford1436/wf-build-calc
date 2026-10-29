"""Minimal reader for the wiki's Module:Weapons/data/* Lua tables (a single `return { ... }`).
Only supports what those modules use: tables, ["key"] / ident keys, strings, numbers, booleans, nil, comments."""
import re

_TOK = re.compile(r'''\s+|--\[\[.*?\]\]|--[^\n]*|(?P<str>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(?P<num>-?\d+\.?\d*(?:[eE][-+]?\d+)?)|(?P<id>[A-Za-z_][A-Za-z0-9_.]*)|(?P<p>[{}\[\]=,;])''', re.S)


def _tokens(src):
    pos = 0
    while pos < len(src):
        m = _TOK.match(src, pos)
        if not m:
            raise ValueError("bad lua at %d: %r" % (pos, src[pos:pos + 40]))
        pos = m.end()
        if m.lastgroup:
            yield m.lastgroup, m.group(m.lastgroup)


def _unq(s):
    return bytes(s[1:-1], "utf-8").decode("unicode_escape").encode("latin-1").decode("utf-8")


def parse(src):
    toks = list(_tokens(src))
    i = 0
    if toks and toks[0] == ("id", "return"):
        i = 1

    def value(i):
        k, v = toks[i]
        if k == "str":
            return _unq(v), i + 1
        if k == "num":
            return float(v) if any(c in v for c in ".eE") else int(v), i + 1
        if k == "id":
            return {"true": True, "false": False, "nil": None, "math.huge": 1e9}.get(v, v), i + 1
        if v == "{":
            return table(i + 1)
        raise ValueError("unexpected %r" % (v,))

    def table(i):
        arr, obj = [], {}
        while True:
            k, v = toks[i]
            if v == "}":
                return (obj if obj else arr) if not (obj and arr) else dict(obj, _list=arr), i + 1
            if v in (",", ";"):
                i += 1
                continue
            if v == "[":
                key, i = value(i + 1)
                i += 2  # ] =
                val, i = value(i)
                obj[key] = val
            elif k == "id" and toks[i + 1][1] == "=":
                val, i = value(i + 2)
                obj[v] = val
            else:
                val, i = value(i)
                arr.append(val)

    out, _ = value(i)
    return out
