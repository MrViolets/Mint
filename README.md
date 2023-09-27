# Aspen

Aspen is a session saver for Google Chrome. Save sessions for later, including windows, their relaive positions, all tabs in all window and tab groups.

## What it does

- Saves sessions that can be restored later.
- Saves windows, their sizes and positions, all tabs and tab groups.
- Restore saved sessions.

## Install

1. Download and uncompress zip.
2. In Chrome, go to the extensions page at `chrome://extensions/`.
3. Enable Developer Mode.
4. Choose `Load Unpacked` and select the folder.

## Build

1. `npm install` to install dependencies.
2. Update `version` in `manifest.json`.
3. `npm run build`.

## Usage

Once installed, click the extension icon and then click the "Save Session" button to save a session. Alterantively use the shortcut `Shift+Cmd+S` or `Shift+Ctrl+S` to save your current session at any time. To restore a saved session simply click on it from the extension popup.

## License

Aspen is licensed under the GNU General Public License version 3.
