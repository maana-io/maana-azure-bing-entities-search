import KeyVault from 'azure-keyvault'
import { AuthenticationContext } from 'adal-node'
require('dotenv')

const clientId = process.env.AZURE_CLIENT_ID
const clientSecret = process.env.AZURE_CLIENT_SECRET
const vaultUri = process.env.AZURE_VAULT_ENDPOINT

// Authenticator - retrieves the access token
const authenticator = (challenge, callback) => {
  // Create a new authentication context.
  var context = new AuthenticationContext(challenge.authorization)

  // Use the context to acquire an authentication token.
  return context.acquireTokenWithClientCredentials(
    challenge.resource,
    clientId,
    clientSecret,
    (err, tokenResponse) => {
      if (err) throw err
      // Calculate the value to be set in the request's Authorization header and resume the call.
      var authorizationValue =
        tokenResponse.tokenType + ' ' + tokenResponse.accessToken

      return callback(null, authorizationValue)
    }
  )
}

const credentials = new KeyVault.KeyVaultCredentials(authenticator)
const client = new KeyVault.KeyVaultClient(credentials)

module.exports = {
  getSecret: async (secretName, secretVersion = '') => {
    return client
      .getSecret(vaultUri, secretName, secretVersion)
      .then(result => {
        return result.value
      })
  }
}
