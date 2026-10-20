targetScope = 'resourceGroup'
param location string = resourceGroup().location
param appPrincipalId string
param developerPrincipalId string
var suffix = uniqueString(resourceGroup().id)

resource storage 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: 'stcronista${substring(suffix, 0, 10)}'
  location: location
  tags: { project: 'cronista' }
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false, allowSharedKeyAccess: false }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  parent: storage
  name: 'default'
  properties: { deleteRetentionPolicy: { enabled: true, days: 7 } }
}
resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobs
  name: 'arena'
  properties: { publicAccess: 'None' }
}
resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'cronista-observabilidad'
  location: location
  tags: { project: 'cronista' }
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30, workspaceCapping: { dailyQuotaGb: 1 } }
}
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'cronista-trazas'
  location: location
  tags: { project: 'cronista' }
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: workspace.id, RetentionInDays: 30, DisableIpMasking: false }
}
resource vault 'Microsoft.KeyVault/vaults@2025-05-01' = {
  name: 'kvcronista${substring(suffix, 0, 10)}'
  location: location
  tags: { project: 'cronista' }
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    accessPolicies: []
  }
}
var blobRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
resource storageApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(container.id, appPrincipalId, blobRole)
  scope: container
  properties: { principalId: appPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: blobRole }
}
resource storageDeveloper 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(container.id, developerPrincipalId, blobRole)
  scope: container
  properties: { principalId: developerPrincipalId, principalType: 'User', roleDefinitionId: blobRole }
}
resource vaultApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appPrincipalId, 'secrets-user')
  scope: vault
  properties: { principalId: appPrincipalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') }
}
resource vaultDeveloper 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, developerPrincipalId, 'secrets-officer')
  scope: vault
  properties: { principalId: developerPrincipalId, principalType: 'User', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7') }
}

output blobEndpoint string = storage.properties.primaryEndpoints.blob
output storageName string = storage.name
output insightsId string = insights.id
output insightsName string = insights.name
output workspaceId string = workspace.properties.customerId
output vaultName string = vault.name
output vaultUri string = vault.properties.vaultUri
