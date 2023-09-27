'use strict'

/* global chrome */

import * as ch from '../chrome/promisify.js'

window.addEventListener('load', init)

async function init () {
  try {
    await insertStrings()
  } catch (error) {
    console.error(error)
  }

  fadeInPage()
}

async function insertStrings () {
  try {
    const strings = document.querySelectorAll('[data-localize]')

    if (strings) {
      for (const s of strings) {
        s.innerHTML = chrome.i18n.getMessage(s.dataset.localize)
      }
    }

    const accelerators = document.querySelectorAll('[data-accelerator]')

    const platformInfo = await ch.getPlatformInfo().catch((error) => {
      console.error(error)
    })

    if (accelerators) {
      for (const a of accelerators) {
        if (platformInfo.os === 'mac') {
          a.innerText = chrome.i18n.getMessage(`ACCELERATOR_${a.dataset.accelerator}_MAC`)
        } else {
          a.innerText = chrome.i18n.getMessage(`ACCELERATOR_${a.dataset.accelerator}`)
        }
      }
    }

    document.getElementById('version').innerText = `v${chrome.runtime.getManifest().version}`
  } catch (error) {
    console.error(error)
  }
}

function fadeInPage () {
  document.querySelector('.container').classList.remove('hidden')
}
