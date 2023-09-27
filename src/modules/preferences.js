'use strict'

/* global chrome */

import * as ch from '../chrome/promisify.js'

export const defaults = {
  close_windows_on_save: {
    title: chrome.i18n.getMessage('MENU_CLOSE_WINDOWS_SAVE'),
    value: false,
    type: 'checkbox'
  },
  close_windows_on_restore: {
    title: chrome.i18n.getMessage('MENU_CLOSE_WINDOWS_RESTORE'),
    value: false,
    type: 'checkbox'
  },
  clear_sessions_after_use: {
    title: chrome.i18n.getMessage('MENU_SESSION_EXPIRE'),
    value: false,
    type: 'checkbox'
  }
}

export async function get () {
  try {
    const result = await ch.storageLocalGet({ preferences: defaults })
    const userPreferences = result.preferences

    for (const key in userPreferences) {
      if (!(key in defaults)) {
        delete userPreferences[key]
      }
    }

    for (const defaultKey in defaults) {
      if (!(defaultKey in userPreferences)) {
        userPreferences[defaultKey] = defaults[defaultKey]
      }
    }

    return userPreferences
  } catch (error) {
    console.error(error)
    return defaults
  }
}
