'use strict';

/**
 * @name connect
 * Opens a Web Serial connection to a micro:bit and sets up the input and
 * output stream.

*/

var WebSerial = function (obj) {
  let port;
  let reader;
  let inputDone;
  let outputDone;
  let inputStream;
  let outputStream;
  let addValue;
  
  const baudRates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];
  const bufferSizes = [250, 500, 1000, 2500, 5000];

  if (obj instanceof WebSerial) {
		return obj;
	}
	if (!(this instanceof WebSerial)) {
		return new WebSerial(obj);
	}
};

WebSerial.prototype = {
	connect: async function () {
		// - Request a port and open a connection.
    this.port = await navigator.serial.requestPort();
    // - Wait for the port to open.toggleUIConnected
    await this.port.open({ baudrate: this.baudrate });

    const encoder = new TextEncoderStream();
    this.outputDone = encoder.readable.pipeTo(this.port.writable);
    this.outputStream = encoder.writable;

    let decoder = new TextDecoderStream();
    this.inputDone = this.port.readable.pipeTo(decoder.writable);
    this.inputStream = decoder.readable
      .pipeThrough(new TransformStream(new LineBreakTransformer()))
      .pipeThrough(new TransformStream(new ObjectTransformer()));

    this.reader = inputStream.getReader();
    readLoop().catch((error) => {
      this.disconnect();
      toggleUIConnected(false);
    });

	},
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
    lines.forEach(line => controller.enqueue(line));
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

/**
 * @name ObjectTransformer
 * TransformStream to parse the stream into a valid object.
 */
class ObjectTransformer {
  transform(chunk, controller) {
    let jsobj = convertJSON(chunk)
    // Define the correct function ahead of time
    if (jsobj.raw === undefined) {
      jsobj = convertCSV(chunk)
      addValue = addCSVValue;
    } else {
      addValue = addJSONValue;
    }
    controller.enqueue(jsobj);
  }
}

