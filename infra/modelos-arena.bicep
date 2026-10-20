targetScope = 'resourceGroup'

@description('Recurso Foundry existente que conserva endpoint y credenciales en el servidor.')
param accountName string
param capacity int = 30

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = { name: accountName }

resource rapido 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: account
  name: 'cronista-rapido'
  sku: { name: 'GlobalStandard', capacity: capacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5.4-mini', version: '2026-03-17' }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

resource equilibrado 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: account
  name: 'cronista-equilibrado'
  sku: { name: 'GlobalStandard', capacity: capacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5.6-luna', version: '2026-07-09' }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

output deployments array = [rapido.name, equilibrado.name]
