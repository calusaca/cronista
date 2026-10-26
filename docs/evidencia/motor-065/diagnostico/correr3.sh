#!/bin/sh
D=/tmp/claude-1001/-home-calusaca-cronista/fd8c1ae1-6ac2-4b57-aeb9-3797dae63e96/scratchpad/goles
cd /home/calusaca/cronista
export PATH=$HOME/.local/bin:$PATH
tr '\t' '\037' < "$1" | xargs -P 8 -L1 -d '\n' sh -c 'IFS=$(printf "\037"); set -- $0; node --import tsx '$D'/bandas.mts "$2" "$3" "$4" "$5" "$1"' > "$2"
