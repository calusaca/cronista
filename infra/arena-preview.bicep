targetScope = 'resourceGroup'
param registryName string
param imageTag string
param openAiEndpoint string
param projectEndpoint string
param blobEndpoint string
param vaultUri string
param speechEndpoint string
param agentVersion string
@secure()
param insightsConnectionString string

resource environment 'Microsoft.App/managedEnvironments@2025-01-01' existing = { name: 'cronista-env' }
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = { name: registryName }
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = { name: '${registryName}-pull' }
resource preview 'Microsoft.App/containerApps@2025-01-01' = {
  name: 'cronista-arena'
  location: resourceGroup().location
  tags: { project: 'cronista', purpose: 'arena-preview' }
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }
  properties: {
    managedEnvironmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 3000, allowInsecure: false, transport: 'auto' }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
      secrets: [
        { name: 'inferencia', keyVaultUrl: '${vaultUri}secrets/cronista-inferencia', identity: identity.id }
        { name: 'insights', value: insightsConnectionString }
      ]
    }
    template: {
      containers: [{ name: 'cronista', image: '${registry.properties.loginServer}/cronista:${imageTag}', resources: { cpu: json('0.5'), memory: '1Gi' }, env: [
        // La portada histórica permanece offline; esta publicación sirve la arena.
        { name: 'CRONISTA_LLM', value: 'stub' }
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
        { name: 'AZURE_OPENAI_ENDPOINT', value: openAiEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', secretRef: 'inferencia' }
        { name: 'AZURE_OPENAI_REASONING_EFFORT', value: 'low' }
        { name: 'ARENA_WEB_LLM', value: '1' }
        { name: 'ARENA_MODELOS', value: '[{"id":"equilibrado","nombre":"GPT-5.6 Luna","prefijo":"ARENA_EQUILIBRADO_"},{"id":"rapido","nombre":"GPT-5.4 mini","prefijo":"ARENA_RAPIDO_"}]' }
        { name: 'ARENA_EQUILIBRADO_LLM', value: 'azure-openai' }
        { name: 'ARENA_EQUILIBRADO_AZURE_OPENAI_DEPLOYMENT', value: 'cronista-equilibrado' }
        { name: 'ARENA_RAPIDO_LLM', value: 'azure-openai' }
        { name: 'ARENA_RAPIDO_AZURE_OPENAI_DEPLOYMENT', value: 'cronista-rapido' }
        { name: 'ARENA_NARRADOR_LLM', value: '1' }
        { name: 'ARENA_NARRADOR_MODELO', value: 'rapido' }
        { name: 'ARENA_BLOB_ENDPOINT', value: blobEndpoint }
        { name: 'AZURE_AI_PROJECT_ENDPOINT', value: projectEndpoint }
        { name: 'ARENA_AGENTE_NOMBRE', value: 'cronista-analista' }
        { name: 'ARENA_AGENTE_VERSION', value: agentVersion }
        { name: 'ARENA_ANALISTA_LLM', value: '1' }
        { name: 'ARENA_VOZ', value: '1' }
        { name: 'ARENA_VOZ_ES', value: 'es-MX-JorgeNeural' }
        { name: 'ARENA_VOZ_EN', value: 'en-US-JennyNeural' }
        { name: 'AZURE_SPEECH_ENDPOINT', value: speechEndpoint }
        { name: 'AZURE_SPEECH_KEY', secretRef: 'inferencia' }
        { name: 'CRONISTA_TELEMETRIA', value: '1' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'insights' }
        { name: 'OTEL_SERVICE_NAME', value: 'cronista-arena' }
      ], probes: [
        { type: 'Startup', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 2, failureThreshold: 90 }
        { type: 'Readiness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
        { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 20, failureThreshold: 3 }
      ] }]
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}
output url string = 'https://${preview.properties.configuration.ingress.fqdn}'
