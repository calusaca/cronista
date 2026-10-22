#!/bin/bash
cd /tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med
# J como base; los valores explícitos ganan.
run() { name=$1; shift; env V5=1 POS=1 N=100 S0=0 TRI=1 ERR_BASE=6 FDMAX=1.3 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=1.0 ALC_MAX=2.6 "$@" node --import tsx proto.mts out/g3-$name.json > /dev/null 2> out/g3-$name.err & }
run N1 POSIC=2
run N2 ALC_MIN=0.9 ALC_MAX=2.4
run N3 MARGEN_PALO=0.3 MARGEN_NIVEL=1.2
run N4 ERR_BASE=5.5
run N5 ALTO_BASE=0.01 ALTO_POT=0.04 ALTO_NIVEL=0.03
run N6 POSIC=2 ALC_MIN=0.9 ALC_MAX=2.4
run N7 ERR_POT=0.15
run N8 FDMAX=1.2 POSIC=2.5
wait
