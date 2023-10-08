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
        const displayContainingWindow = getDisplayContainingWindow(screenInfo, win)

        const groupDetails = {}
        groupsInWindow.forEach((group) => {
          groupDetails[group.id] = {
            title: group.title,
            color: group.color,
            collapsed: group.collapsed
          }
        })

        const relativeX = (win.left - displayContainingWindow.workArea.left) / displayContainingWindow.workArea.width
        const relativeY = (win.top - displayContainingWindow.workArea.top) / displayContainingWindow.workArea.height
        const relativeWidth = win.width / displayContainingWindow.workArea.width
        const relativeHeight = win.height / displayContainingWindow.workArea.height

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
          numGroups: groupsInWindow.length,
          displayInfo: {
            top: displayContainingWindow.bounds.top,
            left: displayContainingWindow.bounds.left,
            width: displayContainingWindow.bounds.width,
            height: displayContainingWindow.bounds.height,
            isPrimary: displayContainingWindow.isPrimary,
            isInternal: displayContainingWindow.isInternal,
            rotation: displayContainingWindow.rotation,
            id: displayContainingWindow.id
          }
        }
      })

      const windowsData = await Promise.all(windowsDataPromises)
      const randomColor = colors[Math.floor(Math.random() * colors.length)]

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

        const isSameSize = (display, windowData) => display.bounds.width === windowData.displayInfo.width && display.bounds.height === windowData.displayInfo.height
        const isSameType = (display, windowData) => display.isInternal === windowData.displayInfo.isInternal && display.isPrimary === windowData.displayInfo.isPrimary
        const isSameOrientation = (display, windowData) => display.rotation === windowData.displayInfo.rotation
        const hasMatchingProperties = (display, windowData) => display.id === windowData.displayInfo.id || display.bounds.top === windowData.displayInfo.top || display.bounds.left === windowData.displayInfo.left
        const targetDisplay = screenInfo.find((display) =>
          isSameSize(display, windowData) &&
          isSameType(display, windowData) &&
          isSameOrientation(display, windowData) &&
          hasMatchingProperties(display, windowData)) ||
          screenInfo[0]

        const left = Math.max(
          targetDisplay.workArea.left,
          Math.round(windowData.position.relativeX * targetDisplay.workArea.width) + targetDisplay.workArea.left
        )
        const top = Math.max(
          targetDisplay.workArea.top,
          Math.round(windowData.position.relativeY * targetDisplay.workArea.height) + targetDisplay.workArea.top
        )
        const width = Math.round(windowData.size.relativeWidth * targetDisplay.workArea.width)
        const height = Math.round(windowData.size.relativeHeight * targetDisplay.workArea.height)

        const createWindowConfig = {
          left,
          top,
          width,
          height,
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

function getDisplayContainingWindow (connectedDisplays, targetWindow) {
  const targetX = targetWindow.left
  const targetY = targetWindow.top

  let selectedDisplay = null
  let maxIntersectionArea = 0

  for (const display of connectedDisplays) {
    const displayLeft = display.bounds.left
    const displayRight = display.bounds.left + display.bounds.width
    const displayTop = display.bounds.top
    const displayBottom = display.bounds.top + display.bounds.height

    const intersectionLeft = Math.max(targetX, displayLeft)
    const intersectionRight = Math.min(targetX + targetWindow.width, displayRight)
    const intersectionTop = Math.max(targetY, displayTop)
    const intersectionBottom = Math.min(targetY + targetWindow.height, displayBottom)
    const intersectionWidth = intersectionRight - intersectionLeft
    const intersectionHeight = intersectionBottom - intersectionTop

    const intersectionArea = Math.max(0, intersectionWidth) * Math.max(0, intersectionHeight)

    if (intersectionArea > maxIntersectionArea) {
      selectedDisplay = display
      maxIntersectionArea = intersectionArea
    }
  }

  return selectedDisplay
}
