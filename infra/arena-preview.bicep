targetScope = 'resourceGroup'
@description('Réplicas siempre encendidas. 1 durante la evaluación del hackathon (hasta el 10 nov 2026) para evitar un arranque en frío de 30–40 s; 0 después para no generar coste en reposo.')
@minValue(0)
@maxValue(1)
param minReplicas int = 1

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
@description('Brief 052: host de Foundry Models (https://<recurso>.services.ai.azure.com, sin /anthropic). Lo pasa deploy-azure-arena.mjs desde FOUNDRY_BASE_URL.')
param foundryEndpoint string
@description('Brief 052: catálogo publicado, derivado por deploy-azure-arena.mjs de infra/modelos-arena.json (solo entradas con publicar: true). Cada elemento: { id, nombre, prefijo, llm, deployment, formatoJson, esfuerzoRazonamiento }.')
param modelos array

// Brief 052: variables por modelo. La clave de Foundry Models es el mismo secreto
// `inferencia` (clave del recurso); nada nuevo en Key Vault.
var envModelos = flatten(map(modelos, m => m.llm == 'foundry-modelos' ? concat([
  { name: '${m.prefijo}LLM', value: 'foundry-modelos' }
  { name: '${m.prefijo}FOUNDRY_MODELOS_ENDPOINT', value: foundryEndpoint }
  { name: '${m.prefijo}FOUNDRY_MODELOS_API_KEY', secretRef: 'inferencia' }
  { name: '${m.prefijo}FOUNDRY_MODELOS_DEPLOYMENT', value: m.deployment }
  { name: '${m.prefijo}FOUNDRY_MODELOS_FORMATO_JSON', value: m.formatoJson }
], empty(m.esfuerzoRazonamiento) ? [] : [
  // v1.2 (coordinador): esfuerzo de razonamiento solo para los modelos que lo declaran.
  { name: '${m.prefijo}FOUNDRY_MODELOS_ESFUERZO_RAZONAMIENTO', value: m.esfuerzoRazonamiento }
]) : [
  { name: '${m.prefijo}LLM', value: 'azure-openai' }
  { name: '${m.prefijo}AZURE_OPENAI_DEPLOYMENT', value: m.deployment }
]))

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
      containers: [{ name: 'cronista', image: '${registry.properties.loginServer}/cronista:${imageTag}', resources: { cpu: json('0.5'), memory: '1Gi' }, env: concat([
        // La portada histórica permanece offline; esta publicación sirve la arena.
        { name: 'CRONISTA_LLM', value: 'stub' }
        { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
        { name: 'AZURE_OPENAI_ENDPOINT', value: openAiEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', secretRef: 'inferencia' }
        { name: 'AZURE_OPENAI_REASONING_EFFORT', value: 'low' }
        { name: 'ARENA_WEB_LLM', value: '1' }
        { name: 'ARENA_MODELOS', value: string(map(modelos, m => { id: m.id, nombre: m.nombre, prefijo: m.prefijo })) }
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
      ], envModelos), probes: [
        { type: 'Startup', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 2, failureThreshold: 90 }
        { type: 'Readiness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 10, failureThreshold: 3 }
        { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 20, failureThreshold: 3 }
      ] }]
      scale: { minReplicas: minReplicas, maxReplicas: 1 }
    }
  }
}
output url string = 'https://${preview.properties.configuration.ingress.fqdn}'
