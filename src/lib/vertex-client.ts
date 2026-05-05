import fs from "fs";
import path from "path";
import { VertexAI } from "@google-cloud/vertexai";

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

let vertexInstance: VertexAI | null = null;

/**
 * Load credentials from file path in GOOGLE_APPLICATION_CREDENTIALS env var
 */
function loadCredentialsFromFile(): ServiceAccountKey | null {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    console.error("GOOGLE_APPLICATION_CREDENTIALS not set");
    return null;
  }

  const absolutePath = path.isAbsolute(credPath) ? credPath : path.join(process.cwd(), credPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Credentials file not found at: ${absolutePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    const credentials = JSON.parse(content) as ServiceAccountKey;
    console.log(`✓ Loaded credentials from: ${absolutePath}`);
    console.log(`  Project: ${credentials.project_id}`);
    console.log(`  Service Account: ${credentials.client_email}`);
    return credentials;
  } catch (err) {
    console.error(`Failed to load credentials: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Get or create Vertex AI client with explicit credentials
 */
export function getVertexAIClient(): VertexAI | null {
  if (vertexInstance) {
    return vertexInstance;
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (!project) {
    console.error("GOOGLE_CLOUD_PROJECT not set");
    return null;
  }

  const credentials = loadCredentialsFromFile();
  if (!credentials) {
    console.error("Failed to load credentials");
    return null;
  }

  try {
    vertexInstance = new VertexAI({
      project,
      location,
      googleAuthOptions: {
        credentials: {
          type: credentials.type,
          project_id: credentials.project_id,
          private_key: credentials.private_key,
          client_email: credentials.client_email,
          client_id: credentials.client_id,
          auth_uri: credentials.auth_uri,
          token_uri: credentials.token_uri,
          auth_provider_x509_cert_url: credentials.auth_provider_x509_cert_url,
          client_x509_cert_url: credentials.client_x509_cert_url,
        } as any,
      },
    });
    console.log(`✓ Vertex AI client initialized (project: ${project}, location: ${location})`);
    return vertexInstance;
  } catch (err) {
    console.error(`Failed to initialize Vertex AI client: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Verify Imagen model is available
 */
export async function verifyImagenAccess(): Promise<boolean> {
  const client = getVertexAIClient();
  if (!client) {
    console.warn("Vertex AI client not available");
    return false;
  }

  try {
    const model = client.preview.getGenerativeModel({
      model: "imagen-3.0-generate-002",
    });
    console.log("✓ Imagen model accessible");
    return true;
  } catch (err) {
    console.error(`Imagen access check failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
