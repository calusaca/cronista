targetScope = 'resourceGroup'
param accountName string
param insightsId string
@secure()
param connectionString string

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = { name: accountName }
resource connection 'Microsoft.CognitiveServices/accounts/connections@2025-06-01' = {
  parent: account
  name: 'cronista-appinsights'
  properties: {
    category: 'AppInsights'
    target: insightsId
    authType: 'ApiKey'
    isSharedToAll: true
    credentials: { key: connectionString }
    metadata: { ApiType: 'Azure', ResourceId: insightsId }
  }
}
