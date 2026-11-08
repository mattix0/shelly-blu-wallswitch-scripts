// Shelly script: control a relay with Shelly BLU Wall Switch 4 buttons via BTHome v2
// Supports several wall switches. Single press on onButton = relay on, single press on offButton = relay off

// One entry per wall switch. MAC must be lowercase with colons.
// Use mac-finder.js to find the MAC address of a switch.
let SWITCHES = [
  { mac: "aa:bb:cc:dd:ee:01", onButton: 1, offButton: 2 },
  { mac: "aa:bb:cc:dd:ee:02", onButton: 1, offButton: 2 }
];

let CONFIG = {
  switchId: 0,   // relay output to control
  debug: false   // true = log button presses and actions
};

let BTHOME_UUID = "fcd2";
let EVENT_SINGLE = 0x01;

let switchByMac = {};
let lastPacketId = {};

function log(msg) {
  if (CONFIG.debug) print(msg);
}

// Payload size in bytes for the BTHome v2 objects these switches send, -1 if unknown
function objSize(id) {
  if (id === 0x00) return 1; // packet id
  if (id === 0x01) return 1; // battery
  if (id === 0x3a) return 1; // button event
  return -1;
}

function parseBTHome(data) {
  if (typeof data !== "string" || data.length < 2) return null;

  let info = data.charCodeAt(0) & 0xff;
  if (info & 0x01) return null;                  // encrypted
  if (((info >> 5) & 0x07) !== 2) return null;   // not BTHome v2

  let result = { packetId: null, buttons: [] };
  let i = 1;

  while (i < data.length) {
    let id = data.charCodeAt(i) & 0xff;
    let size = objSize(id);
    if (size < 0 || i + 1 + size > data.length) break;

    let value = data.charCodeAt(i + 1) & 0xff;
    if (id === 0x00) result.packetId = value;
    if (id === 0x3a) result.buttons.push(value);

    i += 1 + size;
  }

  return result;
}

function isSinglePress(buttons, buttonNo) {
  let index = buttonNo - 1;
  return buttons.length > index && buttons[index] === EVENT_SINGLE;
}

function setRelay(on) {
  Shelly.call("Switch.Set", { id: CONFIG.switchId, on: on }, function (res, errCode, errMsg) {
    if (errCode !== 0) print("Switch.Set failed: " + errCode + " " + errMsg);
  });
}

function onScanResult(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT || !res || typeof res.addr !== "string") return;

  let mac = res.addr.toLowerCase();
  let sw = switchByMac[mac];
  if (!sw) return;
  if (!res.service_data || typeof res.service_data[BTHOME_UUID] !== "string") return;

  let p = parseBTHome(res.service_data[BTHOME_UUID]);
  if (!p || p.packetId === null) return;

  // Each switch repeats its advertisements several times
  if (p.packetId === lastPacketId[mac]) return;
  lastPacketId[mac] = p.packetId;

  if (isSinglePress(p.buttons, sw.onButton)) {
    log(mac + " button " + sw.onButton + " single: relay on");
    setRelay(true);
  } else if (isSinglePress(p.buttons, sw.offButton)) {
    log(mac + " button " + sw.offButton + " single: relay off");
    setRelay(false);
  }
}

function init() {
  for (let i = 0; i < SWITCHES.length; i++) {
    let mac = SWITCHES[i].mac.toLowerCase();
    switchByMac[mac] = SWITCHES[i];
    lastPacketId[mac] = -1;
  }

  let bleConfig = Shelly.getComponentConfig("ble");
  if (!bleConfig || !bleConfig.enable) {
    print("Bluetooth is disabled. Enable it under Settings > Bluetooth and restart the script.");
    return;
  }

  BLE.Scanner.Subscribe(onScanResult);

  if (!BLE.Scanner.isRunning()) {
    let started = BLE.Scanner.Start({
      duration_ms: BLE.Scanner.INFINITE_SCAN,
      active: false
    });
    if (!started) {
      print("Failed to start BLE scanner");
      return;
    }
  }

  for (let i = 0; i < SWITCHES.length; i++) {
    print("Listening for wall switch " + SWITCHES[i].mac + ", on=button " +
      SWITCHES[i].onButton + ", off=button " + SWITCHES[i].offButton);
  }
}

init();