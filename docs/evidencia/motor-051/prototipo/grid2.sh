#!/bin/bash
cd /tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med
run() { name=$1; shift; env "$@" V5=1 POS=1 N=100 S0=0 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=1.0 ALC_MAX=2.6 node --import tsx proto.mts out/g2-$name.json > /dev/null 2> out/g2-$name.err & }
run G ERR_BASE=7 TRI=1
run H ERR_BASE=7 TRI=1 RECH_PROB=0.5
run I ERR_BASE=7 RECH_PROB=0.5
run J ERR_BASE=6 TRI=1 RECH_PROB=0.5 FDMAX=1.3
run K ERR_BASE=7 TRI=1 RECH_PROB=0.7
run L ERR_BASE=7 TRI=1 RECH_PROB=0.5 ALC_MIN=0.8 ALC_MAX=3.0
run M ERR_BASE=8 TRI=1 RECH_PROB=0.6 ALC_MIN=0.8 ALC_MAX=3.0
wait
