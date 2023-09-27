'use strict'

/* global chrome, self */

export async function hasDocument (path) {
  const offscreenUrl = chrome.runtime.getURL(path)

  let matchedClients

  try {
    matchedClients = await self.clients.matchAll()
  } catch (error) {
    console.error('An error occurred:', error)
    return
  }

  for (const client of matchedClients) {
    if (client.url === offscreenUrl) {
      return true
    }
  }
  return false
}

export function create (path) {
  return new Promise((resolve, reject) => {
    chrome.offscreen.createDocument(
      {
        url: chrome.runtime.getURL(path),
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'ui sfx playback'
      },
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve()
      }
    )
  })
}
