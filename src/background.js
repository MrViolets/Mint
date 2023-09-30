'use strict'

/* global self, chrome */

// Fix the command

import * as ch from './chrome/promisify.js'
import * as ws from './modules/session.js'
import * as preferences from './modules/preferences.js'

chrome.runtime.onInstalled.addListener(onInstalled)
chrome.runtime.onMessage.addListener(onMessageReceived)
chrome.commands.onCommand.addListener(onCommandReceived)

async function onInstalled (info) {
  if (info && 'reason' in info && info.reason === 'install') {
    await showOnboarding()
  }
}

async function showOnboarding () {
  try {
    const url = chrome.runtime.getURL('onboarding/onboarding.html')

    if (url) {
      await ch.tabsCreate({ url })
    }
  } catch (error) {
    console.error(error)
  }
}

async function onMessageReceived (message, sender, sendResponse) {
  try {
    if (message.msg === 'restore_workspace') {
      sendResponse()
      const savedSessions = await ch.storageLocalGet({ sessions: [] })

      for (const session of savedSessions.sessions) {
        if (session.active === true) {
          session.active = false
        }
      }

      const targetWorkspace = savedSessions.sessions.find((x) => x.id === message.workspaceId)
      targetWorkspace.active = true
      await ch.storageLocalSet({ sessions: savedSessions.sessions })

      const currentWindows = await ch.windowsGetAll()
      const currentWindowIds = currentWindows.map((win) => win.id)

      await ws.Session.restore(targetWorkspace.data)

      const userPreferences = await preferences.get()

      if (userPreferences.close_windows_on_restore.value === true) {
        for (const windowId of currentWindowIds) {
          await ch.windowsRemove(windowId)
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function onCommandReceived (command) {
  try {
    if (command === 'save_current_session') {
      const sessionInfo = await ws.Session.getCounts()
      const { numWindows, numTabs, numGroups } = sessionInfo

      const windowStr = numWindows > 1 ? `${numWindows} Windows, ` : ''
      const tabStr = `${numTabs} Tab${numTabs !== 1 ? 's' : ''}`
      const groupStr = numGroups > 0 ? `, ${numGroups} Tab group${numGroups !== 1 ? 's' : ''}` : ''

      const sessionTitle = `${windowStr}${tabStr}${groupStr}`

      const workspaceData = await ws.Session.create(sessionTitle)
      const savedSessions = await ch.storageLocalGet({ sessions: [] })
      savedSessions.sessions.unshift(workspaceData)
      await ch.storageLocalSet({ sessions: savedSessions.sessions })

      const throttledplaySound = throttle(playSound)
      throttledplaySound()
    }
  } catch (error) {
    console.error(error)
  }
}

async function playSound (sound) {
  try {
    const documentPath = chrome.runtime.getURL('offscreen/audio-player.html')
    const hasDocument = await hasOffscreenDocument(documentPath)

    if (!hasDocument) {
      await ch.offscreenCreateDocument({
        url: documentPath,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'ui sfx playback'
      })
    }

    await ch.sendMessage({ msg: 'play_sound', sound })
  } catch (error) {
    console.error(error)
  }
}

async function hasOffscreenDocument (path) {
  try {
    const matchedClients = await self.clients.matchAll()

    for (const client of matchedClients) {
      if (client.url === path) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error(error)
    return false
  }
}

function throttle (func, delay = 100) {
  let lastExecTime = 0
  return function () {
    const context = this
    const args = arguments
    const now = Date.now()
    if (now - lastExecTime >= delay) {
      lastExecTime = now
      func.apply(context, args)
    }
  }
}
