import { log, print } from 'io.maana.shared'

import { gql } from 'apollo-server-express'
import uuid from 'uuid'
import { EntitySearchClient } from '@azure/cognitiveservices-entitysearch'
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js'
import _ from 'lodash'
import { getSecret } from '../../vault'

require('dotenv').config()

const SERVICE_ID = process.env.SERVICE_ID
const SELF = SERVICE_ID || 'io.maana.bing.entities-search'
const AZURE_BING_ENTITY_SEARCH_KEY_NAME =
  process.env.AZURE_BING_ENTITY_SEARCH_KEY_NAME
const AZURE_BING_ENTITY_SEARCH_ENDPOINT =
  process.env.AZURE_BING_ENTITY_SEARCH_ENDPOINT

const getEntitySearchClient = async () => {
  const entitySearchKey = await getSecret(AZURE_BING_ENTITY_SEARCH_KEY_NAME)
  const cognitiveServiceCredentials = new CognitiveServicesCredentials(
    entitySearchKey
  )
  const client = new EntitySearchClient(
    cognitiveServiceCredentials,
    {
      endpoint: AZURE_BING_ENTITY_SEARCH_ENDPOINT
    }
  )
  return client
}

export const resolver = {
  Query: {
    info: async (_, args, { client }) => {
      let remoteId = SERVICE_ID

      try {
        if (client) {
          const query = gql`
            query info {
              info {
                id
              }
            }
          `
          const {
            data: {
              info: { id }
            }
          } = await client.query({ query })
          remoteId = id
        }
      } catch (e) {
        log(SELF).error(
          `Info Resolver failed with Exception: ${e.message}\n${print.external(
            e.stack
          )}`
        )
      }

      return {
        id: SERVICE_ID,
        name: 'io.maana.template',
        description: `Maana Q Knowledge Service template using ${remoteId}`
      }
    },
    extractEntities: async (_, { text }) => {
      const client = await getEntitySearchClient()
      
      const result = await client.entities.search(text)
      // console.log(JSON.stringify(result, null, 2))
      const res = {
        id: result.bingId || uuid(),
        entities: result?.entities?.value.map(entity => ({
          id: uuid(),
          ...entity,
          entityPresentationInfo: {
            id: uuid(),
            ...entity.entityPresentationInfo
          },
          image: {
            id: uuid(),
            ...entity.image
          }
          
        })),
        places: result?.places?.value.map(place => ({
          id: uuid(),
          ...place,
          entityPresentationInfo: {
            id: uuid(),
            ...entity.entityPresentationInfo
          }                
        }))
      }

      console.log(JSON.stringify(res, null, 2))

      return res
    }    
  }
}
