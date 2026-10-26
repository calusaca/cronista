#!/bin/sh
# uso: correr-medir.sh jobs.txt salida.jsonl (etiqueta, reglas, duracion, desde, n, overrides separados por tab)
cd /home/calusaca/cronista
export PATH=/home/calusaca/.local/bin:$PATH
tr '\t' '\037' < "$1" | xargs -P 8 -L1 -d '\n' sh -c 'IFS=$(printf "\037"); set -- $0; node --import tsx /home/calusaca/cronista/docs/evidencia/motor-065/diagnostico/medir.mts "$2" "$3" "$4" "$5" "$6" "$1"' > "$2"
