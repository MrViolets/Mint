'use strict'

/* global chrome, Audio */

chrome.runtime.onMessage.addListener(onMessageReceived)

function onMessageReceived (message, sender, sendResponse) {
  if (message.msg === 'play_sound') {
    playSound()
  }

  sendResponse()
}

function playSound () {
  const playable = new Audio(chrome.runtime.getURL('./offscreen/audio/success.mp3'))
  playable.play()
}
