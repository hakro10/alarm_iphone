# iOS PWA Installation Guide

## How to Install the Alarm App on iOS

### Installation Steps:

1. **Open Safari** on your iOS device
2. **Navigate** to your alarm app URL
3. **Tap the Share button** (the square with an arrow pointing up) at the bottom of the screen
4. **Scroll down** and tap "Add to Home Screen"
5. **Customize the name** if desired (default: "Alarm App")
6. **Tap "Add"** in the top right corner

### Important Notes for iOS PWA:

#### For Alarms to Work Properly:
- **Keep the app open** in the background
- **Don't close the app** completely (don't swipe it up from the app switcher)
- **Lock your phone** while the app is running in the background
- The app will continue to check for alarms even when the screen is locked

#### Permissions:
- **Allow Notifications** when prompted for alarm notifications
- **Keep the app in foreground** or background for reliable alarm triggering

#### Sound Requirements:
- The app uses Web Audio API for alarm sounds
- Custom sound uploads are stored locally on your device
- Alarm sounds will play even when the phone is on silent mode (in most cases)

#### Battery Optimization:
- The app uses Wake Lock API to prevent the device from sleeping
- This may impact battery life, so charge your device overnight
- The app is optimized for minimal battery usage

### Troubleshooting:

#### Alarms Not Triggering:
1. Ensure the app is still running (check in app switcher)
2. Make sure notifications are enabled
3. Keep the app open in the background
4. Check that your device is not in Do Not Disturb mode

#### Sound Issues:
1. Check device volume settings
2. Ensure the app has permission to play audio
3. Try using different alarm sounds
4. Test with custom uploaded sounds

#### App Not Installing:
1. Make sure you're using Safari (not Chrome or other browsers)
2. Check that you have enough storage space
3. Restart Safari and try again

### Best Practices:
- Install the app when you're ready to use it
- Test alarms before relying on them
- Keep your device charged
- Don't force-close the app
- Update the app periodically by refreshing the web page

The app is designed to work offline and will continue to function even without an internet connection once installed.
