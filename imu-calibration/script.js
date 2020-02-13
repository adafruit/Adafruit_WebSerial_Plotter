// let the editor know that `Chart` is defined by some code
// included in another file (in this case, `index.html`)
// Note: the code will still work without this line, but without it you
// will see an error in the editor
/* global Chart */
/* global Graph */
/* global TransformStream */
/* global TextEncoderStream */
/* global TextDecoderStream */
'use strict';

let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

const maxLogLength = 500;

const colors = ['#0000FF', '#FF0000', '#009900', '#FF9900', '#CC00CC', '#666666', '#00CCFF', '#000000'];
let dataSets = [];
                 
const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];
const bufferSizes = [250, 500, 1000, 2500, 5000];
const log = document.getElementById('log');
const butConnect = document.getElementById('butConnect');
const butClear = document.getElementById('butClear');
const serCommand = document.getElementById('serCommand');
const butSend = document.getElementById('butSend');
const baudRate = document.getElementById('baudRate');
const autoscroll = document.getElementById('autoscroll');
const showTimestamp = document.getElementById('showTimestamp');
const plotType = document.getElementById('plotType');
const bufferSize = document.getElementById('bufferSize');
const lightSS = document.getElementById('light');
const darkSS = document.getElementById('dark');
const darkMode = document.getElementById('darkmode');
let graph;

document.addEventListener('DOMContentLoaded', () => {
  butConnect.addEventListener('click', clickConnect);
  butSend.addEventListener('click', clickSend);
  butClear.addEventListener('click', clickClear);
  plotType.addEventListener('change', changePlotType);
  autoscroll.addEventListener('click', clickAutoscroll);
  showTimestamp.addEventListener('click', clickTimestamp);
  baudRate.addEventListener('change', changeBaudRate);
  bufferSize.addEventListener('change', changeBufferSize);
  darkMode.addEventListener('click', clickDarkMode);

  if ('serial' in navigator) {
    const notSupported = document.getElementById('notSupported');
    notSupported.classList.add('hidden');
  }
  
  initBaudRate();
  initBufferSize();
  graph = new Graph(document.getElementById('myChart'));
  loadAllSettings();
  createChart();
});

// Update the label color only after CSS is finished
log.addEventListener('transitionend', function() {
  graph.updateLabelColor(window.getComputedStyle(log).color);
}, false);

/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.
 */
async function connect() {
  // - Request a port and open a connection.
  port = await navigator.serial.requestPort();
  // - Wait for the port to open.toggleUIConnected
  await port.open({ baudrate: baudRate.value });

  //const encoder = new TextEncoderStream();
  //outputDone = encoder.readable.pipeTo(port.writable);
  //outputStream = encoder.writable;

  let decoder = new TextDecoderStream();
  inputDone = port.readable.pipeTo(decoder.writable);
  inputStream = decoder.readable
    .pipeThrough(new TransformStream(new LineBreakTransformer()));
    //.pipeThrough(new TransformStream(new ObjectTransformer()));
  
  reader = inputStream.getReader();
  readLoop().catch(async function(error) {
    toggleUIConnected(false);
    await disconnect();
  });
}

/**
 * @name disconnect
 * Closes the Web Serial connection.
 */
async function disconnect() {
  if (reader) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;
  }

  if (outputStream) {
    await outputStream.getWriter().close();
    await outputDone;
    outputStream = null;
    outputDone = null;
  }
  
  await port.close();
  port = null;
}

/**
 * @name readLoop
 * Reads data from the input stream and displays it on screen.
 */
async function readLoop() {
  while (true) {
    const {value, done} = await reader.read();
    if (value) {
      let plotdata;
      if (value.substr(0, 4) == "Raw:") {
        const magnetometer = value.substr(4).trim().split(",").slice(-3).map(x=>+x);
        plotdata = {
          xy: [magnetometer[0], magnetometer[1]],
          yz: [magnetometer[1], magnetometer[2]],
          zx: [magnetometer[2], magnetometer[0]],
        }

        // Initialize the chart if we haven't already
        if (graph.adaChart.data.datasets.length < 1) {
          setupChart(plotdata);
        }
        addJSONValue(plotdata);
      }      
    }
    if (done) {
      console.log('[readLoop] DONE', done);
      reader.releaseLock();
      break;
    }
  }
}

