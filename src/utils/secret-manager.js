import { SecretsManagerClient, GetSecretValueCommand} from "@aws-sdk/client-secrets-manager";

export async function getSecrets(){
  const secret_name = "secret_Keys";
  const client = new SecretsManagerClient({
    region: "us-east-1",
  });
  
  let response;
  
  try {
    response = await client.send(
      new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT", 
      })
    );

    const secretKeys = JSON.parse(response.SecretString);
    return secretKeys;
  } catch (error) {
    throw error;
  }
}
