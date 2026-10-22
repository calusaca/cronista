#!/bin/bash
cd /tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med
run() { name=$1; shift; env V5=1 POS=1 N=100 S0=0 TRI=1 ERR_BASE=6 FDMAX=1.3 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=1.0 ALC_MAX=2.6 "$@" node --import tsx proto.mts out/g4-$name.json > /dev/null 2> out/g4-$name.err & }
run P1 ERR_BASE=5.5 FDMAX=1.2 ALC_MIN=0.9 ALC_MAX=2.3 POSIC=2.5
run P2 ERR_BASE=5 FDMAX=1.3 ALC_MIN=0.9 ALC_MAX=2.4 POSIC=2.5
run P3 ERR_BASE=5.5 FDMAX=1.2 ALC_MIN=0.9 ALC_MAX=2.4 POSIC=3
run P4 ERR_BASE=6 FDMAX=1.2 ALC_MIN=0.8 ALC_MAX=2.3 POSIC=2
run P5 ERR_BASE=5.5 FDMAX=1.3 POSIC=2 ERR_POT=0.15
run P6 ERR_BASE=5 FDMAX=1.2 POSIC=2.5 MARGEN_PALO=0.6
wait
