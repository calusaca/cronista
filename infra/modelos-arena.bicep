targetScope = 'resourceGroup'

// Brief 052 v1.1 §6: una sola lista de deployments de la arena. `infra/modelos-arena.json`
// es la fuente común: esta plantilla crea/reproduce cada deployment ({ nombre, modelo,
// version, formato, capacidad }) y `scripts/deploy-azure-arena.mjs` deriva de las mismas
// entradas (`publicar: true`) el catálogo ARENA_MODELOS y los nombres públicos, para que
// nombre público, deployment y modelo real no puedan divergir. La operación real se hizo con
// `az cognitiveservices account deployment create`; esta plantilla queda como reproducción.

@description('Recurso Foundry existente que conserva endpoint y credenciales en el servidor.')
param accountName string

@description('Deployments GlobalStandard de la arena. Por defecto, los de infra/modelos-arena.json (los dos de 2026-10-19 más los creados el 22 oct). Capacidad tal como la aceptó el servicio.')
param modelos array = loadJsonContent('modelos-arena.json')

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = { name: accountName }

@batchSize(1)
resource deployments 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [for m in modelos: {
  parent: account
  name: m.nombre
  sku: { name: 'GlobalStandard', capacity: m.capacidad }
  properties: {
    model: { format: m.formato, name: m.modelo, version: m.version }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}]

output deployments array = [for (m, i) in modelos: deployments[i].name]
