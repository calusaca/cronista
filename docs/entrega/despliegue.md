# Publicación de la demo en Azure

Actualizado el 19 de octubre de 2026. La inferencia con GPT-6.1 Sol está
probada. **[La demo pública está desplegada](https://cronista.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io)**
en Azure Container Apps, East US 2. Inicio de sesión, preflight, construcción en
ACR, despliegue y pruebas HTTP/navegador del servicio público aprobados.
Azure CLI 2.91 y Bicep 0.48.1 están instalados localmente en `.cache/`, sin cambios
del sistema. GitHub está conectado y el repositorio existente sigue privado.

El 19 de octubre se publicó, con autorización específica, una aplicación
adicional para la [arena en vivo](https://cronista-arena.mangoocean-cf77f6f8.eastus2.azurecontainerapps.io/arena).
La aplicación `cronista` conserva su revisión `cronista--0000005` y su imagen
`cronista:demo-20261018042118`. La nueva `cronista-arena` incorpora Blob, Key Vault,
analista Foundry, Speech y trazas con límites de consumo. Su plantilla es
`infra/arena-preview.bicep`; el script es `scripts/deploy-azure-arena.mjs`.
Ver [operación](../azure-integraciones.md) y
[evidencia del despliegue](../evidencia/azure-arena-publicacion.json).

La revisión `cronista-arena--0000002`, publicada el 19 de octubre, incorpora
«Generar primero», enlace al partido guardado y narración completa preparada
como una pista continua. Compilación ACR `cha` correcta y HTTP/navegador público
aprobados, incluidos seis audios reales y los 33 eventos del duelo archivado.
[Evidencia y límites](../evidencia/partido-preparado/publicacion.json).

La revisión actual es `cronista-arena--0000009` (20 de octubre, imagen
`arena-20261020065222`, brief 044: reglas `reinicios-v3`, ventanas de hasta tres
sustituciones y temperatura validada por clima). Smoke HTTP real con dos
controladores Azure OpenAI y navegador público aprobados; la 0000008 queda sin
tráfico para volver si hiciera falta. [Evidencia](../evidencia/correcciones-044/README.md).

La revisión `cronista-arena--0000003` añadió la emisión casi en vivo con
20 segundos de reserva, voz breve preparada por delante y enlace al mismo
encuentro para otros espectadores. Imagen `arena-20261019183630`, compilación ACR
`chb` correcta; publicación y navegador público verificados el 19 de octubre,
incluidos seis tramos reales de voz y su reloj de reproducción. La demo original
conserva `cronista--0000005`. [Evidencia](../evidencia/emision-buffer/publicacion.json).

## Continuar en esta máquina

Las herramientas y la suscripción están preparadas en un perfil local ignorado
por git. Desde la raíz del proyecto:

```bash
source .cache/azure-cli-env.sh
npm run deploy:azure -- --check
npm run deploy:azure
```

Carlos completó el inicio de sesión. La sesión se guarda en `.cache/azure-account/`;
solo hace falta repetir `az login` si expira o se usa otra máquina.
Las plantillas ya compilaron tanto con Bicep directo como mediante `az bicep build`.
La imagen Docker se construyó y ejecutó en [CI verde](https://github.com/calusaca/cronista/actions/runs/39069277109): salud, home offline, assets,
descargas, usuario sin privilegios y caché escribible aprobados. El backend real
se comprobó también en el servicio público: 11 frases bilingües, un intento,
cero omisiones. La primera home tardó 31,1 s; el recorrido de navegador posterior
usó caché. Evidencia: [despliegue](../evidencia/deploy-azure.json),
[HTTP](../evidencia/smoke-web-public.json) y [navegador](../evidencia/smoke-browser-public.json).

## Publicar desde otro checkout

Requisitos: Node 24, [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
y permisos sobre una suscripción para crear recursos y asignar `AcrPull` a una
identidad. No hace falta Docker local ni subir el código a GitHub para este paso:
[ACR Tasks compila la imagen en Azure](https://learn.microsoft.com/azure/container-registry/container-registry-tutorial-quick-task).

El `.env` local debe contener la configuración que ya pasó el smoke:
`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` y
`AZURE_OPENAI_REASONING_EFFORT=low`. Nunca copiar su contenido al README o al chat.

```bash
az login
az account list --query '[].{name:name,id:id}' --output table

# Local: no crea recursos y no necesita Azure CLI.
npm run deploy:azure -- --prepare

# Sustituir <subscription-id> por el ID de la suscripción que tiene el modelo.
# --check consulta la cuenta y comprueba la configuración, sin crear recursos.
npm run deploy:azure -- --check --subscription <subscription-id>

# Crea recursos facturables en rg-cronista-demo, separado del recurso de inferencia.
npm run deploy:azure -- --subscription <subscription-id>
```

Opciones: `--resource-group rg-cronista-demo`, `--location eastus2`, `--app cronista`.
El grupo existente debe tener `tags.project=cronista`; el script evita reutilizar
un grupo ajeno. La cuenta debe poder registrar `Microsoft.App`,
`Microsoft.ContainerRegistry` y `Microsoft.ManagedIdentity`.

El comando prepara un contexto temporal de archivos permitidos, lo revisa contra
las claves conocidas y lo envía a ACR. Excluye `.env`, `.git`, `.primos`, cachés y
la evidencia de evaluación. Compila el `Dockerfile`, que ejecuta typecheck y build
sin credenciales. Next genera un servidor standalone, ejecutado con usuario `node`;
los archivos de `/datos` y sus descargas están incluidos.

Las plantillas `infra/registry.bicep` y `infra/app.bicep` crean:

- Registry privado Basic, sin usuario administrador; la aplicación descarga
  mediante [identidad administrada con AcrPull](https://learn.microsoft.com/azure/container-apps/managed-identity-image-pull).
- Entorno de Container Apps Consumption, sin workspace de Log Analytics.
- Aplicación HTTPS, 0,5 CPU / 1 GiB, entre cero y una réplica, revisión única.
- Clave del modelo como secreto de Container Apps, referenciada solo desde el servidor.
  Se pasa como parámetro Bicep `secureString` en un archivo temporal con permisos
  `0600`, eliminado al terminar; no aparece como argumento del proceso ni en la imagen.
- [Probes HTTP](https://learn.microsoft.com/azure/container-apps/health-probes)
  a `/api/health`, que no generan partidos ni consumen tokens.

El manifiesto local queda en `.cache/deploy/source-manifest.json`. Tras publicar,
la URL y etiqueta de imagen quedan en `.cache/deploy/deployment.json`, sin claves.
Cada ejecución genera una imagen nueva; no elimina recursos ni desactiva el modelo.

La configuración sin almacenamiento de logs usa `appLogsConfiguration: null`,
como el [módulo oficial de Azure](https://github.com/Azure/bicep-registry-modules/blob/main/avm/res/app/managed-environment/main.bicep).
La cadena literal `'none'` fue rechazada por el preflight del servicio pese a
compilar localmente; la plantilla corregida pasó el preflight y CI.

## Comprobar el resultado

```bash
npm run smoke:public -- https://<app>.azurecontainerapps.io
```

Comprueba salud, home con crónica del modelo real, assets JS, catálogo de datos,
DATASHEET, diez registros descargables y un 404. Puede generar una crónica y
consumir tokens si no existe caché. `/api/health` comprueba conectividad sin
invocar al modelo. El recorrido público de Chromium comprobó clic en frase,
proceso, ES/EN, Fan/Analyst, pizarra 2D/3D, Data y móvil de 360 px sin desborde;
cero errores JS o HTTP 5xx. Las capturas de evidencia, 3D y móvil se revisaron.
Estas pruebas salieron desde la máquina de desarrollo hacia el HTTPS público;
la revisión humana independiente desde otra red sigue pendiente.

La caché está en disco efímero de la réplica. Sobrevive a visitas en esa réplica,
pero puede perderse al escalar a cero o cambiar de revisión; eso produce nuevas
llamadas al modelo. Una réplica máxima limita el cómputo, **no es un tope de gasto
de inferencia**. ACR y el uso de Container Apps/modelo pueden generar cargos;
no se ha calculado una factura Azure ni probado la elegibilidad de créditos para
estos recursos. Si se necesita caché persistente o varias réplicas, revisar
almacenamiento/coordinación antes de ampliar el despliegue.

## Estado de las validaciones

Las dos plantillas compilan con Bicep CLI 0.48.1. El contexto permitido y la
retirada del `.env` que Next copia al standalone tienen pruebas locales. Esto no
equivale a un `what-if` ni a un despliegue real en Azure. La compilación y ejecución
Docker pasaron en CI y la imagen también se construyó en ACR. El `what-if` no se
ejecutó; el despliegue real terminó en `Succeeded` y la aplicación en `Running`.
El primer preflight detectó el valor inválido de logs; corregido sin reconstruir
la imagen. El entorno original tardó en aprovisionarse, sin error de cuota
reportado. Se canceló un intento alternativo en East US al comprobar la salud
del original. Su entorno temporal quedó eliminado: operación de borrado terminada,
consulta del recurso HTTP 404 y listado con solo `cronista-env`. Los resultados de las suites y el
smoke local se registran en `BITACORA.md` y `docs/evidencia/validacion-entrega.json`.

El código puede subirse al repositorio privado con la sesión de GitHub actual.
La CI incluye la compilación de Bicep y un smoke de la imagen Docker offline.
La publicación final se realiza por separado: antes de enviar el proyecto,
comprobar desde una sesión anónima que el repositorio y el video sean
públicos, y sustituir las URLs pendientes del README. No cambiar la visibilidad
de otros repositorios ni adjuntar el registro de Azure con datos personales.
