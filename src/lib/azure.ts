import { AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";

/** CLI local; identidad de la aplicación cuando Azure publica su endpoint MSI. */
export function credencialAzure() {
  return process.env.IDENTITY_ENDPOINT
    ? new ManagedIdentityCredential(process.env.AZURE_CLIENT_ID ? { clientId: process.env.AZURE_CLIENT_ID } : {})
    : new AzureCliCredential();
}

export function endpointAzure(valor: string | undefined, sufijo: string): string {
  if (!valor) throw new Error("Falta endpoint Azure");
  const url = new URL(valor);
  if (url.protocol !== "https:" || !url.hostname.endsWith(sufijo) || url.username || url.password || url.search || url.hash) throw new Error("Endpoint Azure inválido");
  return url.href.replace(/\/$/, "");
}
