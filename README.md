# shelly-blu-wallswitch-scripts

Shelly scripts for controlling a relay directly from Shelly BLU Wall Switch 4 buttons over Bluetooth (BTHome v2). Runs fully locally on the Shelly device. No cloud, no gateway and no Home Assistant required.

## Scripts

| File | Purpose |
|------|---------|
| `switch-control.js` | Turns the relay on and off when a button is pressed on one or more BLU wall switches |
| `mac-finder.js` | Prints the MAC address of any BTHome device when one of its buttons is pressed |

## Requirements

* A Shelly device with scripting and Bluetooth support (Gen2 or newer), for example a Shelly 1PM
* A Shelly BLU Wall Switch 4 or another BLU device that sends button events over BTHome v2
* Encryption must be disabled on the BLU device. Encrypted packets are ignored.

Tested with Shelly 1PM and Shelly BLU Wall Switch 4 ZB.

## Setup

1. Open the web interface of the Shelly device (its IP address, or `http://192.168.33.1` when connected to the device's own access point).
2. Go to **Settings > Bluetooth** and enable Bluetooth.
3. Go to **Scripts**, create a new script and paste in the script you want to use.
4. Save and start the script.
5. Enable **Run on startup** so the script starts again after a reboot or power loss.

## Finding the MAC address of a switch

1. Add and start `mac-finder.js`.
2. Press any button on the wall switch.
3. The script log shows a line like:

   ```
   PRESS f8:44:77:34:2e:3f button 1: single rssi=-45 battery=82%
   ```

4. Copy the MAC address and stop or delete the finder script.

If several switches are nearby, hold the one you want close to the Shelly and set `minRssi` to for example `-60` so only nearby devices are shown.

## Configuring switch-control.js

Add one entry per wall switch in the `SWITCHES` list:

```javascript
let SWITCHES = [
  { mac: "f8:44:77:34:2e:3f", onButton: 1, offButton: 2 },
  { mac: "f8:44:77:34:eb:c8", onButton: 1, offButton: 2 }
];
```

| Setting | Description |
|---------|-------------|
| `mac` | MAC address of the wall switch, lowercase with colons |
| `onButton` | Button number (1 to 4) that turns the relay on |
| `offButton` | Button number (1 to 4) that turns the relay off |

General settings in `CONFIG`:

| Setting | Description |
|---------|-------------|
| `switchId` | Relay output to control, `0` on single channel devices |
| `debug` | Set to `true` to log button presses and actions |

Several switches can control the same relay, and several Shelly devices can listen to the same switch on different buttons. Each Shelly only reacts to the buttons configured in its own script.

## How it works

The BLU wall switch broadcasts BTHome v2 advertisements with service data UUID `0xFCD2`. Each packet contains a packet id, battery level and one button object (`0x3A`) per button, in order from button 1 to 4. The script:

1. Filters advertisements by MAC address
2. Decodes the BTHome v2 payload
3. Skips repeated advertisements using the packet id
4. Calls `Switch.Set` when a single press is detected on a configured button

## Limitations

* Only single presses are handled. Double, long and hold events are ignored.
* Encrypted BTHome packets are not supported.
* Dimmers use the `Light` component instead of `Switch`, so the script needs changes to control a dimmer. Shelly Gen3 dimmers and relays also support direct pairing with BLU switches without any script.