function logData(line) {
  // Update the Log
  if (showTimestamp.checked) {
    let d = new Date();
    let timestamp = d.getHours() + ":" + `${d.getMinutes()}`.padStart(2, 0) + ":" +
        `${d.getSeconds()}`.padStart(2, 0) + "." + `${d.getMilliseconds()}`.padStart(3, 0);
    log.innerHTML += '<span class="timestamp">' + timestamp + ' -> </span>';
    d = null;
  }
  log.innerHTML += line+ "<br>";

  // Remove old log content
  if (log.textContent.split("\n").length > maxLogLength + 1) {
    let logLines = log.innerHTML.replace(/(\n)/gm, "").split("<br>");
    log.innerHTML = logLines.splice(-maxLogLength).join("<br>\n");
  }  
      
  if (autoscroll.checked) {
    log.scrollTop = log.scrollHeight
  }
}

let addJSONValue = function(value) {
  dataSets.forEach((dataSet, index) => {
    if (value[dataSet.field] != undefined) {
      graph.addValue(index, value[dataSet.field]);
    }
  });
}

let addCSVValue = function(value) {
  if (graph.plotType == 'xy') {
    graph.addValue(0, value.csvdata);
  } else {
    dataSets.forEach((dataSet, index) => {
      if (value.csvdata[dataSet.field] != undefined) {
        graph.addValue(index, value.csvdata[dataSet.field]);
      }
    });
  }
}

/**
 * @name updateTheme
 * Sets the theme to  Adafruit (dark) mode. Can be refactored later for more themes
 */
function updateTheme() {
  // Disable all themes
  document
    .querySelectorAll('link[rel=stylesheet].alternate')
    .forEach((styleSheet) => {
      enableStyleSheet(styleSheet, false);
    });
  
  if (darkMode.checked) {
    enableStyleSheet(darkSS, true);
  } else {
    enableStyleSheet(lightSS, true);
  }
}

function enableStyleSheet(node, enabled) {
  node.disabled = !enabled;
}

/**
 * @name writeToStream
 * Gets a writer from the output stream and send the lines to the serial device.
 * @param  {...string} lines lines to send to the serial device
 */
function writeToStream(...lines) {
  const writer = outputStream.getWriter();
  lines.forEach((line) => {
    console.log('[SEND]', line);
    writer.write(line + '\n');
  });
  writer.releaseLock();
}

/**
 * @name reset
 * Reset the Plotter, Log, and associated data
 */
async function reset() {
  // Clear the data
  dataSets = [];
  graph.reset();
  log.innerHTML = "";
}

/**
 * @name clickConnect
 * Click handler for the connect/disconnect button.
 */
async function clickConnect() {
  if (port) {
    await disconnect();
    toggleUIConnected(false);
    return;
  }

  await connect();

  reset();

  toggleUIConnected(true);
}

/**
 * @name clickSend
 * Click handler for the send button.
 */
async function clickSend() {
  let command = serCommand.value;
  serCommand.value = '';
  writeToStream(command);
}

/**
 * @name clickAutoscroll
 * Change handler for the Autoscroll checkbox.
 */
async function clickAutoscroll() {
  saveSetting('autoscroll', autoscroll.checked);
}

/**
 * @name clickTimestamp
 * Change handler for the Show Timestamp checkbox.
 */
async function clickTimestamp() {
  saveSetting('timestamp', showTimestamp.checked);
}

/**
 * @name changeBaudRate
 * Change handler for the Baud Rate selector.
 */
async function changeBaudRate() {
  saveSetting('baudrate', baudRate.value);
}

/**
 * @name changeBufferSize
 * Change handler for the Buffer Size selector.
 */
async function changeBufferSize() {
  saveSetting('buffersize', bufferSize.value);
  graph.setBufferSize(bufferSize.value);
}

