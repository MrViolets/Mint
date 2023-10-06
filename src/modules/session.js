'use strict'

import * as ch from '../chrome/promisify.js'

export class Session {
  constructor (title, data, id = null) {
    this.title = title
    this.id = id || this.getId()
    this.data = data
  }

  getId () {
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    return id
  }

  static async getCounts () {
    try {
      const windows = await ch.windowsGetAll({ populate: true })

      let numWindows = 0
      let numTabs = 0
      let numGroups = 0

      for (const win of windows) {
        numWindows++

        const groupsInWindow = await ch.tabGroupsQuery({ windowId: win.id })
        const groupValidTabCount = {}

        for (const group of groupsInWindow) {
          groupValidTabCount[group.id] = 0
        }

        for (const tab of win.tabs) {
          if (!(tab.url.startsWith('chrome://') || tab.url.startsWith('edge://'))) {
            numTabs++

            if (tab.groupId) {
              groupValidTabCount[tab.groupId]++
            }
          }
        }

        for (const groupId in groupValidTabCount) {
          if (groupValidTabCount[groupId] > 0) {
            numGroups++
          }
        }
      }

      return {
        numWindows,
        numTabs,
        numGroups
      }
    } catch (error) {
      console.error(error)
    }
  }

  static async create (title, id = null) {
    const data = await this.getData()
    return new Session(title, data, id)
  }

  static async getData () {
    try {
      const windows = await ch.windowsGetAll({ populate: true })
      const screenInfo = await ch.systemDisplayGetInfo()

      const windowsDataPromises = windows.map(async (win) => {
        const groupsInWindow = await ch.tabGroupsQuery({ windowId: win.id })

        const groupDetails = {}
        groupsInWindow.forEach((group) => {
          groupDetails[group.id] = {
            title: group.title,
            color: group.color,
            collapsed: group.collapsed
          }
        })

        const relativeX = win.left / screenInfo[0].bounds.width
        const relativeY = win.top / screenInfo[0].bounds.height
        const relativeWidth = win.width / screenInfo[0].bounds.width
        const relativeHeight = win.height / screenInfo[0].bounds.height

        const tabsDataPromises = win.tabs.map(async (tab) => {
          const tabUrl = tab.url || tab.pendingUrl
          if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('edge://')) return null

          const zoomFactor = await ch.tabsGetZoom(tab.id)
          const groupData = tab.groupId && groupDetails[tab.groupId] ? groupDetails[tab.groupId] : {}

          return {
            id: tab.id,
            url: tabUrl,
            title: tab.title || tabUrl,
            pinned: tab.pinned,
            groupId: tab.groupId,
            groupTitle: groupData.title || null,
            groupColor: groupData.color || null,
            groupCollapsed: groupData.collapsed || false,
            active: tab.id === win.activeTabId,
            zoomFactor
          }
        })

        // Wait for all tab promises to resolve
        const tabsData = (await Promise.all(tabsDataPromises)).filter(Boolean)

        return {
          id: win.id,
          type: win.type,
          tabs: tabsData,
          position: { relativeX, relativeY },
          size: { relativeWidth, relativeHeight },
          windowBounds: {
            left: win.left,
            top: win.top,
            width: win.width,
            height: win.height
          },
          numTabs: tabsData.length,
          numGroups: groupsInWindow.length
        }
      })

      const windowsData = await Promise.all(windowsDataPromises)
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      return {
        windowsData,
        numWindows: windowsData.length,
        numTabs: windowsData.reduce((acc, win) => acc + win.numTabs, 0),
        numGroups: windowsData.reduce((acc, win) => acc + win.numGroups, 0),
        date: getCurrentDateTimeFormatted(),
        color: randomColor
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  static async restore (data) {
    const groupMapping = {}

    try {
      for (const windowData of data.windowsData) {
        const screenInfo = await ch.systemDisplayGetInfo()
        const left = windowData.position.relativeX * screenInfo[0].bounds.width
        const top = windowData.position.relativeY * screenInfo[0].bounds.height
        const width = windowData.size.relativeWidth * screenInfo[0].bounds.width
        const height = windowData.size.relativeHeight * screenInfo[0].bounds.height

        const createWindowConfig = {
          left: Math.round(left),
          top: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
          type: windowData.type
        }

        if (windowData.tabs.length === 0) {
          createWindowConfig.url = null
        } else {
          createWindowConfig.url = windowData.tabs[0].url
        }

        const newWindow = await ch.windowsCreate(createWindowConfig)

        if (windowData.tabs.length > 0 && windowData.tabs[0].pinned) {
          await ch.tabsUpdate(newWindow.tabs[0].id, { pinned: true })
        }

        let activeTabId = null
        for (let i = 1; i < windowData.tabs.length; i++) {
          const tabData = windowData.tabs[i]
          const newTab = await ch.tabsCreate({
            windowId: newWindow.id,
            url: tabData.url,
            pinned: tabData.pinned,
            index: i
          })

          if (tabData.active) {
            activeTabId = newTab.id
          }

          if (tabData.zoomFactor) {
            try {
              await ch.tabsSetZoom(newTab.id, tabData.zoomFactor)
            } catch (error) {
              console.warn(error)
            }
          }

          if (tabData.groupId !== -1) {
            if (groupMapping[tabData.groupId]) {
              await ch.tabsGroup({
                groupId: groupMapping[tabData.groupId],
                tabIds: newTab.id
              })

              await ch.tabGroupsUpdate(groupMapping[tabData.groupId], {
                collapsed: tabData.groupCollapsed
              })
            } else {
              const newGroupResponse = await ch.tabsGroup({
                createProperties: { windowId: newWindow.id },
                tabIds: newTab.id
              })

              const newGroupId = newGroupResponse.id || newGroupResponse
              groupMapping[tabData.groupId] = newGroupId

              await ch.tabGroupsUpdate(newGroupId, {
                title: tabData.groupTitle,
                color: tabData.groupColor,
                collapsed: tabData.groupCollapsed
              })
            }
          }
        }

        if (activeTabId) {
          await ch.tabsUpdate(activeTabId, { active: true })
        }
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }
}

export function getCurrentDateTimeFormatted () {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minutes}`
}

export const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']