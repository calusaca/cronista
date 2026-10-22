#!/bin/bash
cd /tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med
P3="V5=1 POS=1 TRI=1 ERR_BASE=5.5 FDMAX=1.2 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=0.9 ALC_MAX=2.4 POSIC=3"
env $P3 N=30 S0=0 node --import tsx proto.mts out/v11-p3-1-30.json > /dev/null 2> out/r1.err &
env $P3 N=100 S0=0 node --import tsx proto.mts out/v11-p3-1-100.json > /dev/null 2> out/r2.err &
env $P3 N=100 S0=100 node --import tsx proto.mts out/v11-p3-101-200.json > /dev/null 2> out/r3.err &
env $P3 N=30 S0=0 node --import tsx bandas046.mts out/v11-p3-bandas046-1-30.json > out/v11-b30.txt 2> out/r4.err &
env $P3 N=100 S0=0 node --import tsx bandas046.mts out/v11-p3-bandas046-1-100.json > out/v11-b100.txt 2> out/r5.err &
env $P3 N=100 S0=100 node --import tsx bandas046.mts out/v11-p3-bandas046-101-200.json > out/v11-b200.txt 2> out/r6.err &
env $P3 N=100 S0=0 NIV_POR=40 node --import tsx proto.mts out/v11-niveles-v5-por40.json > /dev/null 2> out/r7.err &
env $P3 N=100 S0=0 NIV_POR=90 node --import tsx proto.mts out/v11-niveles-v5-por90.json > /dev/null 2> out/r8.err &
wait
env $P3 N=100 S0=0 NIV_CAMPO=40 node --import tsx proto.mts out/v11-niveles-v5-campo40.json > /dev/null 2> out/r9.err &
env $P3 N=100 S0=0 NIV_CAMPO=90 node --import tsx proto.mts out/v11-niveles-v5-campo90.json > /dev/null 2> out/r10.err &
env $P3 N=30 S0=0 NIV_POR=40 node --import tsx proto.mts out/v11-niveles30-v5-por40.json > /dev/null 2> out/r11.err &
env $P3 N=30 S0=0 NIV_POR=90 node --import tsx proto.mts out/v11-niveles30-v5-por90.json > /dev/null 2> out/r12.err &
REGLAS=reinicios-v4 N=100 S0=0 node --import tsx base.mts out/v11-base-v4-1-100.json > /dev/null 2> out/r13.err &
REGLAS=reinicios-v4 N=100 S0=100 node --import tsx base.mts out/v11-base-v4-101-200.json > /dev/null 2> out/r14.err &
REGLAS=reinicios-v4 N=30 S0=0 node --import tsx base.mts out/v11-base-v4-1-30.json > /dev/null 2> out/r15.err &
REGLAS=reinicios-v3 N=100 S0=0 node --import tsx base.mts out/v11-base-v3-1-100.json > /dev/null 2> out/r16.err &
wait
