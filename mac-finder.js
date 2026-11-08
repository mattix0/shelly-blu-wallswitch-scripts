let CONFIG = {
  // true = also print every new BTHome device once, even without a button press
  showAllBTHome: false,
  // Ignore weaker signals, e.g. -70 to only see devices close to the Shelly
  minRssi: -100
};

let BTHOME_UUID = "fcd2";
let lastPacketId = {};
let lastPacketCount = 0;
let announced = {};

function eventName(code) {
  switch (code) {
    case 0x01: return "single";
    case 0x02: return "double";
    case 0x03: return "triple";
    case 0x04: return "long";
    case 0x05: return "long_double";
    case 0x06: return "long_triple";
    case 0x80: return "hold";
    default: return "0x" + ("0" + code.toString(16)).slice(-2);
  }
}

// Payload size in bytes for common BTHome v2 objects, -1 if unknown
function objSize(id) {
  switch (id) {
    case 0x00: return 1; // packet id
    case 0x01: return 1; // battery
    case 0x02: return 2; // temperature
    case 0x03: return 2; // humidity
    case 0x05: return 3; // illuminance
    case 0x0c: return 2; // voltage
    case 0x21: return 1; // motion
    case 0x2d: return 1; // window
    case 0x2e: return 1; // humidity (uint8)
    case 0x3a: return 1; // button event
    case 0x3c: return 2; // dimmer
    case 0x3f: return 2; // rotation
    case 0x45: return 2; // temperature (0.1)
    case 0xf0: return 2; // device type id
    case 0xf1: return 4; // firmware version
    case 0xf2: return 3; // firmware version
    default: return -1;
  }
}

function parseBTHome(data) {
  if (typeof data !== "string" || data.length < 2) return null;

  let info = data.charCodeAt(0) & 0xff;
  if (((info >> 5) & 0x07) !== 2) return null; // not BTHome v2

  let result = { encrypted: (info & 0x01) === 1, packetId: null, battery: null, buttons: [] };
  if (result.encrypted) return result;

  let i = 1;
  while (i < data.length) {
    let id = data.charCodeAt(i) & 0xff;
    let size = objSize(id);
    if (size < 0 || i + 1 + size > data.length) break;

    let value = data.charCodeAt(i + 1) & 0xff;
    if (id === 0x00) result.packetId = value;
    if (id === 0x01) result.battery = value;
    if (id === 0x3a) result.buttons.push(value);

    i += 1 + size;
  }

  return result;
}

function onScanResult(ev, res) {
  if (ev !== BLE.Scanner.SCAN_RESULT || !res || typeof res.addr !== "string") return;
  if (!res.service_data || typeof res.service_data[BTHOME_UUID] !== "string") return;
  if (res.rssi < CONFIG.minRssi) return;

  let mac = res.addr.toLowerCase();
  let p = parseBTHome(res.service_data[BTHOME_UUID]);
  if (!p) return;

  if (p.encrypted) {
    if (!announced[mac + "_enc"]) {
      announced[mac + "_enc"] = true;
      print("ENCRYPTED BTHome device " + mac + " rssi=" + res.rssi + " (buttons cannot be read)");
    }
    return;
  }

  if (CONFIG.showAllBTHome && !announced[mac]) {
    announced[mac] = true;
    print("BTHome device " + mac + " rssi=" + res.rssi);
  }

  // Skip repeated advertisements of the same packet
  if (p.packetId !== null) {
    if (lastPacketId[mac] === p.packetId) return;
    if (lastPacketCount >= 50) {
      lastPacketId = {};
      lastPacketCount = 0;
    }
    if (lastPacketId[mac] === undefined) lastPacketCount++;
    lastPacketId[mac] = p.packetId;
  }

  for (let b = 0; b < p.buttons.length; b++) {
    if (p.buttons[b] === 0x00) continue;
    print("PRESS " + mac + " button " + (b + 1) + ": " + eventName(p.buttons[b]) +
      " rssi=" + res.rssi + (p.battery !== null ? " battery=" + p.battery + "%" : ""));
  }
}

function init() {
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

  print("Finder running. Press a button on the switch you want to find.");
}

init();