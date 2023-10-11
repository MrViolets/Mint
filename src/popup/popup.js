'use strict'

/* global chrome */

import * as ch from '../chrome/promisify.js'
import * as ws from '../modules/session.js'
import * as preferences from '../modules/preferences.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await insertStrings()
    await restorePreferences()
    registerListeners()
    await renderSessions()
  } catch (error) {
    console.error(error)
  }
}

async function insertStrings () {
  try {
    const strings = document.querySelectorAll('[data-localize]')

    if (strings) {
      for (const s of strings) {
        s.innerText = chrome.i18n.getMessage(s.dataset.localize)
      }
    }

    const accelerators = document.querySelectorAll('[data-accelerator]')

    const platformInfo = await ch.getPlatformInfo().catch((error) => {
      console.error(error)
    })

    if (accelerators) {
      for (const a of accelerators) {
        if (platformInfo.os === 'mac') {
          a.innerText = chrome.i18n.getMessage(
            `ACCELERATOR_${a.dataset.accelerator}_MAC`
          )
        } else {
          a.innerText = chrome.i18n.getMessage(
            `ACCELERATOR_${a.dataset.accelerator}`
          )
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function restorePreferences () {
  try {
    const userPreferences = await preferences.get()

    for (const [preferenceName, preferenceObj] of Object.entries(
      userPreferences
    )) {
      const el = document.getElementById(preferenceName)

      if (preferenceObj.type === 'radio') {
        el.value = preferenceObj.value
      } else if (preferenceObj.type === 'checkbox') {
        el.checked = preferenceObj.value
      }
    }
  } catch (error) {
    console.error(error)
  }
}

function registerListeners () {
  try {
    const on = (target, event, handler) => {
      if (typeof target === 'string') {
        document.getElementById(target).addEventListener(event, handler, false)
      } else {
        target.addEventListener(event, handler, false)
      }
    }

    const onAll = (target, event, handler) => {
      const elements = document.querySelectorAll(target)

      for (const el of elements) {
        el.addEventListener(event, handler, false)
      }
    }

    chrome.storage.onChanged.addListener(onStorageChanged)

    on(document, 'keydown', onDocumentKeydown)
    on('new_workspace', 'click', onNewSessionButtonClicked)
    onAll('input[type="checkbox"]', 'change', onCheckBoxChanged)
    onAll('div.nav-index', 'click', onActionClicked)
    on('workspace_list', 'click', onWorkspaceClicked)
    on('workspace_list', 'change', onWorkspacesChanged)
  } catch (error) {
    console.error(error)
  }
}

async function onActionClicked (e) {
  try {
    if (e.target.id === 'rate' || e.target.id === 'donate') {
      openExternal(e.target.id)
    }
    // window.close()
  } catch (error) {
    console.error(error)
  }
}

async function onNewSessionButtonClicked () {
  try {
    const sessionInfo = await ws.Session.getCounts()
    const { numWindows, numTabs, numGroups } = sessionInfo

    const windowStr = numWindows > 1 ? `${numWindows} Windows, ` : ''
    const tabStr = `${numTabs} Tab${numTabs !== 1 ? 's' : ''}`
    const groupStr =
      numGroups > 0
        ? `, ${numGroups} Tab Group${numGroups !== 1 ? 's' : ''}`
        : ''

    const placeHolderTitle = `${windowStr}${tabStr}${groupStr}`

    const title = window.prompt('Choose a name', placeHolderTitle)

    if (!title) return

    const savedSessions = await ch.storageLocalGet({ sessions: [] })
    const workspaceData = await ws.Session.create(title)

    savedSessions.sessions.unshift(workspaceData)
    await ch.storageLocalSet({ sessions: savedSessions.sessions })

    const parentEl = document.getElementById('workspace_list')
    const newWorkspaceEl = getNewWorkspaceEl(workspaceData)
    if (parentEl.firstChild) {
      parentEl.insertBefore(newWorkspaceEl, parentEl.firstChild)
    } else {
      parentEl.appendChild(newWorkspaceEl)
    }

    const userPreferences = await preferences.get()

    if (userPreferences.close_windows_on_save.value === true) {
      const currentWindows = await ch.windowsGetAll()
      const currentWindowIds = currentWindows.map((win) => win.id)
      for (const windowId of currentWindowIds) {
        await ch.windowsRemove(windowId)
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function onCheckBoxChanged (e) {
  try {
    await updateUserPreference(e, 'checked', !e.target.checked)
  } catch (error) {
    console.error(error)
  }
}

async function updateUserPreference (e, valueKey, backupValue) {
  try {
    const userPreferences = await preferences.get()
    const preference = userPreferences[e.target.id]

    if (!preference) return

    preference.value = e.target[valueKey]

    await ch.storageLocalSet({ preferences: userPreferences })
  } catch (error) {
    console.error(error)
    e.target[valueKey] = backupValue
  }
}

async function onWorkspaceClicked (e) {
  try {
    if (e.target.dataset.id) {
      await ch.sendMessage({
        msg: 'restore_workspace',
        workspaceId: e.target.dataset.id
      })

      const userPreferences = await preferences.get()
      if (userPreferences.clear_sessions_after_use.value === true) {
        await deleteSession(e.target)
      }
    } else if (e.target.classList.contains('remove')) {
      if (
        window.confirm('Do you really want to delete this session?') === true
      ) {
        const parent = e.target.closest('div[data-id]')
        if (!parent) return

        await deleteSession(parent)
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function onWorkspacesChanged (e) {
  if (e.target.classList.contains('color-select')) {
    const parent = e.target.closest('div[data-id]')
    if (!parent) return

    const sessionId = parent.dataset.id
    const savedSessions = await ch.storageLocalGet({ sessions: [] })
    const sessionToUpdate = savedSessions.sessions.find(
      (session) => session.id === sessionId
    )
    if (!sessionToUpdate) return

    const newColor = e.target.value
    sessionToUpdate.data.color = newColor

    await ch.storageLocalSet({ sessions: savedSessions.sessions })

    const dot = parent.querySelector('.color-dot')
    if (dot) {
      for (const color of ws.colors) {
        dot.classList.remove(color)
      }

      dot.classList.add(newColor)
    }
  }
}

async function deleteSession (el) {
  try {
    const sessionToRemove = el.dataset.id

    const savedSessions = await ch.storageLocalGet({ sessions: [] })
    savedSessions.sessions = savedSessions.sessions.filter(
      (session) => session.id !== sessionToRemove
    )
    await ch.storageLocalSet({ sessions: savedSessions.sessions })
    el.remove()
  } catch (error) {
    console.error(error)
  }
}

async function renderSessions () {
  try {
    const parentEl = document.getElementById('workspace_list')
    const savedSessions = await ch.storageLocalGet({ sessions: [] })

    parentEl.innerHTML = ''

    for (const session of savedSessions.sessions) {
      parentEl.appendChild(getNewWorkspaceEl(session))
    }
  } catch (error) {
    console.error(error)
  }
}

function getNewWorkspaceEl (session) {
  try {
    const div = document.createElement('div')
    div.classList.add('item', 'nav-index')
    div.dataset.id = session.id

    const leftDetail = document.createElement('div')
    leftDetail.classList.add('left-detail')

    const rightDetail = document.createElement('div')
    rightDetail.classList.add('right-detail')

    const colorDotContainer = document.createElement('div')
    colorDotContainer.classList.add('color-dot-container')

    const colorDot = document.createElement('div')
    colorDot.classList.add('color-dot', session.data.color)

    const colorSelect = document.createElement('select')
    colorSelect.classList.add('color-select')

    if (session.data.color) {
      colorDot.classList.add(session.data.color)
    } else {
      colorDot.classList.add('grey')
    }

    for (const color of ws.colors) {
      const capitalizedOption = color.charAt(0).toUpperCase() + color.slice(1)
      const optionElement = document.createElement('option')
      optionElement.value = color
      optionElement.innerText = capitalizedOption
      colorSelect.appendChild(optionElement)
    }

    colorSelect.value = session.data.color || 'grey'

    const removeButtonContainer = document.createElement('div')
    removeButtonContainer.classList.add('remove')

    const removeButton = document.createElement('div')
    removeButton.classList.add('remove-icon')

    const label = document.createElement('div')
    label.classList.add('label')
    label.innerText = session.title

    removeButtonContainer.appendChild(removeButton)
    colorDotContainer.appendChild(colorDot)
    colorDotContainer.appendChild(colorSelect)
    leftDetail.appendChild(colorDotContainer)
    leftDetail.appendChild(label)
    rightDetail.appendChild(removeButtonContainer)
    div.appendChild(leftDetail)
    div.appendChild(rightDetail)

    return div
  } catch (error) {
    console.error(error)
    return null
  }
}

async function openExternal (type) {
  try {
    let url

    if (type === 'rate') {
      const extensionId = chrome.runtime.id
      url = `https://chrome.google.com/webstore/detail/${extensionId}`
    } else if (type === 'donate') {
      url = 'https://www.buymeacoffee.com/mrviolets'
    }

    if (url) {
      await ch.tabsCreate({ url })
    } else {
      console.error('Invalid type provided to openExternal:', type)
    }
  } catch (error) {
    console.error(error)
  }
}

function onDocumentKeydown (e) {
  try {
    if (e.key === 'u' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      const saveSessionButton = document.getElementById('new_workspace')
      saveSessionButton.click()
    }
  } catch (error) {
    console.error(error)
  }
}

function onStorageChanged(changes) {
  const { sessions } = changes
  
  if (sessions && Array.isArray(sessions.newValue) && sessions.newValue.length > 0) {
    if (!sessions.oldValue || 
       (Array.isArray(sessions.oldValue) && sessions.newValue.length > sessions.oldValue.length)) {
      renderSessions()
    }
  }
}