#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Uso: $(basename "$0") <arquivo.dbml>" >&2
    exit 1
}

[[ $# -eq 1 ]] || usage

file="$1"

[[ -f "$file" ]] || { echo "Erro: arquivo nao encontrado: $file" >&2; exit 1; }

cp -- "$file" "$file.bak"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

awk '
    /^[[:space:]]*Checks[[:space:]]*\{/ {
        if (blank) blank = 0          # descarta a linha em branco anterior
        inblock = 1
        next
    }
    inblock {
        if ($0 ~ /^[[:space:]]*\}[[:space:]]*$/) inblock = 0
        next
    }
    /^[[:space:]]*$/ {                # segura a linha em branco
        if (!inblock) blank = 1
        next
    }
    {
        if (blank) { print ""; blank = 0 }
        print
    }
    END { if (blank) print "" }
' "$file.bak" > "$tmp"

perl -pe '
    s/,\s*check:\s*`[^`]*`//g;        # "not null, check: `...`"  -> "not null"
    s/check:\s*`[^`]*`\s*,\s*//g;     # "check: `...`, not null"  -> "not null"
    s/\s*check:\s*`[^`]*`//g;         # "check: `...`" sozinho    -> ""
    if (/^\s*Ref:/) {
        s/\?<\?/</g;                  # "?<?"  -> "<"
        s/<\?/</g;                    # "<?"   -> "<"
    }
' "$tmp" > "$file"

echo "Pronto: checks removidos e Refs corrigidos em '$file' (backup em '$file.bak')."