/**
 * @name clickDarkMode
 * Change handler for the Dark Mode checkbox.
 */
async function clickDarkMode() {
  updateTheme();
  saveSetting('darkmode', darkMode.checked);
}

/**
 * @name changePlotType
 * Change handler for the Plot Type selector.
 */
async function changePlotType() {
  saveSetting('plottype', plotType.value);
  graph.setPlotType(plotType.value);
  reset();
  createChart();
}

/**
 * @name clickClear
 * Click handler for the clear button.
 */
async function clickClear() {
  reset();
}

/**
 * @name LineBreakTransformer
 * TransformStream to parse the stream into lines.
 */
class LineBreakTransformer {
  constructor() {
    // A container for holding stream data until a new line.
    this.container = '';
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\n');
    this.container = lines.pop();
    lines.forEach(line => {
      controller.enqueue(line)
      logData(line);
    });
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

/**
 * @name ObjectTransformer
 * TransformStream to parse the stream into a valid object.
 */
/*class ObjectTransformer { 
  transform(chunk, controller) {
    let plotdata;
    if (chunk.substr(0, 4) == "Raw:") {
      const magnetometer = chunk.substr(4).trim().split(",").slice(-3).map(x=>+x);
      plotdata = {
        xy: [magnetometer[0], magnetometer[1]],
        yz: [magnetometer[1], magnetometer[2]],
        zx: [magnetometer[2], magnetometer[0]],
      }
      controller.enqueue(plotdata);
    } else {
      controller.enqueue(null);
    }
  }
}*/

function convertJSON(chunk) {
  try {
    let jsonObj = JSON.parse(chunk);
    jsonObj._raw = chunk;
    return jsonObj;
  } catch (e) {
    return chunk;
  }
}

function toggleUIConnected(connected) {
  let lbl = 'Connect';
  if (connected) {
    lbl = 'Disconnect';
  }
  serCommand.disabled = !connected
  butSend.disabled = !connected
  butConnect.textContent = lbl;
}

function setupChart(value) {
  // Use the value as a template
  if (value.csvdata) {
    if (graph.plotType == "xt") {
      value.csvdata.forEach((item, index) => {
        dataSets.push({
          label: "",
          field: index,
          borderColor: colors[index % colors.length]
        });
      });
    } else {
      dataSets.push({
        label: "",
        field: 0,
        borderColor: colors[0]
      });
    }
  } else {
    Object.entries(value).forEach(([key, item], index) => {
      if (key != "_raw") {
        dataSets.push({
          label: key,
          field: key,
          borderColor: colors[index % colors.length]
        });
      }
    });
  }

  dataSets.forEach((dataSet) => {
    graph.addDataSet(dataSet.label, dataSet.borderColor);
  });
  
  graph.update();
}

function initBaudRate() {
  for (let rate of baudRates) {
    var option = document.createElement("option");
    option.text = rate + " Baud";
    option.value = rate;
    baudRate.add(option);
  }
}

function initBufferSize() {
  for (let size of bufferSizes) {
    var option = document.createElement("option");
    option.text = size + " Data Points";
    option.value = size;
    bufferSize.add(option);
  }
}

function loadAllSettings() {
  // Load all saved settings or defaults
  autoscroll.checked = loadSetting('autoscroll', true);
  showTimestamp.checked = loadSetting('timestamp', false);
  plotType.value = loadSetting('plottype', 'xy');
  graph.setPlotType(plotType.value);
  baudRate.value = loadSetting('baudrate', 9600);
  bufferSize.value = loadSetting('buffersize', 2500);
  graph.setBufferSize(bufferSize.value);
  darkMode.checked = loadSetting('darkmode', false);
}

function loadSetting(setting, defaultValue) {
  let value = JSON.parse(window.localStorage.getItem(setting));
  if (value == null) {
    return defaultValue;
  }
  
  return value;
}

function saveSetting(setting, value) {
  window.localStorage.setItem(setting, JSON.stringify(value));
}

function createChart() {
  graph.create();
  updateTheme();
}
