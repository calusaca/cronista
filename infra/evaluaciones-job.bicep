targetScope = 'resourceGroup'
param environmentName string = 'cronista-env'
param registryName string
param imageTag string
param blobEndpoint string
@secure()
param insightsConnectionString string

resource environment 'Microsoft.App/managedEnvironments@2025-01-01' existing = { name: environmentName }
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: '${registryName}-pull' }
resource job 'Microsoft.App/jobs@2025-01-01' = {
  name: 'cronista-evaluaciones'
  location: resourceGroup().location
  tags: { project: 'cronista' }
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 900
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      secrets: [{ name: 'insights', value: insightsConnectionString }]
    }
    template: {
      containers: [{ name: 'evaluacion', image: '${registry.properties.loginServer}/cronista-lotes:${imageTag}', resources: { cpu: json('0.5'), memory: '1Gi' }, env: [
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
        { name: 'ARENA_BLOB_ENDPOINT', value: blobEndpoint }
        { name: 'ARENA_LOTE_ID', value: 'validacion-cloud-v1' }
        { name: 'ARENA_LOTE_NARRAR', value: '0' }
        { name: 'CRONISTA_TELEMETRIA', value: '1' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'insights' }
        { name: 'OTEL_SERVICE_NAME', value: 'cronista-evaluaciones' }
      ] }]
    }
  }
}
output jobName string = job.name
