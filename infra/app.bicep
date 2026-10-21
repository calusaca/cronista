targetScope = 'resourceGroup'

@description('Réplicas siempre encendidas. 1 durante la evaluación del hackathon (hasta el 10 nov 2026) para evitar un arranque en frío de 30–40 s; 0 después para no generar coste en reposo.')
@minValue(0)
@maxValue(1)
param minReplicas int = 1

param location string = resourceGroup().location
param registryName string
param appName string = 'cronista'
param imageTag string
param openAiEndpoint string
param openAiDeployment string = 'gpt-6.1-sol'
param apiVersion string = '2024-10-21'
param reasoningEffort string = 'low'
@secure()
param openAiApiKey string

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: '${registryName}-pull' }

resource environment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    // La CLI traduce --logs-destination none a null en ARM; la cadena 'none' se rechaza.
    appLogsConfiguration: null
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  }
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${pullIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 3000, allowInsecure: false, transport: 'auto' }
      registries: [{ server: registry.properties.loginServer, identity: pullIdentity.id }]
      secrets: [{ name: 'azure-openai-key', value: openAiApiKey }]
    }
    template: {
      containers: [{
        name: 'cronista'
        image: '${registry.properties.loginServer}/cronista:${imageTag}'
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'CRONISTA_LLM', value: 'azure-openai' }
          { name: 'AZURE_OPENAI_ENDPOINT', value: openAiEndpoint }
          { name: 'AZURE_OPENAI_DEPLOYMENT', value: openAiDeployment }
          { name: 'AZURE_OPENAI_API_VERSION', value: apiVersion }
          { name: 'AZURE_OPENAI_REASONING_EFFORT', value: reasoningEffort }
          { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-key' }
        ]
        probes: [
          {
            type: 'Startup'
            httpGet: { path: '/api/health', port: 3000 }
            periodSeconds: 2
            failureThreshold: 60
          }
          {
            type: 'Readiness'
            httpGet: { path: '/api/health', port: 3000 }
            periodSeconds: 10
            failureThreshold: 3
          }
          {
            type: 'Liveness'
            httpGet: { path: '/api/health', port: 3000 }
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          }
        ]
      }]
      scale: { minReplicas: minReplicas, maxReplicas: 1 }
    }
  }
}

output url string = 'https://${app.properties.configuration.ingress.fqdn}'
