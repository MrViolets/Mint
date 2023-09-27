'use strict'

/* global chrome */

export const displayGetInfo = promisifyChromeMethod(chrome.system.display.getInfo.bind(chrome.system.display))
export const windowsGetAll = promisifyChromeMethod(chrome.windows.getAll.bind(chrome.windows))
export const windowsGetCurrent = promisifyChromeMethod(chrome.windows.getCurrent.bind(chrome.windows))
export const tabGroupsQuery = promisifyChromeMethod(chrome.tabGroups.query.bind(chrome.tabGroups))
export const windowsCreate = promisifyChromeMethod(chrome.windows.create.bind(chrome.windows))
export const tabsCreate = promisifyChromeMethod(chrome.tabs.create.bind(chrome.tabs))
export const tabsUpdate = promisifyChromeMethod(chrome.tabs.update.bind(chrome.tabs))
export const tabsGroup = promisifyChromeMethod(chrome.tabs.group.bind(chrome.tabs))
export const tabGroupsUpdate = promisifyChromeMethod(chrome.tabGroups.update.bind(chrome.tabGroups))
export const windowsRemove = promisifyChromeMethod(chrome.windows.remove.bind(chrome.windows))
export const systemDisplayGetInfo = promisifyChromeMethod(chrome.system.display.getInfo.bind(chrome.system.display))
export const storageLocalGet = promisifyChromeMethod(chrome.storage.local.get.bind(chrome.storage.local))
export const storageLocalSet = promisifyChromeMethod(chrome.storage.local.set.bind(chrome.storage.local))
export const sendMessage = promisifyChromeMethod(chrome.runtime.sendMessage.bind(chrome.runtime))
export const tabsGetZoom = promisifyChromeMethod(chrome.tabs.getZoom.bind(chrome.tabs))
export const tabsSetZoom = promisifyChromeMethod(chrome.tabs.setZoom.bind(chrome.tabs))
export const offscreenCreateDocument = promisifyChromeMethod(chrome.offscreen.createDocument.bind(chrome.offscreen))
export const getPlatformInfo = promisifyChromeMethod(chrome.runtime.getPlatformInfo.bind(chrome.runtime))

function promisifyChromeMethod (method) {
  return (...args) =>
    new Promise((resolve, reject) => {
      method(...args, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError)))
        } else {
          resolve(result)
        }
      })
    })
}
