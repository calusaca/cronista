#!/bin/bash
cd /tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med
P3="POS=1 TRI=1 ERR_BASE=5.5 FDMAX=1.2 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=0.9 ALC_MAX=2.4 POSIC=3"
run() { name=$1; shift; env $P3 N=${N:-100} S0=${S0:-0} "$@" node --import tsx proto.mts out/niv-$name.json > /dev/null 2> out/niv-$name.err & }
run v5-por40 V5=1 NIV_POR=40
run v5-por90 V5=1 NIV_POR=90
run v5-campo40 V5=1 NIV_CAMPO=40
run v5-campo90 V5=1 NIV_CAMPO=90
run v4-por40 V5=0 NIV_POR=40
run v4-por90 V5=0 NIV_POR=90
run v4-campo40 V5=0 NIV_CAMPO=40
run v4-campo90 V5=0 NIV_CAMPO=90
wait
