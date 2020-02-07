import { log, print } from 'io.maana.shared'

import { gql } from 'apollo-server-express'
import pubsub from '../../pubsub'
import uuid from 'uuid'
import { FormRecognizerClient } from '@azure/cognitiveservices-formrecognizer'
import { CognitiveServicesCredentials } from '@azure/ms-rest-azure-js'
import _ from 'lodash'
import { getSecret } from '../../vault'

require('dotenv').config()
const promisePoll = (promiseFunction, { pollIntervalMs = 500 } = {}) => {
  const startPoll = async resolve => {
    const startTime = new Date()
    const result = await promiseFunction()

    if (result) return resolve()

    const timeUntilNext = Math.max(pollIntervalMs - (new Date() - startTime), 0)
    setTimeout(() => startPoll(resolve), timeUntilNext)
  }

  return new Promise(startPoll)
}

const SERVICE_ID = process.env.SERVICE_ID
const SELF = SERVICE_ID || 'io.maana.template'
const AZURE_FORM_RECOGNIZER_KEY_NAME =
  process.env.AZURE_FORM_RECOGNIZER_KEY_NAME
// dummy in-memory store
const AZURE_FORM_RECOGNIZER_ENDPOINT =
  process.env.AZURE_FORM_RECOGNIZER_ENDPOINT
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
    recognizeForm: async (_parent, { file }) => {
      const formRecognizerKey = await getSecret(AZURE_FORM_RECOGNIZER_KEY_NAME)
      const cognitiveServiceCredentials = new CognitiveServicesCredentials(
        formRecognizerKey
      )
      const client = new FormRecognizerClient(
        cognitiveServiceCredentials,
        AZURE_FORM_RECOGNIZER_ENDPOINT
      )

      const { operationLocation } = await client.batchReadReceipt(file.id)
      const operationId = _.last(operationLocation.split('/'))

      const checkIfOperationDoneAsync = async operationId => {
        const { status } = await client.getReadReceiptResult(operationId)
        return !(status === 'Running')
      }

      await promisePoll(() => checkIfOperationDoneAsync(operationId))
      const {
        recognitionResults,
        understandingResults
      } = await client.getReadReceiptResult(operationId)

      return {
        id: uuid(),
        recognitionResults: recognitionResults.map(result => ({
          id: uuid(),
          ...result,
          lines: result.lines.map(line => {
            return {
              id: uuid(),
              ...line,
              words: line.words.map(word => ({
                id: uuid(),
                ...word
              }))
            }
          })
        })),
        understandingResults: understandingResults.map(result => ({
          id: uuid(),
          pages: result.pages,
          fields: Object.keys(result.fields).map(key => {
            return {
              id: uuid(),
              name: key,
              ...result.fields[key]
            }
          })
        }))
      }
    }
  }
}
