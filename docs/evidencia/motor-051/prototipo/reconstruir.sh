#!/bin/bash
# Reconstruye el prototipo del brief 051 fuera del repositorio y deja listos los scripts de medición.
# Uso: bash reconstruir.sh <raiz-del-repo> <directorio-de-trabajo-vacio>
# Estructura resultante: <dir>/proto/{motor.orig.ts,motor.ts,parchar.py}  <dir>/med/*.mts
# Los scripts importan el repositorio por ruta absoluta (RAIZ) y el motor parcheado por ../proto/motor.ts.
set -euo pipefail
RAIZ=$(cd "$1" && pwd); DIR=$(mkdir -p "$2" && cd "$2" && pwd); AQUI=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$DIR/proto" "$DIR/med" "$DIR/med/out"
cp "$RAIZ/src/arena/motor.ts" "$DIR/proto/motor.orig.ts"
sed -i "s#from \"\.\./sim/#from \"$RAIZ/src/sim/#; s#from \"\.\./vista/#from \"$RAIZ/src/vista/#; s#from \"\./#from \"$RAIZ/src/arena/#" "$DIR/proto/motor.orig.ts"
cp "$AQUI/parchar.py" "$DIR/proto/"
for f in "$AQUI"/*.mts "$AQUI"/*.sh; do
  [ "$(basename "$f")" = "reconstruir.sh" ] && continue
  sed "s#/home/calusaca/cronista#$RAIZ#g; s#/tmp/claude-1001/-home-calusaca-cronista/d59ac42b-429c-4085-bec2-1e82b2ce3e26/scratchpad/med#$DIR/med#g" "$f" > "$DIR/med/$(basename "$f")"
done
chmod +x "$DIR"/med/*.sh
python3 -I "$DIR/proto/parchar.py"
echo "Base del repositorio: $(git -C "$RAIZ" rev-parse HEAD) (árbol $(git -C "$RAIZ" status --porcelain | wc -l) cambios)"
echo "Huella del parche: $(md5sum "$DIR/proto/motor.ts" | cut -c1-32)  (parchar.py: $(md5sum "$AQUI/parchar.py" | cut -c1-32))"
echo "Candidato del brief:"
echo "  cd $DIR/med && V5=1 POS=1 TRI=1 ERR_BASE=5.5 FDMAX=1.2 ALTO_BASE=0.02 ALTO_POT=0.06 ALTO_NIVEL=0.04 ALC_MIN=0.9 ALC_MAX=2.4 POSIC=3 N=100 S0=0 node --import tsx proto.mts out/candidato-1-100.json"
echo "  (V5=0 reproduce las métricas del motor del repositorio; base.mts las mide sin parche.)"
