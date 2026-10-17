# Publicación de la demo en Azure

Preparado el 17 de octubre de 2026. La inferencia con GPT-6.1 Sol ya está
probada; **el hosting público todavía no está creado**. Azure CLI 2.91 y Bicep
0.48.1 están instalados localmente en `.cache/`, sin cambios del sistema.
El preflight pide `az login`; falta esa sesión administrativa. GitHub está
conectado y el repositorio existente sigue privado. La clave de inferencia no concede permisos
para crear infraestructura.

## Continuar en esta máquina

Las herramientas y la suscripción están preparadas en un perfil local ignorado
por git. Desde la raíz del proyecto:

```bash
source .cache/azure-cli-env.sh
az login
npm run deploy:azure -- --check
npm run deploy:azure
```

El inicio de sesión requiere la cuenta de Carlos; no se ha iniciado un login
interactivo mientras estaba ausente. La sesión se guarda en `.cache/azure-account/`.
Las plantillas ya compilaron tanto con Bicep directo como mediante `az bicep build`.
La imagen Docker se construyó y ejecutó en [CI verde](https://github.com/calusaca/cronista/actions/runs/39065597667): salud, home offline, assets,
descargas, usuario sin privilegios y caché escribible aprobados. El backend real
se comprobó por separado en el standalone local; el hosting Azure aún no está probado.

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

## Comprobar el resultado

```bash
npm run smoke:public -- https://<app>.azurecontainerapps.io
```

Comprueba salud, home con crónica del modelo real, assets JS, catálogo de datos,
DATASHEET, diez registros descargables y un 404. Puede generar una crónica si
no existe caché: no es una comprobación gratuita de solo conectividad. La prueba
de salud sí lo es. Además, abrir la URL desde otra red y revisar clic en frase,
idioma, proceso y pizarra 3D antes de declararla lista para jueces.

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
Docker sí pasaron en CI; el `what-if` y el hosting siguen pendientes de iniciar sesión. Los resultados de las suites y el
smoke local se registran en `BITACORA.md` y `docs/evidencia/validacion-entrega.json`.

El código puede subirse al repositorio privado con la sesión de GitHub actual.
La CI incluye la compilación de Bicep y un smoke de la imagen Docker offline.
La publicación final se realiza por separado: antes de enviar el proyecto,
comprobar desde una sesión anónima que el repositorio y el video sean
públicos, y sustituir las URLs pendientes del README. No cambiar la visibilidad
de otros repositorios ni adjuntar el registro de Azure con datos personales.
