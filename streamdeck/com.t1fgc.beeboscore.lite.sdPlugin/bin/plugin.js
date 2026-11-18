"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module2.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module2.exports = Receiver;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    var { randomFillSync } = require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {Buffer[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module2.exports = Sender;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage2(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push2(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push2(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push2(params, header.slice(start, end), true);
            if (code === 44) {
              push2(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push2(params, paramName, value);
            if (code === 44) {
              push2(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push2(offers, token, params);
      } else {
        if (paramName === void 0) {
          push2(params, token, true);
        } else if (mustUnescape) {
          push2(params, paramName, token.replace(/\\/g, ""));
        } else {
          push2(params, paramName, token);
        }
        push2(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var https = require("https");
    var http2 = require("http");
    var net = require("net");
    var tls = require("tls");
    var { randomBytes, createHash } = require("crypto");
    var { Duplex, Readable } = require("stream");
    var { URL } = require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver = require_receiver();
    var Sender = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var closeTimeout = 30 * 1e3;
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      let chunk;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk = websocket._socket.read()) !== null) {
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream(ws2, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws2.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws2.pause();
      });
      ws2.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws2.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws2.readyState === ws2.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws2.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws2.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws2.terminate();
      };
      duplex._final = function(callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws2._socket === null) return;
        if (ws2._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws2._socket.once("finish", function finish() {
            callback();
          });
          ws2.close();
        }
      };
      duplex._read = function() {
        if (ws2.isPaused) ws2.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws2.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module2.exports = createWebSocketStream;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var http2 = require("http");
    var { Duplex } = require("stream");
    var { createHash } = require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 8 && version !== 13) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws2 = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws2._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          const params = extensions[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws2._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws2.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws2);
          ws2.on("close", () => {
            this.clients.delete(ws2);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws2, req);
      }
    };
    module2.exports = WebSocketServer;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message);
      }
    }
  }
});

// node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var WebSocket2 = require_websocket();
    WebSocket2.createWebSocketStream = require_stream();
    WebSocket2.Server = require_websocket_server();
    WebSocket2.Receiver = require_receiver();
    WebSocket2.Sender = require_sender();
    WebSocket2.WebSocket = WebSocket2;
    WebSocket2.WebSocketServer = WebSocket2.Server;
    module2.exports = WebSocket2;
  }
});

// src/designer-art.json
var require_designer_art = __commonJS({
  "src/designer-art.json"(exports2, module2) {
    module2.exports = { "g.plus1": '<g transform="translate(17 63.5)"><path d="M0.0,7.1Q0.0,0.0 7.1,0.0L42.9,0.0Q50.0,0.0 50.0,7.1L50.0,9.9Q50.0,17.0 42.9,17.0L7.1,17.0Q0.0,17.0 0.0,9.9Z" fill="#fffffe"/></g><g transform="translate(33.5 47)"><path d="M0.0,7.1Q0.0,0.0 7.1,0.0L9.9,0.0Q17.0,0.0 17.0,7.1L17.0,42.9Q17.0,50.0 9.9,50.0L7.1,50.0Q0.0,50.0 0.0,42.9Z" fill="#fffffe"/></g><g transform="translate(92.8 30)"><path d="M1.0,15.8Q0.0,11.8 3.8,10.0L21.4,1.8Q25.2,0.0 29.4,0.0L39.5,0.0Q43.7,0.0 43.7,4.2L43.7,79.8Q43.7,84.0 39.5,84.0L24.4,84.0Q20.2,84.0 20.2,79.8L20.2,29.4Q20.2,25.2 16.3,26.9L8.9,30.2Q5.0,31.9 4.0,27.8Z" fill="#fffffe"/></g>', "g.person": '<g transform="translate(48 24)"><path d="M48.0,24.0L47.8,26.7L47.4,29.3L46.7,31.9L45.6,34.4L44.3,36.8L42.8,39.0L41.0,41.0L39.0,42.8L36.8,44.3L34.4,45.6L31.9,46.7L29.3,47.4L26.7,47.8L24.0,48.0L21.3,47.8L18.7,47.4L16.1,46.7L13.6,45.6L11.2,44.3L9.0,42.8L7.0,41.0L5.2,39.0L3.7,36.8L2.4,34.4L1.3,31.9L0.6,29.3L0.2,26.7L0.0,24.0L0.2,21.3L0.6,18.7L1.3,16.1L2.4,13.6L3.7,11.2L5.2,9.0L7.0,7.0L9.0,5.2L11.2,3.7L13.6,2.4L16.1,1.3L18.7,0.6L21.3,0.2L24.0,0.0L26.7,0.2L29.3,0.6L31.9,1.3L34.4,2.4L36.8,3.7L39.0,5.2L41.0,7.0L42.8,9.0L44.3,11.2L45.6,13.6L46.7,16.1L47.4,18.7L47.8,21.3Z" fill="#fffffe"/></g><g transform="translate(30 80)"><path d="M11.2,38.0Q0.0,38.0 2.0,27.0L2.0,27.0Q4.0,16.0 11.9,8.1L12.0,8.0Q20.0,0.0 31.3,0.0L52.7,0.0Q64.0,0.0 72.0,8.0L72.1,8.1Q80.0,16.0 82.0,27.0L82.0,27.0Q84.0,38.0 72.8,38.0Z" fill="#fffffe"/></g>', "g.personPlus": '<g transform="translate(40 28)"><path d="M44.0,22.0L43.9,24.5L43.4,26.9L42.8,29.3L41.8,31.5L40.6,33.7L39.2,35.7L37.6,37.6L35.7,39.2L33.7,40.6L31.5,41.8L29.3,42.8L26.9,43.4L24.5,43.9L22.0,44.0L19.5,43.9L17.1,43.4L14.7,42.8L12.5,41.8L10.3,40.6L8.3,39.2L6.4,37.6L4.8,35.7L3.4,33.7L2.2,31.5L1.2,29.3L0.6,26.9L0.1,24.5L0.0,22.0L0.1,19.5L0.6,17.1L1.2,14.7L2.2,12.5L3.4,10.3L4.8,8.3L6.4,6.4L8.3,4.8L10.3,3.4L12.5,2.2L14.7,1.2L17.1,0.6L19.5,0.1L22.0,0.0L24.5,0.1L26.9,0.6L29.3,1.2L31.5,2.2L33.7,3.4L35.7,4.8L37.6,6.4L39.2,8.3L40.6,10.3L41.8,12.5L42.8,14.7L43.4,17.1L43.9,19.5Z" fill="#fffffe"/></g><g transform="translate(24 82)"><path d="M10.2,36.0Q0.0,36.0 2.0,26.0L2.0,26.0Q4.0,16.0 10.7,8.3L11.0,8.0Q18.0,0.0 28.6,0.0L47.4,0.0Q58.0,0.0 65.0,8.0L65.3,8.3Q72.0,16.0 74.0,26.0L74.0,26.0Q76.0,36.0 65.8,36.0Z" fill="#fffffe"/></g><g transform="translate(88 24)"><path d="M44.0,22.0L43.9,24.5L43.4,26.9L42.8,29.3L41.8,31.5L40.6,33.7L39.2,35.7L37.6,37.6L35.7,39.2L33.7,40.6L31.5,41.8L29.3,42.8L26.9,43.4L24.5,43.9L22.0,44.0L19.5,43.9L17.1,43.4L14.7,42.8L12.5,41.8L10.3,40.6L8.3,39.2L6.4,37.6L4.8,35.7L3.4,33.7L2.2,31.5L1.2,29.3L0.6,26.9L0.1,24.5L0.0,22.0L0.1,19.5L0.6,17.1L1.2,14.7L2.2,12.5L3.4,10.3L4.8,8.3L6.4,6.4L8.3,4.8L10.3,3.4L12.5,2.2L14.7,1.2L17.1,0.6L19.5,0.1L22.0,0.0L24.5,0.1L26.9,0.6L29.3,1.2L31.5,2.2L33.7,3.4L35.7,4.8L37.6,6.4L39.2,8.3L40.6,10.3L41.8,12.5L42.8,14.7L43.4,17.1L43.9,19.5Z" fill="#fffffd"/></g><g transform="translate(97 42)"><path d="M0.0,3.3Q0.0,0.0 3.3,0.0L22.7,0.0Q26.0,0.0 26.0,3.3L26.0,4.7Q26.0,8.0 22.7,8.0L3.3,8.0Q0.0,8.0 0.0,4.7Z" fill="#0e1017"/></g><g transform="translate(106 33)"><path d="M0.0,3.3Q0.0,0.0 3.3,0.0L4.7,0.0Q8.0,0.0 8.0,3.3L8.0,22.7Q8.0,26.0 4.7,26.0L3.3,26.0Q0.0,26.0 0.0,22.7Z" fill="#0e1017"/></g>', "g.swap": '<g transform="translate(23.5 43.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L76.5,0.0Q83.0,0.0 83.0,6.5L83.0,6.5Q83.0,13.0 76.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g><g transform="translate(88 31.4)"><path d="M26.9,16.7Q30.0,18.6 26.9,20.5L3.1,35.3Q0.0,37.2 0.0,33.6L0.0,3.6Q0.0,0.0 3.1,1.9Z" fill="#fffffe"/></g><g transform="translate(37.5 87.5) rotate(180 41.5 6.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L76.5,0.0Q83.0,0.0 83.0,6.5L83.0,6.5Q83.0,13.0 76.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g><g transform="translate(26 75.4)"><path d="M3.1,20.5Q0.0,18.6 3.1,16.7L26.9,1.9Q30.0,0.0 30.0,3.6L30.0,33.6Q30.0,37.2 26.9,35.3Z" fill="#fffffe"/></g>', "g.reset": '<g transform="translate(27.92 27.52)"><path d="M0.4,30.6L2.3,26.1L4.6,21.9L7.4,17.9L10.5,14.3L14.1,11.0L17.9,8.0L22.1,5.5L26.4,3.5L31.0,1.9L35.7,0.7L40.5,0.1L45.3,0.0L50.2,0.4L54.9,1.3L59.5,2.6L64.0,4.5L68.3,6.8L72.3,9.5L76.0,12.6L79.3,16.1L82.3,19.9L84.8,24.0L86.9,28.4L88.6,32.9L89.7,37.6L90.4,42.4L90.6,47.3L90.2,52.1L89.4,56.9L88.1,61.5L86.3,66.0L84.0,70.3L81.4,74.3L78.3,78.0L74.8,81.4L71.0,84.4L66.9,87.0L62.6,89.1L58.1,90.8L53.4,92.0L48.6,92.8L43.8,93.0L38.9,92.7L34.2,91.9L29.5,90.6L25.0,88.9L20.7,86.7L16.7,84.0L12.9,81.0L9.5,77.6L6.4,73.8L3.8,69.7L3.1,67.8L3.0,65.8L3.5,63.8L4.6,62.1L6.2,60.9L8.1,60.1L10.1,60.0L12.1,60.5L13.8,61.7L15.1,63.2L17.0,66.2L19.2,68.9L21.6,71.3L24.3,73.5L27.2,75.4L30.3,77.0L33.6,78.3L36.9,79.2L40.4,79.8L43.9,80.0L47.3,79.8L50.8,79.3L54.2,78.4L57.4,77.2L60.5,75.7L63.5,73.8L66.2,71.6L68.7,69.2L70.9,66.5L72.9,63.6L74.5,60.5L75.8,57.3L76.7,54.0L77.3,50.5L77.6,47.0L77.5,43.6L77.0,40.1L76.1,36.7L74.9,33.5L73.4,30.3L71.6,27.4L69.5,24.6L67.0,22.1L64.4,19.8L61.5,17.9L58.4,16.2L55.2,14.9L51.9,13.9L48.5,13.3L45.0,13.0L41.5,13.1L38.0,13.5L34.7,14.3L31.4,15.5L28.2,17.0L25.2,18.8L22.5,20.9L19.9,23.3L17.6,25.9L15.6,28.8L14.0,31.8L12.6,35.0L11.6,36.8L10.1,38.2L8.3,39.1L6.3,39.3L4.3,38.9L2.5,37.9L1.1,36.4L0.2,34.6L0.0,32.6Z" fill="#fffffe"/></g><g transform="translate(12.89 37.23)"><path d="M15.5,30.1Q13.1,32.8 11.8,29.4L1.3,3.3Q0.0,0.0 3.5,0.6L33.1,5.8Q36.6,6.5 34.2,9.1Z" fill="#fffffe"/></g>', "g.undo": '<g transform="translate(77.5 47.5)"><path d="M6.5,0.0L10.1,0.2L13.7,0.8L17.2,1.7L20.5,3.0L23.8,4.6L26.8,6.6L29.6,8.9L32.1,11.4L34.4,14.2L36.4,17.3L38.0,20.5L39.3,23.8L40.2,27.3L40.8,30.9L41.0,34.5L40.8,38.1L40.2,41.7L39.3,45.2L38.0,48.5L36.4,51.8L34.4,54.8L32.1,57.6L29.6,60.1L26.8,62.4L23.8,64.4L20.5,66.0L17.2,67.3L13.7,68.2L10.1,68.8L6.5,69.0L4.5,68.7L2.7,67.8L1.2,66.3L0.3,64.5L0.0,62.5L0.3,60.5L1.2,58.7L2.7,57.2L4.5,56.3L6.5,56.0L8.7,55.9L11.0,55.5L13.1,54.9L15.2,54.1L17.2,53.1L19.1,51.9L20.9,50.5L22.5,48.9L23.9,47.1L25.1,45.3L26.1,43.2L26.9,41.1L27.5,39.0L27.9,36.7L28.0,34.5L27.9,32.3L27.5,30.0L26.9,27.9L26.1,25.8L25.1,23.7L23.9,21.9L22.5,20.1L20.9,18.5L19.1,17.1L17.2,15.9L15.2,14.9L13.1,14.1L11.0,13.5L8.7,13.1L6.5,13.0L4.5,12.7L2.7,11.8L1.2,10.3L0.3,8.5L0.0,6.5L0.3,4.5L1.2,2.7L2.7,1.2L4.5,0.3Z" fill="#fffffe"/></g><g transform="translate(45.5 47.5) rotate(180 22.5 6.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L38.5,0.0Q45.0,0.0 45.0,6.5L45.0,6.5Q45.0,13.0 38.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g><g transform="translate(49.5 103.5) rotate(180 20.5 6.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L34.5,0.0Q41.0,0.0 41.0,6.5L41.0,6.5Q41.0,13.0 34.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g><g transform="translate(26 34.16)"><path d="M3.3,21.9Q0.0,19.8 3.3,17.8L28.7,2.0Q32.0,0.0 32.0,3.8L32.0,35.8Q32.0,39.7 28.7,37.7Z" fill="#fffffe"/></g>', "g.clear": '<g transform="translate(18.75 64) rotate(45 53.254833995939045 8)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L98.5,0.0Q106.5,0.0 106.5,8.0L106.5,8.0Q106.5,16.0 98.5,16.0L8.0,16.0Q0.0,16.0 0.0,8.0Z" fill="#fffffe"/></g><g transform="translate(18.75 64) rotate(135 53.254833995939045 8)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L98.5,0.0Q106.5,0.0 106.5,8.0L106.5,8.0Q106.5,16.0 98.5,16.0L8.0,16.0Q0.0,16.0 0.0,8.0Z" fill="#fffffe"/></g>', "g.nextSet": '<g transform="translate(24 34)" opacity="0.5"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L67.0,0.0Q74.0,0.0 74.0,7.0L74.0,15.0Q74.0,22.0 67.0,22.0L7.0,22.0Q0.0,22.0 0.0,15.0Z" fill="#fffffd"/></g><g transform="translate(24 70)" opacity="0.5"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L67.0,0.0Q74.0,0.0 74.0,7.0L74.0,15.0Q74.0,22.0 67.0,22.0L7.0,22.0Q0.0,22.0 0.0,15.0Z" fill="#fffffd"/></g><g transform="translate(78 26)"><path d="M20.6,5.8Q22.0,0.0 28.0,0.0L42.0,0.0Q48.0,0.0 46.6,5.8L27.4,86.2Q26.0,92.0 20.0,92.0L6.0,92.0Q0.0,92.0 1.4,86.2Z" fill="#fffffe"/></g>', "g.vs": '<g transform="translate(14 34)"><path d="M1.3,3.7Q0.0,0.0 4.0,0.0L18.5,0.0Q22.4,0.0 23.4,3.8L32.1,39.7Q33.0,43.6 33.9,39.7L42.6,3.8Q43.6,0.0 47.5,0.0L62.0,0.0Q66.0,0.0 64.7,3.7L44.8,62.3Q43.6,66.0 39.6,66.0L26.4,66.0Q22.4,66.0 21.2,62.3Z" fill="#fffffe"/></g><g transform="translate(85.88 30.52)"><path d="M35.7,9.6L34.6,7.9L33.4,6.4L32.0,5.0L30.5,3.7L28.8,2.7L27.1,1.7L25.3,1.0L23.4,0.5L21.4,0.1L19.5,0.0L17.5,0.1L15.6,0.3L13.6,0.8L11.8,1.5L10.0,2.3L8.3,3.3L6.8,4.5L5.3,5.9L4.0,7.3L2.9,9.0L2.0,10.7L1.2,12.5L0.6,14.4L0.2,16.3L0.0,18.2L0.0,20.2L0.2,22.2L0.6,24.1L1.4,25.7L2.6,27.1L4.2,28.0L5.9,28.4L7.7,28.2L9.4,27.5L10.7,26.2L11.6,24.7L12.0,22.9L11.8,21.1L11.7,20.3L11.6,19.6L11.6,18.8L11.7,18.0L11.8,17.3L12.1,16.5L12.4,15.8L12.7,15.1L13.2,14.5L13.7,13.9L14.3,13.4L14.9,12.9L15.5,12.5L16.2,12.2L17.0,11.9L17.7,11.7L18.5,11.6L19.3,11.6L20.0,11.7L20.8,11.8L21.5,12.0L22.3,12.3L22.9,12.6L23.6,13.1L24.2,13.6L24.7,14.1L25.2,14.7L25.6,15.4L26.8,16.8L28.3,17.8L30.1,18.2L31.9,18.1L33.6,17.5L35.0,16.3L36.0,14.8L36.4,13.1L36.3,11.3Z" fill="#fffffe"/></g><g transform="translate(87.68 67.1)"><path d="M0.7,18.8L1.8,20.5L3.0,22.0L4.4,23.4L6.0,24.6L7.6,25.7L9.3,26.6L11.2,27.4L13.1,27.9L15.0,28.2L17.0,28.4L18.9,28.3L20.9,28.1L22.8,27.6L24.6,26.9L26.4,26.1L28.1,25.1L29.7,23.9L31.1,22.5L32.4,21.0L33.5,19.4L34.5,17.7L35.3,15.9L35.9,14.0L36.2,12.1L36.4,10.1L36.4,8.2L36.2,6.2L35.8,4.3L35.1,2.6L33.9,1.3L32.3,0.4L30.5,0.0L28.7,0.2L27.0,0.9L25.7,2.1L24.8,3.7L24.4,5.5L24.6,7.3L24.8,8.1L24.8,8.8L24.9,9.6L24.8,10.4L24.6,11.1L24.4,11.9L24.1,12.6L23.7,13.3L23.3,13.9L22.8,14.5L22.2,15.0L21.6,15.5L20.9,15.9L20.2,16.2L19.5,16.5L18.7,16.7L18.0,16.8L17.2,16.8L16.4,16.7L15.6,16.6L14.9,16.4L14.2,16.1L13.5,15.7L12.8,15.3L12.2,14.8L11.7,14.3L11.2,13.7L10.8,13.0L9.6,11.6L8.1,10.6L6.4,10.1L4.6,10.2L2.9,10.9L1.5,12.0L0.5,13.6L0.0,15.3L0.1,17.1Z" fill="#fffffe"/></g><g transform="translate(87.13 57.2) rotate(35.21759296819273 17.869018187077195 5.800000000000001)"><path d="M0.0,5.8Q0.0,0.0 5.8,0.0L29.9,0.0Q35.7,0.0 35.7,5.8L35.7,5.8Q35.7,11.6 29.9,11.6L5.8,11.6Q0.0,11.6 0.0,5.8Z" fill="#fffffe"/></g>', "g.trophy": '<g transform="translate(40 24)"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L54.0,0.0Q64.0,0.0 64.0,10.0L64.0,12.0Q64.0,22.0 61.1,31.6L60.6,33.2Q58.0,42.0 51.0,48.0L51.0,48.0Q44.0,54.0 34.8,54.0L29.2,54.0Q20.0,54.0 13.0,48.0L13.0,48.0Q6.0,42.0 3.4,33.2L2.9,31.6Q0.0,22.0 0.0,12.0Z" fill="#fffffe"/></g><g transform="translate(19.5 25.5)"><path d="M20.5,41.0L18.4,40.9L16.2,40.6L14.2,40.0L12.2,39.2L10.3,38.3L8.5,37.1L6.8,35.7L5.3,34.2L3.9,32.5L2.7,30.8L1.8,28.8L1.0,26.8L0.4,24.8L0.1,22.6L0.0,20.5L0.1,18.4L0.4,16.2L1.0,14.2L1.8,12.2L2.7,10.3L3.9,8.5L5.3,6.8L6.8,5.3L8.5,3.9L10.3,2.7L12.2,1.8L14.2,1.0L16.2,0.4L18.4,0.1L20.5,0.0L21.9,0.2L23.1,0.9L24.1,1.9L24.8,3.1L25.0,4.5L24.8,5.9L24.1,7.1L23.1,8.1L21.9,8.8L20.5,9.0L19.3,9.1L18.1,9.3L16.9,9.6L15.8,10.0L14.8,10.5L13.7,11.2L12.8,12.0L12.0,12.8L11.2,13.7L10.5,14.8L10.0,15.8L9.6,16.9L9.3,18.1L9.1,19.3L9.0,20.5L9.1,21.7L9.3,22.9L9.6,24.1L10.0,25.2L10.5,26.2L11.2,27.3L12.0,28.2L12.8,29.0L13.7,29.8L14.8,30.5L15.8,31.0L16.9,31.4L18.1,31.7L19.3,31.9L20.5,32.0L21.9,32.2L23.1,32.9L24.1,33.9L24.8,35.1L25.0,36.5L24.8,37.9L24.1,39.1L23.1,40.1L21.9,40.8Z" fill="#fffffe"/></g><g transform="translate(99.5 25.5)"><path d="M4.5,0.0L6.6,0.1L8.8,0.4L10.8,1.0L12.8,1.8L14.8,2.7L16.5,3.9L18.2,5.3L19.7,6.8L21.1,8.5L22.3,10.3L23.2,12.2L24.0,14.2L24.6,16.2L24.9,18.4L25.0,20.5L24.9,22.6L24.6,24.8L24.0,26.8L23.2,28.8L22.3,30.8L21.1,32.5L19.7,34.2L18.2,35.7L16.5,37.1L14.8,38.3L12.8,39.2L10.8,40.0L8.8,40.6L6.6,40.9L4.5,41.0L3.1,40.8L1.9,40.1L0.9,39.1L0.2,37.9L0.0,36.5L0.2,35.1L0.9,33.9L1.9,32.9L3.1,32.2L4.5,32.0L5.7,31.9L6.9,31.7L8.1,31.4L9.2,31.0L10.3,30.5L11.3,29.8L12.2,29.0L13.0,28.2L13.8,27.3L14.5,26.2L15.0,25.2L15.4,24.1L15.7,22.9L15.9,21.7L16.0,20.5L15.9,19.3L15.7,18.1L15.4,16.9L15.0,15.8L14.5,14.8L13.8,13.7L13.0,12.8L12.2,12.0L11.3,11.2L10.3,10.5L9.2,10.0L8.1,9.6L6.9,9.3L5.7,9.1L4.5,9.0L3.1,8.8L1.9,8.1L0.9,7.1L0.2,5.9L0.0,4.5L0.2,3.1L0.9,1.9L1.9,0.9L3.1,0.2Z" fill="#fffffe"/></g><g transform="translate(64 76)"><path d="M0.0,0.0L16.0,0.0L16.0,18.0L0.0,18.0Z" fill="#fffffe"/></g><g transform="translate(46 94)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L47.0,0.0Q52.0,0.0 52.0,5.0L52.0,9.0Q52.0,14.0 47.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffe"/></g><g transform="translate(38 110)" opacity="0.5"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L63.0,0.0Q68.0,0.0 68.0,5.0L68.0,7.0Q68.0,12.0 63.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffd"/></g><g transform="translate(58.69 32)" opacity="0.55"><path d="M13.3,0.0L16.8,9.1L26.6,9.7L19.0,15.9L21.5,25.3L13.3,20.0L5.1,25.3L7.6,15.9L0.0,9.7L9.8,9.1Z" fill="#0e1017"/></g>', "g.cube3d": '<g transform="translate(28 22)"><path d="M39.6,2.4Q44.0,0.0 48.4,2.4L83.6,21.6Q88.0,24.0 83.6,26.4L48.4,45.6Q44.0,48.0 39.6,45.6L4.4,26.4Q0.0,24.0 4.4,21.6Z" fill="#fffffe"/></g><g transform="translate(28 52)" opacity="0.75"><path d="M0.0,5.0Q0.0,0.0 4.4,2.4L35.6,19.6Q40.0,22.0 40.0,27.0L40.0,65.0Q40.0,70.0 35.6,67.6L4.4,50.4Q0.0,48.0 0.0,43.0Z" fill="#fffffd"/></g><g transform="translate(76 52)" opacity="0.45"><path d="M40.0,5.0Q40.0,0.0 35.6,2.4L4.4,19.6Q0.0,22.0 0.0,27.0L0.0,65.0Q0.0,70.0 4.4,67.6L35.6,50.4Q40.0,48.0 40.0,43.0Z" fill="#fffffd"/></g>', "g.layout": '<g transform="translate(22 26)"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L93.0,0.0Q100.0,0.0 100.0,7.0L100.0,17.0Q100.0,24.0 93.0,24.0L7.0,24.0Q0.0,24.0 0.0,17.0Z" fill="#fffffe"/></g><g transform="translate(22 58)" opacity="0.8"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L39.0,0.0Q46.0,0.0 46.0,7.0L46.0,53.0Q46.0,60.0 39.0,60.0L7.0,60.0Q0.0,60.0 0.0,53.0Z" fill="#fffffd"/></g><g transform="translate(76 58)" opacity="0.55"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L39.0,0.0Q46.0,0.0 46.0,7.0L46.0,53.0Q46.0,60.0 39.0,60.0L7.0,60.0Q0.0,60.0 0.0,53.0Z" fill="#fffffd"/></g>', "g.screen": '<g transform="translate(18 26)"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L99.0,0.0Q108.0,0.0 108.0,9.0L108.0,63.0Q108.0,72.0 99.0,72.0L9.0,72.0Q0.0,72.0 0.0,63.0Z" fill="none" stroke="#fffffe" stroke-width="10" stroke-linejoin="round"/></g><g transform="translate(60 98)"><path d="M0.0,0.0L24.0,0.0L24.0,14.0L0.0,14.0Z" fill="#fffffe"/></g><g transform="translate(42 110)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L55.0,0.0Q60.0,0.0 60.0,5.0L60.0,5.0Q60.0,10.0 55.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffe"/></g><g transform="translate(52.98 42)" opacity="0.9"><path d="M19.0,0.0L24.3,12.7L38.0,13.8L27.6,22.8L30.8,36.2L19.0,29.0L7.3,36.2L10.5,22.8L0.0,13.8L13.7,12.7Z" fill="#fffffd"/></g>', "g.speaker": '<g transform="translate(22 30)"><path d="M0.0,32.0Q0.0,26.0 6.0,26.0L16.0,26.0Q22.0,26.0 26.4,21.9L45.6,4.1Q50.0,0.0 50.0,6.0L50.0,78.0Q50.0,84.0 45.6,79.9L26.4,62.1Q22.0,58.0 16.0,58.0L6.0,58.0Q0.0,58.0 0.0,52.0Z" fill="#fffffe"/></g><g transform="translate(87.15 50.16)"><path d="M8.2,1.2L10.2,3.0L12.1,5.1L13.7,7.4L15.0,9.8L16.1,12.3L17.0,15.0L17.5,17.7L17.8,20.5L17.8,23.2L17.5,26.0L17.0,28.7L16.1,31.3L15.0,33.9L13.7,36.3L12.1,38.6L10.2,40.6L8.2,42.5L6.9,43.3L5.3,43.7L3.8,43.5L2.3,42.9L1.2,41.9L0.4,40.6L0.0,39.0L0.1,37.5L0.7,36.0L1.8,34.9L3.1,33.7L4.2,32.4L5.2,30.9L6.1,29.4L6.8,27.8L7.3,26.2L7.6,24.4L7.8,22.7L7.8,21.0L7.6,19.2L7.3,17.5L6.8,15.9L6.1,14.3L5.2,12.7L4.2,11.3L3.1,10.0L1.8,8.8L0.7,7.6L0.1,6.2L0.0,4.6L0.4,3.1L1.2,1.8L2.3,0.7L3.8,0.1L5.3,0.0L6.9,0.4Z" fill="#fffffe"/></g><g transform="translate(104.17 35.95)" opacity="0.8"><path d="M8.5,1.4L11.9,5.2L14.9,9.4L17.5,13.8L19.6,18.5L21.2,23.4L22.2,28.4L22.8,33.5L22.8,38.6L22.2,43.7L21.2,48.7L19.6,53.6L17.5,58.3L14.9,62.7L11.9,66.9L8.5,70.7L7.2,71.6L5.7,72.1L4.2,72.1L2.7,71.6L1.4,70.7L0.5,69.4L0.0,67.9L0.0,66.4L0.5,64.9L1.4,63.6L4.1,60.6L6.5,57.3L8.6,53.8L10.2,50.0L11.5,46.1L12.3,42.2L12.8,38.1L12.8,34.0L12.3,29.9L11.5,26.0L10.2,22.1L8.6,18.3L6.5,14.8L4.1,11.5L1.4,8.5L0.5,7.2L0.0,5.7L0.0,4.2L0.5,2.7L1.4,1.4L2.7,0.5L4.2,0.0L5.7,0.0L7.2,0.5Z" fill="#fffffd"/></g>', "g.speakerOff": '<g transform="translate(22 30)"><path d="M0.0,32.0Q0.0,26.0 6.0,26.0L16.0,26.0Q22.0,26.0 26.4,21.9L45.6,4.1Q50.0,0.0 50.0,6.0L50.0,78.0Q50.0,84.0 45.6,79.9L26.4,62.1Q22.0,58.0 16.0,58.0L6.0,58.0Q0.0,58.0 0.0,52.0Z" fill="#fffffe"/></g><g transform="translate(78.07 66.5) rotate(50.19442890773481 28.930749027719965 5.5)"><path d="M0.0,5.5Q0.0,0.0 5.5,0.0L52.4,0.0Q57.9,0.0 57.9,5.5L57.9,5.5Q57.9,11.0 52.4,11.0L5.5,11.0Q0.0,11.0 0.0,5.5Z" fill="#fffffe"/></g><g transform="translate(78.07 66.5) rotate(129.8055710922652 28.930749027719965 5.5)"><path d="M0.0,5.5Q0.0,0.0 5.5,0.0L52.4,0.0Q57.9,0.0 57.9,5.5L57.9,5.5Q57.9,11.0 52.4,11.0L5.5,11.0Q0.0,11.0 0.0,5.5Z" fill="#fffffe"/></g>', "g.eye": '<g transform="translate(14 36)"><path d="M2.9,38.8Q0.0,36.0 2.9,33.2L2.9,33.2Q5.8,30.4 8.7,27.6L8.8,27.6Q11.6,24.9 14.5,22.3L14.6,22.2Q17.4,19.7 20.3,17.2L20.4,17.1Q23.2,14.8 26.1,12.7L26.2,12.6Q29.0,10.5 31.9,8.7L32.1,8.6Q34.8,6.9 37.7,5.4L37.8,5.3Q40.6,3.9 43.5,2.8L43.6,2.8Q46.4,1.8 49.3,1.1L49.4,1.1Q52.2,0.4 55.1,0.2L55.1,0.2Q58.0,0.0 60.9,0.2L60.9,0.2Q63.8,0.4 66.6,1.1L66.7,1.1Q69.6,1.8 72.4,2.8L72.5,2.8Q75.4,3.9 78.2,5.3L78.3,5.4Q81.2,6.9 83.9,8.6L84.1,8.7Q87.0,10.5 89.8,12.6L89.9,12.7Q92.8,14.8 95.6,17.1L95.7,17.2Q98.6,19.7 101.4,22.2L101.5,22.3Q104.4,24.9 107.2,27.6L107.3,27.6Q110.2,30.4 113.1,33.2L113.1,33.2Q116.0,36.0 113.1,38.8L113.1,38.8Q110.2,41.6 107.3,44.4L107.2,44.4Q104.4,47.1 101.5,49.7L101.4,49.8Q98.6,52.3 95.7,54.8L95.6,54.9Q92.8,57.2 89.9,59.3L89.8,59.4Q87.0,61.5 84.1,63.3L83.9,63.4Q81.2,65.1 78.3,66.6L78.2,66.7Q75.4,68.1 72.5,69.2L72.4,69.2Q69.6,70.2 66.7,70.9L66.6,70.9Q63.8,71.6 60.9,71.8L60.9,71.8Q58.0,72.0 55.1,71.8L55.1,71.8Q52.2,71.6 49.4,70.9L49.3,70.9Q46.4,70.2 43.6,69.2L43.5,69.2Q40.6,68.1 37.8,66.7L37.7,66.6Q34.8,65.1 32.1,63.4L31.9,63.3Q29.0,61.5 26.2,59.4L26.1,59.3Q23.2,57.2 20.4,54.9L20.3,54.8Q17.4,52.3 14.6,49.8L14.5,49.7Q11.6,47.1 8.8,44.4L8.7,44.4Q5.8,41.6 2.9,38.8Z" fill="none" stroke="#fffffe" stroke-width="10" stroke-linejoin="round"/></g><g transform="translate(52 52)"><path d="M40.0,20.0L39.9,22.2L39.5,24.5L38.9,26.6L38.0,28.7L36.9,30.6L35.6,32.5L34.1,34.1L32.5,35.6L30.6,36.9L28.7,38.0L26.6,38.9L24.5,39.5L22.2,39.9L20.0,40.0L17.8,39.9L15.5,39.5L13.4,38.9L11.3,38.0L9.4,36.9L7.5,35.6L5.9,34.1L4.4,32.5L3.1,30.6L2.0,28.7L1.1,26.6L0.5,24.5L0.1,22.2L0.0,20.0L0.1,17.8L0.5,15.5L1.1,13.4L2.0,11.3L3.1,9.4L4.4,7.5L5.9,5.9L7.5,4.4L9.4,3.1L11.3,2.0L13.4,1.1L15.5,0.5L17.8,0.1L20.0,0.0L22.2,0.1L24.5,0.5L26.6,1.1L28.7,2.0L30.6,3.1L32.5,4.4L34.1,5.9L35.6,7.5L36.9,9.4L38.0,11.3L38.9,13.4L39.5,15.5L39.9,17.8Z" fill="#fffffe"/></g><g transform="translate(74 58)" opacity="0.6"><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="#0e1017"/></g>', "g.next": '<g transform="translate(28 30)"><path d="M0.0,10.0Q0.0,0.0 8.2,5.7L51.8,36.3Q60.0,42.0 51.8,47.7L8.2,78.3Q0.0,84.0 0.0,74.0Z" fill="#fffffe"/></g><g transform="translate(94 30)"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L13.0,0.0Q20.0,0.0 20.0,7.0L20.0,77.0Q20.0,84.0 13.0,84.0L7.0,84.0Q0.0,84.0 0.0,77.0Z" fill="#fffffe"/></g>', "g.bracket": '<g transform="translate(17.5 23.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 49.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(34.5 36.5) rotate(90 17.5 4.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L30.5,0.0Q35.0,0.0 35.0,4.5L35.0,4.5Q35.0,9.0 30.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 77.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 103.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(34.5 90.5) rotate(90 17.5 4.5)" opacity="0.8"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L30.5,0.0Q35.0,0.0 35.0,4.5L35.0,4.5Q35.0,9.0 30.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(47.5 36.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L22.5,0.0Q27.0,0.0 27.0,4.5L27.0,4.5Q27.0,9.0 22.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(47.5 90.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L22.5,0.0Q27.0,0.0 27.0,4.5L27.0,4.5Q27.0,9.0 22.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(38.5 63.5) rotate(90 31.5 4.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L58.5,0.0Q63.0,0.0 63.0,4.5L63.0,4.5Q63.0,9.0 58.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(65.5 63.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L18.5,0.0Q23.0,0.0 23.0,4.5L23.0,4.5Q23.0,9.0 18.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(90 46)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L30.0,0.0Q36.0,0.0 36.0,6.0L36.0,6.0Q36.0,12.0 33.3,17.4L30.7,22.6Q28.0,28.0 22.0,28.0L14.0,28.0Q8.0,28.0 5.3,22.6L2.7,17.4Q0.0,12.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(103 74)"><path d="M0.0,0.0L10.0,0.0L10.0,10.0L0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(94 84)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L25.0,0.0Q28.0,0.0 28.0,3.0L28.0,5.0Q28.0,8.0 25.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffe"/></g>', "g.top8": '<g transform="translate(56 10)" opacity="0.55"><path d="M44.0,0.0Q40.0,0.0 38.0,3.5L8.0,56.5Q6.0,60.0 10.0,60.0L20.0,60.0Q24.0,60.0 22.6,63.7L1.4,120.3Q0.0,124.0 2.4,120.8L57.6,49.2Q60.0,46.0 56.0,46.0L44.0,46.0Q40.0,46.0 41.7,42.4L60.3,3.6Q62.0,0.0 58.0,0.0Z" fill="#fffffd"/></g><g transform="translate(60.36 33.36)"><path d="M31.3,15.6L31.2,17.4L30.9,19.1L30.4,20.8L29.7,22.4L28.9,24.0L27.9,25.4L26.7,26.7L25.4,27.9L24.0,28.9L22.4,29.7L20.8,30.4L19.1,30.9L17.4,31.2L15.6,31.3L13.9,31.2L12.2,30.9L10.5,30.4L8.9,29.7L7.3,28.9L5.9,27.9L4.6,26.7L3.4,25.4L2.4,24.0L1.5,22.4L0.9,20.8L0.4,19.1L0.1,17.4L0.0,15.6L0.1,13.9L0.4,12.2L0.9,10.5L1.5,8.9L2.4,7.3L3.4,5.9L4.6,4.6L5.9,3.4L7.3,2.4L8.9,1.5L10.5,0.9L12.2,0.4L13.9,0.1L15.6,0.0L17.4,0.1L19.1,0.4L20.8,0.9L22.4,1.5L24.0,2.4L25.4,3.4L26.7,4.6L27.9,5.9L28.9,7.3L29.7,8.9L30.4,10.5L30.9,12.2L31.2,13.9Z" fill="none" stroke="#fffffe" stroke-width="11.04" stroke-linejoin="round"/></g><g transform="translate(55.76 69.24)"><path d="M40.5,20.2L40.4,22.5L40.0,24.7L39.3,26.9L38.5,29.0L37.4,31.0L36.1,32.9L34.6,34.6L32.9,36.1L31.0,37.4L29.0,38.5L26.9,39.3L24.7,40.0L22.5,40.4L20.2,40.5L18.0,40.4L15.7,40.0L13.6,39.3L11.5,38.5L9.5,37.4L7.6,36.1L5.9,34.6L4.4,32.9L3.1,31.0L2.0,29.0L1.1,26.9L0.5,24.7L0.1,22.5L0.0,20.2L0.1,18.0L0.5,15.7L1.1,13.6L2.0,11.5L3.1,9.5L4.4,7.6L5.9,5.9L7.6,4.4L9.5,3.1L11.5,2.0L13.6,1.1L15.7,0.5L18.0,0.1L20.2,0.0L22.5,0.1L24.7,0.5L26.9,1.1L29.0,2.0L31.0,3.1L32.9,4.4L34.6,5.9L36.1,7.6L37.4,9.5L38.5,11.5L39.3,13.6L40.0,15.7L40.4,18.0Z" fill="none" stroke="#fffffe" stroke-width="11.96" stroke-linejoin="round"/></g>', "g.podium": '<g transform="translate(52 40)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L34.0,0.0Q40.0,0.0 40.0,6.0L40.0,76.0Q40.0,82.0 34.0,82.0L6.0,82.0Q0.0,82.0 0.0,76.0Z" fill="#fffffe"/></g><g transform="translate(12 66)" opacity="0.8"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L34.0,0.0Q40.0,0.0 40.0,6.0L40.0,50.0Q40.0,56.0 34.0,56.0L6.0,56.0Q0.0,56.0 0.0,50.0Z" fill="#fffffd"/></g><g transform="translate(92 80)" opacity="0.6"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L34.0,0.0Q40.0,0.0 40.0,6.0L40.0,36.0Q40.0,42.0 34.0,42.0L6.0,42.0Q0.0,42.0 0.0,36.0Z" fill="#fffffd"/></g><g transform="translate(58.69 8)"><path d="M13.3,0.0L16.8,9.1L26.6,9.7L19.0,15.9L21.5,25.3L13.3,20.0L5.1,25.3L7.6,15.9L0.0,9.7L9.8,9.1Z" fill="#fffffe"/></g>', "g.sides": '<g transform="translate(10 28)"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L48.0,0.0Q58.0,0.0 58.0,10.0L58.0,78.0Q58.0,88.0 48.0,88.0L10.0,88.0Q0.0,88.0 0.0,78.0Z" fill="#fffffe"/></g><g transform="translate(76 28)"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L48.0,0.0Q58.0,0.0 58.0,10.0L58.0,78.0Q58.0,88.0 48.0,88.0L10.0,88.0Q0.0,88.0 0.0,78.0Z" fill="none" stroke="#fffffe" stroke-width="6" stroke-linejoin="round"/></g><g transform="translate(18 54)"><path d="M0.3,1.6Q0.0,0.0 1.7,0.0L7.6,0.0Q9.2,0.0 9.5,1.7L13.2,23.5Q13.4,25.2 13.8,23.6L17.2,10.0Q17.6,8.4 19.3,8.4L22.7,8.4Q24.4,8.4 24.8,10.0L28.2,23.6Q28.6,25.2 28.8,23.5L32.5,1.7Q32.8,0.0 34.4,0.0L40.3,0.0Q42.0,0.0 41.7,1.6L33.9,40.4Q33.6,42.0 31.9,42.0L26.9,42.0Q25.2,42.0 24.8,40.4L21.4,24.7Q21.0,23.1 20.6,24.7L17.2,40.4Q16.8,42.0 15.1,42.0L10.1,42.0Q8.4,42.0 8.1,40.4Z" fill="#0e1017"/></g><g transform="translate(91.7 54)"><path d="M0.0,1.9Q0.0,0.0 1.9,0.0L8.4,0.0Q10.3,0.0 10.3,1.9L10.3,27.0Q10.3,28.9 12.2,28.9L24.7,28.9Q26.6,28.9 26.6,30.8L26.6,36.1Q26.6,38.0 24.7,38.0L1.9,38.0Q0.0,38.0 0.0,36.1Z" fill="#fffffe"/></g>', "g.pull": '<g transform="translate(39 37) rotate(90 33 7)"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L59.0,0.0Q66.0,0.0 66.0,7.0L66.0,7.0Q66.0,14.0 59.0,14.0L7.0,14.0Q0.0,14.0 0.0,7.0Z" fill="#fffffe"/></g><g transform="translate(49.68 60)"><path d="M24.6,32.3Q22.3,36.0 20.0,32.3L2.3,3.7Q0.0,0.0 4.3,0.0L40.3,0.0Q44.6,0.0 42.4,3.7Z" fill="#fffffe"/></g><g transform="translate(20 90)" opacity="0.85"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L7.0,0.0Q14.0,0.0 14.0,7.0L14.0,11.0Q14.0,18.0 21.0,18.0L83.0,18.0Q90.0,18.0 90.0,11.0L90.0,7.0Q90.0,0.0 97.0,0.0L97.0,0.0Q104.0,0.0 104.0,7.0L104.0,27.0Q104.0,34.0 97.0,34.0L7.0,34.0Q0.0,34.0 0.0,27.0Z" fill="#fffffd"/></g>', "g.upload": '<g transform="translate(40 64) rotate(-90 32 7)"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L57.0,0.0Q64.0,0.0 64.0,7.0L64.0,7.0Q64.0,14.0 57.0,14.0L7.0,14.0Q0.0,14.0 0.0,7.0Z" fill="#fffffe"/></g><g transform="translate(49.68 18)"><path d="M20.0,3.7Q22.3,0.0 24.6,3.7L42.4,32.3Q44.6,36.0 40.3,36.0L4.3,36.0Q0.0,36.0 2.3,32.3Z" fill="#fffffe"/></g><g transform="translate(20 84)" opacity="0.85"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L7.0,0.0Q14.0,0.0 14.0,7.0L14.0,15.0Q14.0,22.0 21.0,22.0L83.0,22.0Q90.0,22.0 90.0,15.0L90.0,7.0Q90.0,0.0 97.0,0.0L97.0,0.0Q104.0,0.0 104.0,7.0L104.0,31.0Q104.0,38.0 97.0,38.0L7.0,38.0Q0.0,38.0 0.0,31.0Z" fill="#fffffd"/></g>', "g.chatLink": '<g transform="translate(14 26)" opacity="0.9"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L104.0,0.0Q116.0,0.0 116.0,12.0L116.0,58.0Q116.0,70.0 104.0,70.0L60.0,70.0Q48.0,70.0 38.8,77.8L30.5,84.8Q22.0,92.0 24.0,81.0L24.0,81.0Q26.0,70.0 14.8,70.0L12.0,70.0Q0.0,70.0 0.0,58.0Z" fill="#fffffd"/></g><g transform="translate(44 47)" opacity="0.9"><path d="M28.0,14.0L27.9,15.6L27.6,17.1L27.2,18.6L26.6,20.1L25.9,21.4L24.9,22.7L23.9,23.9L22.7,24.9L21.4,25.9L20.1,26.6L18.6,27.2L17.1,27.6L15.6,27.9L14.0,28.0L12.4,27.9L10.9,27.6L9.4,27.2L7.9,26.6L6.6,25.9L5.3,24.9L4.1,23.9L3.1,22.7L2.1,21.4L1.4,20.1L0.8,18.6L0.4,17.1L0.1,15.6L0.0,14.0L0.1,12.4L0.4,10.9L0.8,9.4L1.4,7.9L2.1,6.6L3.1,5.3L4.1,4.1L5.3,3.1L6.6,2.1L7.9,1.4L9.4,0.8L10.9,0.4L12.4,0.1L14.0,0.0L15.6,0.1L17.1,0.4L18.6,0.8L20.1,1.4L21.4,2.1L22.7,3.1L23.9,4.1L24.9,5.3L25.9,6.6L26.6,7.9L27.2,9.4L27.6,10.9L27.9,12.4Z" fill="none" stroke="#0e1017" stroke-width="8" stroke-linejoin="round"/></g><g transform="translate(72 47)" opacity="0.9"><path d="M28.0,14.0L27.9,15.6L27.6,17.1L27.2,18.6L26.6,20.1L25.9,21.4L24.9,22.7L23.9,23.9L22.7,24.9L21.4,25.9L20.1,26.6L18.6,27.2L17.1,27.6L15.6,27.9L14.0,28.0L12.4,27.9L10.9,27.6L9.4,27.2L7.9,26.6L6.6,25.9L5.3,24.9L4.1,23.9L3.1,22.7L2.1,21.4L1.4,20.1L0.8,18.6L0.4,17.1L0.1,15.6L0.0,14.0L0.1,12.4L0.4,10.9L0.8,9.4L1.4,7.9L2.1,6.6L3.1,5.3L4.1,4.1L5.3,3.1L6.6,2.1L7.9,1.4L9.4,0.8L10.9,0.4L12.4,0.1L14.0,0.0L15.6,0.1L17.1,0.4L18.6,0.8L20.1,1.4L21.4,2.1L22.7,3.1L23.9,4.1L24.9,5.3L25.9,6.6L26.6,7.9L27.2,9.4L27.6,10.9L27.9,12.4Z" fill="none" stroke="#0e1017" stroke-width="8" stroke-linejoin="round"/></g><g transform="translate(54 57)" opacity="0.9"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L32.0,0.0Q36.0,0.0 36.0,4.0L36.0,4.0Q36.0,8.0 32.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#0e1017"/></g>', "g.loser": '<g transform="translate(18 24)" opacity="0.8"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L24.0,0.0Q28.0,0.0 28.0,4.0L28.0,10.0Q28.0,14.0 24.0,14.0L20.0,14.0Q16.0,14.0 16.0,18.0L16.0,78.0Q16.0,82.0 20.0,82.0L24.0,82.0Q28.0,82.0 28.0,86.0L28.0,92.0Q28.0,96.0 24.0,96.0L4.0,96.0Q0.0,96.0 0.0,92.0Z" fill="#fffffd"/></g><g transform="translate(98 24)" opacity="0.8"><path d="M28.0,4.0Q28.0,0.0 24.0,0.0L4.0,0.0Q0.0,0.0 0.0,4.0L0.0,10.0Q0.0,14.0 4.0,14.0L8.0,14.0Q12.0,14.0 12.0,18.0L12.0,78.0Q12.0,82.0 8.0,82.0L4.0,82.0Q0.0,82.0 0.0,86.0L0.0,92.0Q0.0,96.0 4.0,96.0L24.0,96.0Q28.0,96.0 28.0,92.0Z" fill="#fffffd"/></g><g transform="translate(54.4 38)"><path d="M0.0,2.8Q0.0,0.0 2.8,0.0L12.3,0.0Q15.1,0.0 15.1,2.8L15.1,39.8Q15.1,42.6 17.9,42.6L36.4,42.6Q39.2,42.6 39.2,45.4L39.2,53.2Q39.2,56.0 36.4,56.0L2.8,56.0Q0.0,56.0 0.0,53.2Z" fill="#fffffe"/></g>', "g.confirm": '<g transform="translate(20 30)"><path d="M84.0,42.0L83.7,46.7L82.9,51.3L81.6,55.9L79.8,60.2L77.6,64.3L74.8,68.2L71.7,71.7L68.2,74.8L64.3,77.6L60.2,79.8L55.9,81.6L51.3,82.9L46.7,83.7L42.0,84.0L37.3,83.7L32.7,82.9L28.1,81.6L23.8,79.8L19.7,77.6L15.8,74.8L12.3,71.7L9.2,68.2L6.4,64.3L4.2,60.2L2.4,55.9L1.1,51.3L0.3,46.7L0.0,42.0L0.3,37.3L1.1,32.7L2.4,28.1L4.2,23.8L6.4,19.7L9.2,15.8L12.3,12.3L15.8,9.2L19.7,6.4L23.8,4.2L28.1,2.4L32.7,1.1L37.3,0.3L42.0,0.0L46.7,0.3L51.3,1.1L55.9,2.4L60.2,4.2L64.3,6.4L68.2,9.2L71.7,12.3L74.8,15.8L77.6,19.7L79.8,23.8L81.6,28.1L82.9,32.7L83.7,37.3Z" fill="none" stroke="#fffffe" stroke-width="11" stroke-linejoin="round"/></g><g transform="translate(32 54)"><path d="M5.9,20.1Q8.0,18.0 10.1,20.1L19.9,29.9Q22.0,32.0 24.1,29.8L49.9,2.2Q52.0,0.0 54.1,2.1L57.9,5.9Q60.0,8.0 57.9,10.1L24.1,43.9Q22.0,46.0 19.8,44.0L2.2,28.0Q0.0,26.0 2.1,23.9Z" fill="#fffffe"/></g><g transform="translate(106 55.88)" opacity="0.85"><path d="M23.3,14.5Q26.0,16.1 23.3,17.8L2.7,30.6Q0.0,32.2 0.0,29.1L0.0,3.1Q0.0,0.0 2.7,1.6Z" fill="#fffffd"/></g>', "g.swords": '<g transform="translate(5.59 56.5) rotate(45 56.41168824543143 5.5)"><path d="M0.0,5.5Q0.0,0.0 5.5,0.0L107.3,0.0Q112.8,0.0 112.8,5.5L112.8,5.5Q112.8,11.0 107.3,11.0L5.5,11.0Q0.0,11.0 0.0,5.5Z" fill="#fffffe"/></g><g transform="translate(25.59 56.5) rotate(135 56.41168824543143 5.5)"><path d="M0.0,5.5Q0.0,0.0 5.5,0.0L107.3,0.0Q112.8,0.0 112.8,5.5L112.8,5.5Q112.8,11.0 107.3,11.0L5.5,11.0Q0.0,11.0 0.0,5.5Z" fill="#fffffe"/></g><g transform="translate(68.37 91) rotate(-45 27.627416997969522 5)" opacity="0.85"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L50.3,0.0Q55.3,0.0 55.3,5.0L55.3,5.0Q55.3,10.0 50.3,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(20.37 91) rotate(-135 27.627416997969522 5)" opacity="0.85"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L50.3,0.0Q55.3,0.0 55.3,5.0L55.3,5.0Q55.3,10.0 50.3,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(103 103)"><path d="M18.0,9.0L17.9,10.0L17.8,11.0L17.5,12.0L17.1,12.9L16.6,13.8L16.0,14.6L15.4,15.4L14.6,16.0L13.8,16.6L12.9,17.1L12.0,17.5L11.0,17.8L10.0,17.9L9.0,18.0L8.0,17.9L7.0,17.8L6.0,17.5L5.1,17.1L4.2,16.6L3.4,16.0L2.6,15.4L2.0,14.6L1.4,13.8L0.9,12.9L0.5,12.0L0.2,11.0L0.1,10.0L0.0,9.0L0.1,8.0L0.2,7.0L0.5,6.0L0.9,5.1L1.4,4.2L2.0,3.4L2.6,2.6L3.4,2.0L4.2,1.4L5.1,0.9L6.0,0.5L7.0,0.2L8.0,0.1L9.0,0.0L10.0,0.1L11.0,0.2L12.0,0.5L12.9,0.9L13.8,1.4L14.6,2.0L15.4,2.6L16.0,3.4L16.6,4.2L17.1,5.1L17.5,6.0L17.8,7.0L17.9,8.0Z" fill="#fffffe"/></g><g transform="translate(23 103)"><path d="M18.0,9.0L17.9,10.0L17.8,11.0L17.5,12.0L17.1,12.9L16.6,13.8L16.0,14.6L15.4,15.4L14.6,16.0L13.8,16.6L12.9,17.1L12.0,17.5L11.0,17.8L10.0,17.9L9.0,18.0L8.0,17.9L7.0,17.8L6.0,17.5L5.1,17.1L4.2,16.6L3.4,16.0L2.6,15.4L2.0,14.6L1.4,13.8L0.9,12.9L0.5,12.0L0.2,11.0L0.1,10.0L0.0,9.0L0.1,8.0L0.2,7.0L0.5,6.0L0.9,5.1L1.4,4.2L2.0,3.4L2.6,2.6L3.4,2.0L4.2,1.4L5.1,0.9L6.0,0.5L7.0,0.2L8.0,0.1L9.0,0.0L10.0,0.1L11.0,0.2L12.0,0.5L12.9,0.9L13.8,1.4L14.6,2.0L15.4,2.6L16.0,3.4L16.6,4.2L17.1,5.1L17.5,6.0L17.8,7.0L17.9,8.0Z" fill="#fffffe"/></g>', "g.board": '<g transform="translate(22 30)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,10.0Q100.0,18.0 92.0,18.0L8.0,18.0Q0.0,18.0 0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(22 62)" opacity="0.8"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,10.0Q100.0,18.0 92.0,18.0L8.0,18.0Q0.0,18.0 0.0,10.0Z" fill="#fffffd"/></g><g transform="translate(22 94)" opacity="0.6"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,10.0Q100.0,18.0 92.0,18.0L8.0,18.0Q0.0,18.0 0.0,10.0Z" fill="#fffffd"/></g>', "g.crown": '<g transform="translate(20 30)"><path d="M1.3,22.9Q0.0,16.0 5.1,20.7L20.9,35.3Q26.0,40.0 29.8,34.1L48.2,5.9Q52.0,0.0 55.8,5.9L74.2,34.1Q78.0,40.0 83.1,35.3L98.9,20.7Q104.0,16.0 102.7,22.9L93.3,71.1Q92.0,78.0 85.0,78.0L19.0,78.0Q12.0,78.0 10.7,71.1Z" fill="#fffffe"/></g><g transform="translate(30 112)" opacity="0.8"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L79.0,0.0Q84.0,0.0 84.0,5.0L84.0,7.0Q84.0,12.0 79.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffd"/></g><g transform="translate(64 22)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g><g transform="translate(13 39)"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#fffffe"/></g><g transform="translate(117 39)"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#fffffe"/></g>', "g.formatBar": '<g transform="translate(14 20)" opacity="0.7"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L106.0,0.0Q116.0,0.0 116.0,10.0L116.0,74.0Q116.0,84.0 106.0,84.0L10.0,84.0Q0.0,84.0 0.0,74.0Z" fill="none" stroke="#fffffd" stroke-width="7" stroke-linejoin="round"/></g><g transform="translate(24 80)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L91.0,0.0Q96.0,0.0 96.0,5.0L96.0,11.0Q96.0,16.0 91.0,16.0L5.0,16.0Q0.0,16.0 0.0,11.0Z" fill="#fffffe"/></g><g transform="translate(32 58)" opacity="0.8"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffd"/></g><g transform="translate(54 58)" opacity="0.8"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffd"/></g><g transform="translate(76 58)" opacity="0.8"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffd"/></g><g transform="translate(98 58)" opacity="0.8"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffd"/></g><g transform="translate(58 104)" opacity="0.5"><path d="M0.0,0.0L28.0,0.0L28.0,10.0L0.0,10.0Z" fill="#fffffd"/></g><g transform="translate(40 112)" opacity="0.5"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L60.0,0.0Q64.0,0.0 64.0,4.0L64.0,4.0Q64.0,8.0 60.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g>', "g.switchArrows": '<g transform="translate(27.5 41.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L68.5,0.0Q75.0,0.0 75.0,6.5L75.0,6.5Q75.0,13.0 68.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g><g transform="translate(90 30.64)"><path d="M25.1,15.6Q28.0,17.4 25.1,19.1L2.9,32.9Q0.0,34.7 0.0,31.4L0.0,3.4Q0.0,0.0 2.9,1.8Z" fill="#fffffe"/></g><g transform="translate(41.5 89.5) rotate(180 37.5 6.5)" opacity="0.9"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L68.5,0.0Q75.0,0.0 75.0,6.5L75.0,6.5Q75.0,13.0 68.5,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffd"/></g><g transform="translate(26 78.64)" opacity="0.9"><path d="M2.9,19.1Q0.0,17.4 2.9,15.6L25.1,1.8Q28.0,0.0 28.0,3.4L28.0,31.4Q28.0,34.7 25.1,32.9Z" fill="#fffffd"/></g>', "g.lock": '<g transform="translate(47 33)"><path d="M0.0,25.0L0.1,22.4L0.5,19.8L1.2,17.3L2.2,14.8L3.3,12.5L4.8,10.3L6.4,8.3L8.3,6.4L10.3,4.8L12.5,3.3L14.8,2.2L17.3,1.2L19.8,0.5L22.4,0.1L25.0,0.0L27.6,0.1L30.2,0.5L32.7,1.2L35.2,2.2L37.5,3.3L39.7,4.8L41.7,6.4L43.6,8.3L45.2,10.3L46.7,12.5L47.8,14.8L48.8,17.3L49.5,19.8L49.9,22.4L50.0,25.0L40.0,25.0L39.9,23.4L39.7,21.9L39.3,20.4L38.7,18.9L38.0,17.5L37.1,16.2L36.1,15.0L35.0,13.9L33.8,12.9L32.5,12.0L31.1,11.3L29.6,10.7L28.1,10.3L26.6,10.1L25.0,10.0L23.4,10.1L21.9,10.3L20.4,10.7L18.9,11.3L17.5,12.0L16.2,12.9L15.0,13.9L13.9,15.0L12.9,16.2L12.0,17.5L11.3,18.9L10.7,20.4L10.3,21.9L10.1,23.4L10.0,25.0Z" fill="#fffffe"/></g><g transform="translate(44 58)"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L47.0,0.0Q56.0,0.0 56.0,9.0L56.0,37.0Q56.0,46.0 47.0,46.0L9.0,46.0Q0.0,46.0 0.0,37.0Z" fill="#fffffe"/></g><g transform="translate(65 71)" opacity="0.7"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#0e1017"/></g>', "g.ticket": '<g transform="translate(14 34)" opacity="0.9"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L108.0,0.0Q116.0,0.0 116.0,8.0L116.0,19.0Q116.0,24.0 112.0,27.0L112.0,27.0Q108.0,30.0 108.0,35.0L108.0,41.0Q108.0,46.0 112.0,49.0L112.0,49.0Q116.0,52.0 116.0,57.0L116.0,68.0Q116.0,76.0 108.0,76.0L8.0,76.0Q0.0,76.0 0.0,68.0L0.0,57.0Q0.0,52.0 4.0,49.0L4.0,49.0Q8.0,46.0 8.0,41.0L8.0,35.0Q8.0,30.0 4.0,27.0L4.0,27.0Q0.0,24.0 0.0,19.0Z" fill="#fffffd"/></g><g transform="translate(58 44)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L8.0,0.0Q13.0,0.0 13.0,5.0L13.0,28.0Q13.0,33.0 8.0,33.0L5.0,33.0Q0.0,33.0 0.0,28.0Z" fill="#0e1017"/></g><g transform="translate(57.5 80)"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#0e1017"/></g><g transform="translate(88 64)" opacity="0.4"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#0e1017"/></g>', "g.controller": '<g transform="translate(14 46)"><path d="M10.5,17.1Q16.0,0.0 34.0,0.0L82.0,0.0Q100.0,0.0 105.5,17.1L113.0,40.5Q116.0,50.0 108.0,56.0L108.0,56.0Q100.0,62.0 92.9,54.9L90.0,52.0Q80.0,42.0 65.9,42.0L50.1,42.0Q36.0,42.0 26.0,52.0L23.1,54.9Q16.0,62.0 8.0,56.0L8.0,56.0Q0.0,50.0 3.0,40.5Z" fill="#fffffe"/></g><g transform="translate(33 62.5)"><path d="M0.0,2.9Q0.0,0.0 2.9,0.0L19.1,0.0Q22.0,0.0 22.0,2.9L22.0,4.1Q22.0,7.0 19.1,7.0L2.9,7.0Q0.0,7.0 0.0,4.1Z" fill="#0e1017"/></g><g transform="translate(40.5 55)"><path d="M0.0,2.9Q0.0,0.0 2.9,0.0L4.1,0.0Q7.0,0.0 7.0,2.9L7.0,19.1Q7.0,22.0 4.1,22.0L2.9,22.0Q0.0,22.0 0.0,19.1Z" fill="#0e1017"/></g><g transform="translate(92 54)"><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="#0e1017"/></g><g transform="translate(104 66)"><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="#0e1017"/></g>', "g.vtBracket": '<g transform="translate(17.5 23.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 49.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(34.5 36.5) rotate(90 17.5 4.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L30.5,0.0Q35.0,0.0 35.0,4.5L35.0,4.5Q35.0,9.0 30.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 77.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(17.5 103.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(34.5 90.5) rotate(90 17.5 4.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L30.5,0.0Q35.0,0.0 35.0,4.5L35.0,4.5Q35.0,9.0 30.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(47.5 36.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L22.5,0.0Q27.0,0.0 27.0,4.5L27.0,4.5Q27.0,9.0 22.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(47.5 90.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L22.5,0.0Q27.0,0.0 27.0,4.5L27.0,4.5Q27.0,9.0 22.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(38.5 63.5) rotate(90 31.5 4.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L58.5,0.0Q63.0,0.0 63.0,4.5L63.0,4.5Q63.0,9.0 58.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(65.5 63.5)" opacity="0.9"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L18.5,0.0Q23.0,0.0 23.0,4.5L23.0,4.5Q23.0,9.0 18.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(90 46)" opacity="0.9"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L30.0,0.0Q36.0,0.0 36.0,6.0L36.0,6.0Q36.0,12.0 33.3,17.4L30.7,22.6Q28.0,28.0 22.0,28.0L14.0,28.0Q8.0,28.0 5.3,22.6L2.7,17.4Q0.0,12.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(103 74)" opacity="0.9"><path d="M0.0,0.0L10.0,0.0L10.0,10.0L0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(94 84)" opacity="0.9"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L25.0,0.0Q28.0,0.0 28.0,3.0L28.0,5.0Q28.0,8.0 25.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffe"/></g>', "g.chat": '<g transform="translate(16 26)"><path d="M0.0,14.0Q0.0,0.0 14.0,0.0L98.0,0.0Q112.0,0.0 112.0,14.0L112.0,56.0Q112.0,70.0 98.0,70.0L62.0,70.0Q48.0,70.0 37.7,79.5L30.9,85.7Q22.0,94.0 24.0,82.0L24.0,82.0Q26.0,70.0 13.8,70.0L13.0,70.0Q0.0,70.0 0.0,57.0Z" fill="none" stroke="#fffffe" stroke-width="9" stroke-linejoin="round"/></g><g transform="translate(38 53)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g><g transform="translate(64 53)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g><g transform="translate(90 53)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g>', "g.chatNext": '<g transform="translate(12 22)" opacity="0.8"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L72.0,0.0Q84.0,0.0 84.0,12.0L84.0,44.0Q84.0,56.0 72.0,56.0L50.0,56.0Q38.0,56.0 29.1,64.0L24.9,67.8Q18.0,74.0 20.0,65.0L20.0,65.0Q22.0,56.0 12.8,56.0L11.0,56.0Q0.0,56.0 0.0,45.0Z" fill="#fffffd"/></g><g transform="translate(70 64)"><path d="M0.0,8.0Q0.0,0.0 6.9,4.0L49.1,28.0Q56.0,32.0 49.1,36.0L6.9,60.0Q0.0,64.0 0.0,56.0Z" fill="#fffffe"/></g>', "g.queue": '<g transform="translate(22 26)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,12.0Q100.0,20.0 92.0,20.0L8.0,20.0Q0.0,20.0 0.0,12.0Z" fill="#fffffe"/></g><g transform="translate(22 62)" opacity="0.8"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,12.0Q100.0,20.0 92.0,20.0L8.0,20.0Q0.0,20.0 0.0,12.0Z" fill="#fffffd"/></g><g transform="translate(22 98)" opacity="0.55"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L92.0,0.0Q100.0,0.0 100.0,8.0L100.0,12.0Q100.0,20.0 92.0,20.0L8.0,20.0Q0.0,20.0 0.0,12.0Z" fill="#fffffd"/></g><g transform="translate(-2 26.08)"><path d="M14.4,8.9Q16.0,9.9 14.4,10.9L1.6,18.8Q0.0,19.8 0.0,17.9L0.0,1.9Q0.0,0.0 1.6,1.0Z" fill="#fffffe"/></g>', "g.sidebar": '<g transform="translate(22 22)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L26.0,0.0Q34.0,0.0 34.0,8.0L34.0,92.0Q34.0,100.0 26.0,100.0L8.0,100.0Q0.0,100.0 0.0,92.0Z" fill="#fffffe"/></g><g transform="translate(66 32)" opacity="0.5"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L51.0,0.0Q56.0,0.0 56.0,5.0L56.0,9.0Q56.0,14.0 51.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(66 58)" opacity="0.5"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L51.0,0.0Q56.0,0.0 56.0,5.0L56.0,9.0Q56.0,14.0 51.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(66 84)" opacity="0.5"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L35.0,0.0Q40.0,0.0 40.0,5.0L40.0,9.0Q40.0,14.0 35.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g>', "g.scan": '<g transform="translate(32 26)"><path d="M80.0,40.0L79.7,44.5L79.0,48.9L77.8,53.2L76.0,57.4L73.9,61.3L71.3,64.9L68.3,68.3L64.9,71.3L61.3,73.9L57.4,76.0L53.2,77.8L48.9,79.0L44.5,79.7L40.0,80.0L35.5,79.7L31.1,79.0L26.8,77.8L22.6,76.0L18.7,73.9L15.1,71.3L11.7,68.3L8.7,64.9L6.1,61.3L4.0,57.4L2.2,53.2L1.0,48.9L0.3,44.5L0.0,40.0L0.3,35.5L1.0,31.1L2.2,26.8L4.0,22.6L6.1,18.7L8.7,15.1L11.7,11.7L15.1,8.7L18.7,6.1L22.6,4.0L26.8,2.2L31.1,1.0L35.5,0.3L40.0,0.0L44.5,0.3L48.9,1.0L53.2,2.2L57.4,4.0L61.3,6.1L64.9,8.7L68.3,11.7L71.3,15.1L73.9,18.7L76.0,22.6L77.8,26.8L79.0,31.1L79.7,35.5Z" fill="none" stroke="#fffffe" stroke-width="9" stroke-linejoin="round"/></g><g transform="translate(57 51)"><path d="M30.0,15.0L29.9,16.7L29.6,18.3L29.2,20.0L28.5,21.5L27.7,23.0L26.7,24.4L25.6,25.6L24.4,26.7L23.0,27.7L21.5,28.5L20.0,29.2L18.3,29.6L16.7,29.9L15.0,30.0L13.3,29.9L11.7,29.6L10.0,29.2L8.5,28.5L7.0,27.7L5.6,26.7L4.4,25.6L3.3,24.4L2.3,23.0L1.5,21.5L0.8,20.0L0.4,18.3L0.1,16.7L0.0,15.0L0.1,13.3L0.4,11.7L0.8,10.0L1.5,8.5L2.3,7.0L3.3,5.6L4.4,4.4L5.6,3.3L7.0,2.3L8.5,1.5L10.0,0.8L11.7,0.4L13.3,0.1L15.0,0.0L16.7,0.1L18.3,0.4L20.0,0.8L21.5,1.5L23.0,2.3L24.4,3.3L25.6,4.4L26.7,5.6L27.7,7.0L28.5,8.5L29.2,10.0L29.6,11.7L29.9,13.3Z" fill="#fffffe"/></g><g transform="translate(17.76 11.76)" opacity="0.8"><path d="M0.2,34.6L2.4,29.4L5.0,24.5L8.1,19.9L11.7,15.6L15.6,11.7L19.9,8.1L24.5,5.0L29.4,2.4L34.6,0.2L35.7,0.0L36.7,0.1L37.7,0.6L38.5,1.3L39.1,2.3L39.3,3.4L39.1,4.5L38.7,5.5L37.9,6.3L37.0,6.8L32.5,8.7L28.1,11.0L24.1,13.7L20.3,16.8L16.8,20.3L13.7,24.1L11.0,28.1L8.7,32.5L6.8,37.0L6.3,37.9L5.5,38.7L4.5,39.1L3.4,39.3L2.3,39.1L1.3,38.5L0.6,37.7L0.1,36.7L0.0,35.7Z" fill="#fffffd"/></g><g transform="translate(86.97 80.97)" opacity="0.8"><path d="M39.1,4.7L36.9,9.8L34.3,14.7L31.2,19.4L27.6,23.7L23.7,27.6L19.4,31.2L14.7,34.3L9.8,36.9L4.7,39.1L3.6,39.3L2.5,39.1L1.5,38.7L0.7,37.9L0.2,37.0L0.0,35.9L0.1,34.8L0.6,33.8L1.3,33.0L2.3,32.5L6.8,30.6L11.1,28.3L15.2,25.5L19.0,22.4L22.4,19.0L25.5,15.2L28.3,11.1L30.6,6.8L32.5,2.3L33.0,1.3L33.8,0.6L34.8,0.1L35.9,0.0L37.0,0.2L37.9,0.7L38.7,1.5L39.1,2.5L39.3,3.6Z" fill="#fffffd"/></g>', "g.resync": '<g transform="translate(27.92 25.5)"><path d="M0.4,30.6L2.2,26.2L4.5,22.1L7.2,18.2L10.3,14.6L13.7,11.3L17.4,8.4L21.4,5.9L25.7,3.8L30.1,2.2L34.7,1.0L39.4,0.2L44.1,0.0L48.8,0.2L53.5,1.0L58.1,2.2L62.5,3.8L66.7,5.9L70.8,8.4L74.5,11.3L77.9,14.6L81.0,18.2L83.7,22.1L85.9,26.2L87.8,30.6L88.2,32.6L87.9,34.6L87.1,36.5L85.7,37.9L83.9,38.9L81.9,39.3L79.9,39.1L78.0,38.2L76.5,36.8L75.6,35.0L74.2,31.9L72.6,28.9L70.7,26.1L68.5,23.5L66.0,21.2L63.3,19.1L60.4,17.2L57.4,15.7L54.2,14.6L50.9,13.7L47.5,13.2L44.1,13.0L40.7,13.2L37.3,13.7L34.0,14.6L30.8,15.7L27.8,17.2L24.9,19.1L22.2,21.2L19.7,23.5L17.5,26.1L15.6,28.9L13.9,31.9L12.6,35.0L11.6,36.8L10.1,38.2L8.3,39.1L6.3,39.3L4.3,38.9L2.5,37.9L1.1,36.5L0.2,34.6L0.0,32.6Z" fill="#fffffe"/></g><g transform="translate(100.64 51.6)"><path d="M13.4,26.1Q11.4,28.4 10.2,25.5L1.2,2.9Q0.0,0.0 3.1,0.5L28.7,5.1Q31.8,5.6 29.7,7.9Z" fill="#fffffe"/></g><g transform="translate(27.92 79.18)" opacity="0.85"><path d="M87.8,8.7L85.9,13.1L83.7,17.2L81.0,21.1L77.9,24.7L74.5,28.0L70.8,30.9L66.7,33.4L62.5,35.5L58.1,37.2L53.5,38.4L48.8,39.1L44.1,39.3L39.4,39.1L34.7,38.4L30.1,37.2L25.7,35.5L21.4,33.4L17.4,30.9L13.7,28.0L10.3,24.7L7.2,21.1L4.5,17.2L2.2,13.1L0.4,8.7L0.0,6.7L0.2,4.7L1.1,2.9L2.5,1.4L4.3,0.4L6.3,0.0L8.3,0.2L10.1,1.1L11.6,2.5L12.6,4.3L13.9,7.4L15.6,10.4L17.5,13.2L19.7,15.8L22.2,18.2L24.9,20.3L27.8,22.1L30.8,23.6L34.0,24.8L37.3,25.6L40.7,26.1L44.1,26.3L47.5,26.1L50.9,25.6L54.2,24.8L57.4,23.6L60.4,22.1L63.3,20.3L66.0,18.2L68.5,15.8L70.7,13.2L72.6,10.4L74.2,7.4L75.6,4.3L76.5,2.5L78.0,1.1L79.9,0.2L81.9,0.0L83.9,0.4L85.7,1.4L87.1,2.9L87.9,4.7L88.2,6.7Z" fill="#fffffd"/></g><g transform="translate(11.61 64)" opacity="0.85"><path d="M18.3,2.3Q20.4,0.0 21.5,2.9L30.6,25.5Q31.8,28.4 28.7,27.9L3.1,23.3Q0.0,22.8 2.1,20.5Z" fill="#fffffd"/></g>', "g.pencil": '<g transform="translate(30 30)"><path d="M3.9,83.0Q0.0,84.0 1.0,80.1L5.0,63.9Q6.0,60.0 8.8,57.2L63.2,2.8Q66.0,0.0 68.8,2.8L81.2,15.2Q84.0,18.0 81.2,20.8L26.8,75.2Q24.0,78.0 20.1,79.0Z" fill="#fffffe"/></g>', "g.bolt": '<g transform="translate(50 12)"><path d="M49.0,0.0Q44.0,0.0 41.4,4.3L8.6,57.7Q6.0,62.0 11.0,62.0L23.0,62.0Q28.0,62.0 25.8,66.5L2.2,115.5Q0.0,120.0 3.2,116.2L58.8,49.8Q62.0,46.0 57.0,46.0L45.0,46.0Q40.0,46.0 42.5,41.6L63.5,4.4Q66.0,0.0 61.0,0.0Z" fill="#fffffe"/></g>', "g.hexLife": '<g transform="translate(28.7 22)"><path d="M34.6,5.0Q43.3,0.0 52.0,5.0L77.9,20.0Q86.6,25.0 86.6,35.0L86.6,65.0Q86.6,75.0 77.9,80.0L52.0,95.0Q43.3,100.0 34.6,95.0L8.7,80.0Q0.0,75.0 0.0,65.0L0.0,35.0Q0.0,25.0 8.7,20.0Z" fill="#fffffe"/></g><g transform="translate(49.48 46)" opacity="0.35"><path d="M19.1,2.0Q22.5,0.0 26.0,2.0L41.6,11.0Q45.0,13.0 45.0,17.0L45.0,35.0Q45.0,39.0 41.6,41.0L26.0,50.0Q22.5,52.0 19.1,50.0L3.5,41.0Q0.0,39.0 0.0,35.0L0.0,17.0Q0.0,13.0 3.5,11.0Z" fill="#0e1017"/></g>', "b.match": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(119.44 3)"><path d="M8.6,0.0L10.9,5.8L17.1,6.2L12.4,10.2L13.8,16.3L8.6,13.0L3.3,16.3L4.8,10.2L0.0,6.2L6.2,5.8Z" fill="#0e1017"/></g>', "b.stream": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(119 5)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L15.0,0.0Q18.0,0.0 18.0,3.0L18.0,9.0Q18.0,12.0 15.0,12.0L3.0,12.0Q0.0,12.0 0.0,9.0Z" fill="#0e1017"/></g><g transform="translate(123 18)"><path d="M0.0,0.0L10.0,0.0L10.0,3.0L0.0,3.0Z" fill="#0e1017"/></g>', "b.bracket": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(117.3 4.3)"><path d="M0.0,1.7Q0.0,0.0 1.7,0.0L8.7,0.0Q10.4,0.0 10.4,1.7L10.4,1.7Q10.4,3.4 8.7,3.4L1.7,3.4Q0.0,3.4 0.0,1.7Z" fill="#0e1017"/></g><g transform="translate(117.3 16.3)"><path d="M0.0,1.7Q0.0,0.0 1.7,0.0L8.7,0.0Q10.4,0.0 10.4,1.7L10.4,1.7Q10.4,3.4 8.7,3.4L1.7,3.4Q0.0,3.4 0.0,1.7Z" fill="#0e1017"/></g><g transform="translate(118.3 10.3) rotate(90 7.7 1.7)"><path d="M0.0,1.7Q0.0,0.0 1.7,0.0L13.7,0.0Q15.4,0.0 15.4,1.7L15.4,1.7Q15.4,3.4 13.7,3.4L1.7,3.4Q0.0,3.4 0.0,1.7Z" fill="#0e1017"/></g><g transform="translate(124.3 10.3)"><path d="M0.0,1.7Q0.0,0.0 1.7,0.0L11.7,0.0Q13.4,0.0 13.4,1.7L13.4,1.7Q13.4,3.4 11.7,3.4L1.7,3.4Q0.0,3.4 0.0,1.7Z" fill="#0e1017"/></g>', "b.format": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(120.21 3)"><path d="M6.1,1.0Q7.8,0.0 9.5,1.0L13.9,3.5Q15.6,4.5 15.6,6.5L15.6,11.5Q15.6,13.5 13.9,14.5L9.5,17.0Q7.8,18.0 6.1,17.0L1.7,14.5Q0.0,13.5 0.0,11.5L0.0,6.5Q0.0,4.5 1.7,3.5Z" fill="#0e1017"/></g>', "b.vt": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(116 7)"><path d="M1.5,3.0Q2.0,0.0 5.0,0.0L19.0,0.0Q22.0,0.0 22.5,3.0L23.5,8.4Q24.0,11.0 21.5,12.0L21.5,12.0Q19.0,13.0 17.3,10.9L16.9,10.3Q15.0,8.0 12.0,8.0L12.0,8.0Q9.0,8.0 7.1,10.3L6.7,10.9Q5.0,13.0 2.5,12.0L2.5,12.0Q0.0,11.0 0.5,8.4Z" fill="#0e1017"/></g>', "b.vm": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(118 4)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L17.0,0.0Q20.0,0.0 20.0,3.0L20.0,10.0Q20.0,13.0 17.0,13.0L11.0,13.0Q8.0,13.0 5.7,14.9L4.6,15.7Q3.0,17.0 3.5,15.0L3.5,14.9Q4.0,13.0 2.0,13.0L2.0,13.0Q0.0,13.0 0.0,11.0Z" fill="#0e1017"/></g>', "b.auto": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(122 6)"><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="#0e1017"/><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="none" stroke="#fffffe" stroke-width="3.4" stroke-linejoin="round"/></g><g transform="translate(125.4 9.4)"><path d="M5.2,2.6L5.2,2.9L5.1,3.2L5.1,3.5L4.9,3.7L4.8,4.0L4.6,4.2L4.4,4.4L4.2,4.6L4.0,4.8L3.7,4.9L3.5,5.1L3.2,5.1L2.9,5.2L2.6,5.2L2.3,5.2L2.0,5.1L1.7,5.1L1.5,4.9L1.2,4.8L1.0,4.6L0.8,4.4L0.6,4.2L0.4,4.0L0.3,3.7L0.1,3.5L0.1,3.2L0.0,2.9L0.0,2.6L0.0,2.3L0.1,2.0L0.1,1.7L0.3,1.5L0.4,1.2L0.6,1.0L0.8,0.8L1.0,0.6L1.2,0.4L1.5,0.3L1.7,0.1L2.0,0.1L2.3,0.0L2.6,0.0L2.9,0.0L3.2,0.1L3.5,0.1L3.7,0.3L4.0,0.4L4.2,0.6L4.4,0.8L4.6,1.0L4.8,1.2L4.9,1.5L5.1,1.7L5.1,2.0L5.2,2.3Z" fill="#0e1017"/></g>', "g.gauge": '<g transform="translate(14.5 28.5)" opacity="0.85"><path d="M0.0,57.5L0.3,51.5L1.3,45.5L2.8,39.7L5.0,34.1L7.7,28.8L11.0,23.7L14.8,19.0L19.0,14.8L23.7,11.0L28.8,7.7L34.1,5.0L39.7,2.8L45.5,1.3L51.5,0.3L57.5,0.0L63.5,0.3L69.5,1.3L75.3,2.8L80.9,5.0L86.3,7.7L91.3,11.0L96.0,14.8L100.2,19.0L104.0,23.7L107.3,28.8L110.0,34.1L112.2,39.7L113.7,45.5L114.7,51.5L115.0,57.5L114.7,59.2L114.0,60.7L112.7,61.9L111.2,62.7L109.5,63.0L107.8,62.7L106.3,61.9L105.1,60.7L104.3,59.2L104.0,57.5L103.7,52.6L103.0,47.8L101.7,43.1L100.0,38.6L97.8,34.2L95.1,30.2L92.1,26.4L88.6,22.9L84.8,19.9L80.7,17.2L76.4,15.0L71.9,13.3L67.2,12.0L62.4,11.3L57.5,11.0L52.6,11.3L47.8,12.0L43.1,13.3L38.6,15.0L34.3,17.2L30.2,19.9L26.4,22.9L22.9,26.4L19.9,30.2L17.2,34.2L15.0,38.6L13.3,43.1L12.0,47.8L11.3,52.6L11.0,57.5L10.7,59.2L9.9,60.7L8.7,61.9L7.2,62.7L5.5,63.0L3.8,62.7L2.3,61.9L1.0,60.7L0.3,59.2Z" fill="#fffffd"/></g><g transform="translate(36.81 72.74) rotate(19.999999999999947 6.9999999999999964 3)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,3.0Q14.0,6.0 11.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffd"/></g><g transform="translate(50 57.02) rotate(59.99999999999999 6.999999999999999 3)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,3.0Q14.0,6.0 11.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffd"/></g><g transform="translate(70.21 53.46) rotate(99.99999999999999 7 3)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,3.0Q14.0,6.0 11.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffd"/></g><g transform="translate(87.98 63.72) rotate(139.99999999999994 6.999999999999998 3)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,3.0Q14.0,6.0 11.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffd"/></g><g transform="translate(59.65 64) rotate(-46.73570458892839 28.3452350598575 5)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L51.7,0.0Q56.7,0.0 56.7,5.0L56.7,5.0Q56.7,10.0 51.7,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffe"/></g><g transform="translate(61 75)"><path d="M22.0,11.0L21.9,12.2L21.7,13.4L21.4,14.6L20.9,15.8L20.3,16.9L19.6,17.9L18.8,18.8L17.9,19.6L16.9,20.3L15.8,20.9L14.6,21.4L13.4,21.7L12.2,21.9L11.0,22.0L9.8,21.9L8.6,21.7L7.4,21.4L6.2,20.9L5.1,20.3L4.1,19.6L3.2,18.8L2.4,17.9L1.7,16.9L1.1,15.8L0.6,14.6L0.3,13.4L0.1,12.2L0.0,11.0L0.1,9.8L0.3,8.6L0.6,7.4L1.1,6.2L1.7,5.1L2.4,4.1L3.2,3.2L4.1,2.4L5.1,1.7L6.2,1.1L7.4,0.6L8.6,0.3L9.8,0.1L11.0,0.0L12.2,0.1L13.4,0.3L14.6,0.6L15.8,1.1L16.9,1.7L17.9,2.4L18.8,3.2L19.6,4.1L20.3,5.1L20.9,6.2L21.4,7.4L21.7,8.6L21.9,9.8Z" fill="#fffffe"/></g><g transform="translate(30 110)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L79.0,0.0Q84.0,0.0 84.0,5.0L84.0,7.0Q84.0,12.0 79.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffd"/></g>', "g.obsRefresh": '<g transform="translate(14 24)" opacity="0.55"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L106.0,0.0Q116.0,0.0 116.0,10.0L116.0,70.0Q116.0,80.0 106.0,80.0L10.0,80.0Q0.0,80.0 0.0,70.0Z" fill="#fffffd"/></g><g transform="translate(52 108)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L37.0,0.0Q40.0,0.0 40.0,3.0L40.0,5.0Q40.0,8.0 37.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(36 116)" opacity="0.7"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L68.0,0.0Q72.0,0.0 72.0,4.0L72.0,4.0Q72.0,8.0 68.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g><g transform="translate(41.02 39.1)"><path d="M54.7,5.0L56.7,7.6L58.4,10.4L59.7,13.3L60.8,16.4L61.5,19.5L61.9,22.7L62.0,26.0L61.7,29.2L61.1,32.4L60.1,35.5L58.8,38.5L57.3,41.3L55.4,44.0L53.3,46.4L50.9,48.7L48.3,50.6L45.5,52.3L42.6,53.6L39.5,54.7L36.4,55.4L33.1,55.8L29.9,55.9L26.7,55.6L23.5,55.0L20.4,54.0L17.4,52.8L14.6,51.2L11.9,49.3L9.4,47.2L7.2,44.8L5.3,42.2L3.6,39.5L2.2,36.5L1.2,33.4L0.5,30.3L0.1,27.1L0.0,23.8L0.3,20.6L0.9,17.4L1.9,14.3L3.1,11.3L4.7,8.5L6.6,5.8L8.7,3.4L11.1,1.2L12.4,0.4L13.9,0.0L15.5,0.1L16.9,0.7L18.1,1.8L18.9,3.1L19.3,4.6L19.1,6.2L18.5,7.6L17.5,8.8L15.9,10.3L14.4,12.0L13.2,13.8L12.1,15.7L11.2,17.7L10.6,19.8L10.2,22.0L10.0,24.2L10.0,26.4L10.3,28.6L10.8,30.7L11.5,32.8L12.4,34.8L13.6,36.6L14.9,38.4L16.4,40.0L18.1,41.5L19.9,42.7L21.8,43.8L23.8,44.6L25.9,45.3L28.1,45.7L30.2,45.9L32.4,45.9L34.6,45.6L36.8,45.1L38.8,44.4L40.8,43.4L42.7,42.3L44.5,41.0L46.1,39.5L47.5,37.8L48.8,36.0L49.9,34.1L50.7,32.1L51.4,30.0L51.8,27.8L52.0,25.6L51.9,23.4L51.7,21.3L51.2,19.1L50.5,17.0L49.5,15.0L48.4,13.2L47.1,11.4L46.3,10.1L45.9,8.5L46.0,7.0L46.7,5.5L47.7,4.4L49.0,3.6L50.5,3.2L52.1,3.3L53.5,4.0Z" fill="#fffffe"/></g><g transform="translate(97.11 21.78)"><path d="M3.4,26.9Q0.9,28.2 0.8,25.3L0.1,2.9Q0.0,0.0 2.5,1.4L23.3,13.4Q25.8,14.9 23.2,16.2Z" fill="#fffffe"/></g>', "g.hideAll": '<g transform="translate(16 26)" opacity="0.55"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L102.0,0.0Q112.0,0.0 112.0,10.0L112.0,64.0Q112.0,74.0 102.0,74.0L10.0,74.0Q0.0,74.0 0.0,64.0Z" fill="#fffffd"/></g><g transform="translate(52 104)" opacity="0.7"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L37.0,0.0Q40.0,0.0 40.0,3.0L40.0,5.0Q40.0,8.0 37.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(36 114)" opacity="0.7"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L68.0,0.0Q72.0,0.0 72.0,4.0L72.0,5.0Q72.0,9.0 68.0,9.0L4.0,9.0Q0.0,9.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(-3.29 53) rotate(47.60256220249981 75.28964600958975 13)"><path d="M0.0,13.0Q0.0,0.0 13.0,0.0L137.6,0.0Q150.6,0.0 150.6,13.0L150.6,13.0Q150.6,26.0 137.6,26.0L13.0,26.0Q0.0,26.0 0.0,13.0Z" fill="#0e1017"/></g><g transform="translate(3.21 59.5) rotate(47.60256220249981 68.78964600958975 6.5)"><path d="M0.0,6.5Q0.0,0.0 6.5,0.0L131.1,0.0Q137.6,0.0 137.6,6.5L137.6,6.5Q137.6,13.0 131.1,13.0L6.5,13.0Q0.0,13.0 0.0,6.5Z" fill="#fffffe"/></g>', "g.mic": '<g transform="translate(52 14)"><path d="M0.0,20.0Q0.0,0.0 20.0,0.0L20.0,0.0Q40.0,0.0 40.0,20.0L40.0,50.0Q40.0,70.0 20.0,70.0L20.0,70.0Q0.0,70.0 0.0,50.0Z" fill="#fffffe"/></g><g transform="translate(33.5 64)" opacity="0.85"><path d="M77.0,0.0L76.8,4.0L76.2,8.0L75.1,11.9L73.7,15.7L71.8,19.3L69.6,22.6L67.1,25.8L64.3,28.6L61.1,31.1L57.8,33.3L54.2,35.2L50.4,36.6L46.5,37.7L42.5,38.3L38.5,38.5L34.5,38.3L30.5,37.7L26.6,36.6L22.8,35.2L19.3,33.3L15.9,31.1L12.7,28.6L9.9,25.8L7.4,22.6L5.2,19.3L3.3,15.7L1.9,11.9L0.8,8.0L0.2,4.0L0.0,0.0L9.0,0.0L9.2,3.1L9.6,6.1L10.4,9.1L11.6,12.0L13.0,14.8L14.6,17.3L16.6,19.7L18.8,21.9L21.2,23.9L23.7,25.5L26.5,26.9L29.4,28.1L32.4,28.9L35.4,29.3L38.5,29.5L41.6,29.3L44.6,28.9L47.6,28.1L50.5,26.9L53.3,25.5L55.8,23.9L58.2,21.9L60.4,19.7L62.4,17.3L64.0,14.8L65.4,12.0L66.6,9.1L67.4,6.1L67.8,3.1L68.0,0.0Z" fill="#fffffd"/></g><g transform="translate(67 98)" opacity="0.85"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L7.0,0.0Q10.0,0.0 10.0,3.0L10.0,17.0Q10.0,20.0 7.0,20.0L3.0,20.0Q0.0,20.0 0.0,17.0Z" fill="#fffffd"/></g><g transform="translate(46 116)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L47.0,0.0Q52.0,0.0 52.0,5.0L52.0,5.0Q52.0,10.0 47.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffe"/></g>', "g.leader": '<g transform="translate(50 62)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L39.0,0.0Q44.0,0.0 44.0,5.0L44.0,57.0Q44.0,62.0 39.0,62.0L5.0,62.0Q0.0,62.0 0.0,57.0Z" fill="#fffffe"/></g><g transform="translate(14 84)" opacity="0.8"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L33.0,0.0Q38.0,0.0 38.0,5.0L38.0,35.0Q38.0,40.0 33.0,40.0L5.0,40.0Q0.0,40.0 0.0,35.0Z" fill="#fffffd"/></g><g transform="translate(92 96)" opacity="0.65"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L33.0,0.0Q38.0,0.0 38.0,5.0L38.0,23.0Q38.0,28.0 33.0,28.0L5.0,28.0Q0.0,28.0 0.0,23.0Z" fill="#fffffd"/></g><g transform="translate(50 24)"><path d="M0.8,13.9Q0.0,10.0 2.8,12.8L7.2,17.2Q10.0,20.0 12.1,16.6L19.9,3.4Q22.0,0.0 24.1,3.4L31.9,16.6Q34.0,20.0 36.8,17.2L41.2,12.8Q44.0,10.0 43.2,13.9L40.8,26.1Q40.0,30.0 36.0,30.0L8.0,30.0Q4.0,30.0 3.2,26.1Z" fill="#fffffe"/></g>', "g.unlock": '<g transform="translate(55 13)"><path d="M0.0,25.0L0.1,22.4L0.5,19.8L1.2,17.3L2.2,14.8L3.3,12.5L4.8,10.3L6.4,8.3L8.3,6.4L10.3,4.8L12.5,3.3L14.8,2.2L17.3,1.2L19.8,0.5L22.4,0.1L25.0,0.0L27.6,0.1L30.2,0.5L32.7,1.2L35.2,2.2L37.5,3.3L39.7,4.8L41.7,6.4L43.6,8.3L45.2,10.3L46.7,12.5L47.8,14.8L48.8,17.3L49.5,19.8L49.9,22.4L50.0,25.0L40.0,25.0L39.9,23.4L39.7,21.9L39.3,20.4L38.7,18.9L38.0,17.5L37.1,16.2L36.1,15.0L35.0,13.9L33.8,12.9L32.5,12.0L31.1,11.3L29.6,10.7L28.1,10.3L26.6,10.1L25.0,10.0L23.4,10.1L21.9,10.3L20.4,10.7L18.9,11.3L17.5,12.0L16.2,12.9L15.0,13.9L13.9,15.0L12.9,16.2L12.0,17.5L11.3,18.9L10.7,20.4L10.3,21.9L10.1,23.4L10.0,25.0Z" fill="#fffffe"/></g><g transform="translate(84 44) rotate(90 16 5)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L27.0,0.0Q32.0,0.0 32.0,5.0L32.0,5.0Q32.0,10.0 27.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffe"/></g><g transform="translate(44 58)"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L47.0,0.0Q56.0,0.0 56.0,9.0L56.0,37.0Q56.0,46.0 47.0,46.0L9.0,46.0Q0.0,46.0 0.0,37.0Z" fill="#fffffe"/></g><g transform="translate(65 71)" opacity="0.7"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#0e1017"/></g>', "g.tempo": '<g transform="translate(52 26)"><path d="M0.0,86.0L40.0,86.0L28.0,0.0L12.0,0.0Z" fill="#fffffe"/></g><g transform="translate(47.88 65.5) rotate(-67.24902365721236 37.11547262794323 3.5)"><path d="M0.0,3.5Q0.0,0.0 3.5,0.0L70.7,0.0Q74.2,0.0 74.2,3.5L74.2,3.5Q74.2,7.0 70.7,7.0L3.5,7.0Q0.0,7.0 0.0,3.5Z" fill="#fffffe"/></g><g transform="translate(88 52)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L13.0,0.0Q16.0,0.0 16.0,3.0L16.0,9.0Q16.0,12.0 13.0,12.0L3.0,12.0Q0.0,12.0 0.0,9.0Z" fill="#fffffe"/></g><g transform="translate(46 108)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L49.0,0.0Q52.0,0.0 52.0,3.0L52.0,5.0Q52.0,8.0 49.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffe"/></g>', "g.pilot": '<g transform="translate(28.5 28.5)"><path d="M87.0,43.5L86.8,48.0L86.0,52.5L84.9,56.9L83.2,61.2L81.2,65.3L78.7,69.1L75.8,72.6L72.6,75.8L69.1,78.7L65.3,81.2L61.2,83.2L56.9,84.9L52.5,86.0L48.0,86.8L43.5,87.0L39.0,86.8L34.5,86.0L30.1,84.9L25.8,83.2L21.8,81.2L17.9,78.7L14.4,75.8L11.2,72.6L8.3,69.1L5.8,65.3L3.8,61.2L2.1,56.9L1.0,52.5L0.2,48.0L0.0,43.5L0.2,39.0L1.0,34.5L2.1,30.1L3.8,25.8L5.8,21.8L8.3,17.9L11.2,14.4L14.4,11.2L17.9,8.3L21.8,5.8L25.8,3.8L30.1,2.1L34.5,1.0L39.0,0.2L43.5,0.0L48.0,0.2L52.5,1.0L56.9,2.1L61.2,3.8L65.3,5.8L69.1,8.3L72.6,11.2L75.8,14.4L78.7,17.9L81.2,21.8L83.2,25.8L84.9,30.1L86.0,34.5L86.8,39.0L87.0,43.5L76.0,43.5L75.8,40.1L75.3,36.7L74.4,33.5L73.2,30.3L71.6,27.3L69.8,24.4L67.7,21.8L65.2,19.3L62.6,17.2L59.7,15.4L56.7,13.8L53.5,12.6L50.3,11.7L46.9,11.2L43.5,11.0L40.1,11.2L36.7,11.7L33.5,12.6L30.3,13.8L27.3,15.4L24.4,17.2L21.8,19.3L19.3,21.8L17.2,24.4L15.4,27.3L13.8,30.3L12.6,33.5L11.7,36.7L11.2,40.1L11.0,43.5L11.2,46.9L11.7,50.3L12.6,53.5L13.8,56.7L15.4,59.7L17.2,62.6L19.3,65.2L21.8,67.7L24.4,69.8L27.3,71.6L30.3,73.2L33.5,74.4L36.7,75.3L40.1,75.8L43.5,76.0L46.9,75.8L50.3,75.3L53.5,74.4L56.7,73.2L59.7,71.6L62.6,69.8L65.2,67.7L67.7,65.2L69.8,62.6L71.6,59.7L73.2,56.7L74.4,53.5L75.3,50.3L75.8,46.9L76.0,43.5Z" fill="#fffffe"/></g><g transform="translate(61 61)"><path d="M22.0,11.0L21.9,12.2L21.7,13.4L21.4,14.6L20.9,15.8L20.3,16.9L19.6,17.9L18.8,18.8L17.9,19.6L16.9,20.3L15.8,20.9L14.6,21.4L13.4,21.7L12.2,21.9L11.0,22.0L9.8,21.9L8.6,21.7L7.4,21.4L6.2,20.9L5.1,20.3L4.1,19.6L3.2,18.8L2.4,17.9L1.7,16.9L1.1,15.8L0.6,14.6L0.3,13.4L0.1,12.2L0.0,11.0L0.1,9.8L0.3,8.6L0.6,7.4L1.1,6.2L1.7,5.1L2.4,4.1L3.2,3.2L4.1,2.4L5.1,1.7L6.2,1.1L7.4,0.6L8.6,0.3L9.8,0.1L11.0,0.0L12.2,0.1L13.4,0.3L14.6,0.6L15.8,1.1L16.9,1.7L17.9,2.4L18.8,3.2L19.6,4.1L20.3,5.1L20.9,6.2L21.4,7.4L21.7,8.6L21.9,9.8Z" fill="#fffffe"/></g><g transform="translate(49.5 85.5) rotate(90 22.5 4.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L40.5,0.0Q45.0,0.0 45.0,4.5L45.0,4.5Q45.0,9.0 40.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(32.78 62.5) rotate(-163.61045966596524 22.220045146669353 4.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L39.9,0.0Q44.4,0.0 44.4,4.5L44.4,4.5Q44.4,9.0 39.9,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(66.78 62.5) rotate(-16.389540334034784 22.220045146669353 4.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L39.9,0.0Q44.4,0.0 44.4,4.5L44.4,4.5Q44.4,9.0 39.9,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g>', "g.replay": '<g transform="translate(27.05 33.03)"><path d="M67.5,0.0L71.4,2.5L75.0,5.4L78.3,8.7L81.2,12.3L83.8,16.2L85.9,20.3L87.6,24.6L88.9,29.1L89.6,33.7L89.9,38.3L89.8,43.0L89.1,47.6L88.0,52.1L86.4,56.5L84.4,60.6L82.0,64.6L79.1,68.3L75.9,71.6L72.4,74.6L68.6,77.3L64.5,79.5L60.2,81.3L55.7,82.7L51.2,83.5L46.6,83.9L41.9,83.9L37.3,83.3L32.8,82.3L28.4,80.8L24.1,78.9L20.1,76.5L16.4,73.8L13.0,70.6L9.9,67.2L7.2,63.4L4.8,59.4L2.9,55.1L1.5,50.7L0.5,46.2L0.0,41.5L0.0,36.9L0.5,32.3L1.4,27.7L2.8,23.3L4.6,19.0L6.9,15.0L9.6,11.2L12.6,7.7L16.0,4.5L22.5,12.2L19.8,14.6L17.4,17.3L15.3,20.3L13.6,23.4L12.1,26.8L11.1,30.2L10.3,33.8L10.0,37.4L10.0,41.0L10.4,44.6L11.2,48.1L12.3,51.5L13.7,54.8L15.6,58.0L17.7,60.9L20.1,63.6L22.7,66.0L25.6,68.2L28.8,70.0L32.0,71.5L35.5,72.7L39.0,73.5L42.6,73.9L46.2,73.9L49.8,73.6L53.3,72.9L56.8,71.9L60.1,70.5L63.3,68.8L66.3,66.7L69.0,64.4L71.5,61.8L73.7,58.9L75.6,55.8L77.2,52.6L78.4,49.2L79.3,45.7L79.8,42.1L79.9,38.5L79.7,34.9L79.1,31.3L78.1,27.8L76.8,24.5L75.1,21.3L73.1,18.2L70.9,15.4L68.3,12.9L65.5,10.6L62.5,8.7Z" fill="#fffffe"/></g><g transform="translate(92 26)"><path d="M10.0,0.0L26.0,24.0L0.0,28.0Z" fill="#fffffe"/></g><g transform="translate(60 52)"><path d="M0.0,0.0L34.0,20.0L0.0,40.0Z" fill="#fffffe"/></g>', "g.flow": '<g transform="translate(14 22)"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L35.0,0.0Q44.0,0.0 44.0,9.0L44.0,25.0Q44.0,34.0 35.0,34.0L9.0,34.0Q0.0,34.0 0.0,25.0Z" fill="#fffffe"/></g><g transform="translate(13.5 69.5) rotate(90 22.5 4.5)" opacity="0.85"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L40.5,0.0Q45.0,0.0 45.0,4.5L45.0,4.5Q45.0,9.0 40.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(31.5 87.5)" opacity="0.85"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L42.5,0.0Q47.0,0.0 47.0,4.5L47.0,4.5Q47.0,9.0 42.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(68 78.36)" opacity="0.85"><path d="M19.8,12.2Q22.0,13.6 19.8,15.0L2.2,25.9Q0.0,27.3 0.0,24.6L0.0,2.6Q0.0,0.0 2.2,1.4Z" fill="#fffffd"/></g><g transform="translate(86 22)" opacity="0.7"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L35.0,0.0Q44.0,0.0 44.0,9.0L44.0,25.0Q44.0,34.0 35.0,34.0L9.0,34.0Q0.0,34.0 0.0,25.0Z" fill="#fffffd"/></g><g transform="translate(96 76)"><path d="M0.0,9.0Q0.0,0.0 9.0,0.0L29.0,0.0Q38.0,0.0 38.0,9.0L38.0,25.0Q38.0,34.0 29.0,34.0L9.0,34.0Q0.0,34.0 0.0,25.0Z" fill="#fffffe"/></g><g transform="translate(54 35)" opacity="0.7"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L26.0,0.0Q30.0,0.0 30.0,4.0L30.0,4.0Q30.0,8.0 26.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g>', "g.chapter": '<g transform="translate(14 104)" opacity="0.7"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L110.0,0.0Q116.0,0.0 116.0,6.0L116.0,6.0Q116.0,12.0 110.0,12.0L6.0,12.0Q0.0,12.0 0.0,6.0Z" fill="#fffffd"/></g><g transform="translate(14 104)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L52.0,0.0Q58.0,0.0 58.0,6.0L58.0,6.0Q58.0,12.0 52.0,12.0L6.0,12.0Q0.0,12.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(52 24)"><path d="M23.0,62.8Q20.0,68.0 17.0,62.8L3.0,39.2Q0.0,34.0 0.0,28.0L0.0,22.0Q0.0,16.0 3.3,11.0L4.7,9.0Q8.0,4.0 13.7,2.1L14.3,1.9Q20.0,0.0 25.7,1.9L26.3,2.1Q32.0,4.0 35.3,9.0L36.7,11.0Q40.0,16.0 40.0,22.0L40.0,28.0Q40.0,34.0 37.0,39.2Z" fill="#fffffe"/></g><g transform="translate(63 35)" opacity="0.75"><path d="M18.0,9.0L17.9,10.0L17.8,11.0L17.5,12.0L17.1,12.9L16.6,13.8L16.0,14.6L15.4,15.4L14.6,16.0L13.8,16.6L12.9,17.1L12.0,17.5L11.0,17.8L10.0,17.9L9.0,18.0L8.0,17.9L7.0,17.8L6.0,17.5L5.1,17.1L4.2,16.6L3.4,16.0L2.6,15.4L2.0,14.6L1.4,13.8L0.9,12.9L0.5,12.0L0.2,11.0L0.1,10.0L0.0,9.0L0.1,8.0L0.2,7.0L0.5,6.0L0.9,5.1L1.4,4.2L2.0,3.4L2.6,2.6L3.4,2.0L4.2,1.4L5.1,0.9L6.0,0.5L7.0,0.2L8.0,0.1L9.0,0.0L10.0,0.1L11.0,0.2L12.0,0.5L12.9,0.9L13.8,1.4L14.6,2.0L15.4,2.6L16.0,3.4L16.6,4.2L17.1,5.1L17.5,6.0L17.8,7.0L17.9,8.0Z" fill="#0e1017"/></g>', "g.statsCard": '<g transform="translate(12 24)"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L108.0,0.0Q120.0,0.0 120.0,12.0L120.0,84.0Q120.0,96.0 108.0,96.0L12.0,96.0Q0.0,96.0 0.0,84.0Z" fill="none" stroke="#fffffe" stroke-width="8" stroke-linejoin="round"/></g><g transform="translate(30 72)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,27.0Q14.0,30.0 11.0,30.0L3.0,30.0Q0.0,30.0 0.0,27.0Z" fill="#fffffe"/></g><g transform="translate(52 56)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,43.0Q14.0,46.0 11.0,46.0L3.0,46.0Q0.0,46.0 0.0,43.0Z" fill="#fffffe"/></g><g transform="translate(74 82)" opacity="0.8"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,17.0Q14.0,20.0 11.0,20.0L3.0,20.0Q0.0,20.0 0.0,17.0Z" fill="#fffffd"/></g><g transform="translate(96 46)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L11.0,0.0Q14.0,0.0 14.0,3.0L14.0,53.0Q14.0,56.0 11.0,56.0L3.0,56.0Q0.0,56.0 0.0,53.0Z" fill="#fffffe"/></g><g transform="translate(30 38)" opacity="0.75"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L50.0,0.0Q54.0,0.0 54.0,4.0L54.0,4.0Q54.0,8.0 50.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g>', "g.sponsor": '<g transform="translate(36 88)" opacity="0.8"><path d="M16.8,0.9Q14.0,0.0 13.1,2.9L0.9,41.1Q0.0,44.0 2.7,42.7L17.3,35.3Q20.0,34.0 21.6,36.5L28.4,47.5Q30.0,50.0 30.6,47.1L37.4,10.9Q38.0,8.0 35.2,7.1Z" fill="#fffffd"/></g><g transform="translate(70 88)" opacity="0.8"><path d="M21.2,0.9Q24.0,0.0 24.9,2.9L37.1,41.1Q38.0,44.0 35.3,42.7L20.7,35.3Q18.0,34.0 16.4,36.5L9.6,47.5Q8.0,50.0 7.4,47.1L0.6,10.9Q0.0,8.0 2.8,7.1Z" fill="#fffffd"/></g><g transform="translate(26 16)"><path d="M46.0,0.0L55.3,11.2L69.0,6.2L71.5,20.5L85.8,23.0L80.8,36.7L92.0,46.0L80.8,55.3L85.8,69.0L71.5,71.5L69.0,85.8L55.3,80.8L46.0,92.0L36.7,80.8L23.0,85.8L20.5,71.5L6.2,69.0L11.2,55.3L0.0,46.0L11.2,36.7L6.2,23.0L20.5,20.5L23.0,6.2L36.7,11.2Z" fill="#fffffe"/></g><g transform="translate(50 40)" opacity="0.55"><path d="M44.0,22.0L43.9,24.5L43.4,26.9L42.8,29.3L41.8,31.5L40.6,33.7L39.2,35.7L37.6,37.6L35.7,39.2L33.7,40.6L31.5,41.8L29.3,42.8L26.9,43.4L24.5,43.9L22.0,44.0L19.5,43.9L17.1,43.4L14.7,42.8L12.5,41.8L10.3,40.6L8.3,39.2L6.4,37.6L4.8,35.7L3.4,33.7L2.2,31.5L1.2,29.3L0.6,26.9L0.1,24.5L0.0,22.0L0.1,19.5L0.6,17.1L1.2,14.7L2.2,12.5L3.4,10.3L4.8,8.3L6.4,6.4L8.3,4.8L10.3,3.4L12.5,2.2L14.7,1.2L17.1,0.6L19.5,0.1L22.0,0.0L24.5,0.1L26.9,0.6L29.3,1.2L31.5,2.2L33.7,3.4L35.7,4.8L37.6,6.4L39.2,8.3L40.6,10.3L41.8,12.5L42.8,14.7L43.4,17.1L43.9,19.5Z" fill="#0e1017"/></g><g transform="translate(59.64 49)"><path d="M12.4,0.0L15.9,8.1L24.7,9.0L18.1,14.9L20.0,23.5L12.4,19.0L4.7,23.5L6.7,14.9L0.0,9.0L8.8,8.1Z" fill="#fffffe"/></g>', "g.rundown": '<g transform="translate(14 30)"><path d="M0.0,4.0Q0.0,0.0 3.4,2.1L16.6,9.9Q20.0,12.0 16.6,14.1L3.4,21.9Q0.0,24.0 0.0,20.0Z" fill="#fffffe"/></g><g transform="translate(44 34)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L80.0,0.0Q86.0,0.0 86.0,6.0L86.0,10.0Q86.0,16.0 80.0,16.0L6.0,16.0Q0.0,16.0 0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(44 64)" opacity="0.8"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L80.0,0.0Q86.0,0.0 86.0,6.0L86.0,8.0Q86.0,14.0 80.0,14.0L6.0,14.0Q0.0,14.0 0.0,8.0Z" fill="#fffffd"/></g><g transform="translate(44 92)" opacity="0.6"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L60.0,0.0Q66.0,0.0 66.0,6.0L66.0,8.0Q66.0,14.0 60.0,14.0L6.0,14.0Q0.0,14.0 0.0,8.0Z" fill="#fffffd"/></g><g transform="translate(44 118)" opacity="0.45"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L70.0,0.0Q76.0,0.0 76.0,6.0L76.0,6.0Q76.0,12.0 70.0,12.0L6.0,12.0Q0.0,12.0 0.0,6.0Z" fill="#fffffd"/></g>', "g.countdown": '<g transform="translate(26 34)"><path d="M92.0,46.0L91.7,51.2L90.8,56.2L89.4,61.2L87.4,66.0L84.9,70.5L82.0,74.7L78.5,78.5L74.7,82.0L70.5,84.9L66.0,87.4L61.2,89.4L56.2,90.8L51.2,91.7L46.0,92.0L40.8,91.7L35.8,90.8L30.8,89.4L26.0,87.4L21.5,84.9L17.3,82.0L13.5,78.5L10.0,74.7L7.1,70.5L4.6,66.0L2.6,61.2L1.2,56.2L0.3,51.2L0.0,46.0L0.3,40.8L1.2,35.8L2.6,30.8L4.6,26.0L7.1,21.5L10.0,17.3L13.5,13.5L17.3,10.0L21.5,7.1L26.0,4.6L30.8,2.6L35.8,1.2L40.8,0.3L46.0,0.0L51.2,0.3L56.2,1.2L61.2,2.6L66.0,4.6L70.5,7.1L74.7,10.0L78.5,13.5L82.0,17.3L84.9,21.5L87.4,26.0L89.4,30.8L90.8,35.8L91.7,40.8Z" fill="none" stroke="#fffffe" stroke-width="10" stroke-linejoin="round"/></g><g transform="translate(62 14)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L16.0,0.0Q20.0,0.0 20.0,4.0L20.0,10.0Q20.0,14.0 16.0,14.0L4.0,14.0Q0.0,14.0 0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(52.5 60.5) rotate(-90 19.5 4.5)"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L34.5,0.0Q39.0,0.0 39.0,4.5L39.0,4.5Q39.0,9.0 34.5,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffe"/></g><g transform="translate(65.97 81.5) rotate(28.61045966596522 17.029964086141668 4.5)" opacity="0.85"><path d="M0.0,4.5Q0.0,0.0 4.5,0.0L29.6,0.0Q34.1,0.0 34.1,4.5L34.1,4.5Q34.1,9.0 29.6,9.0L4.5,9.0Q0.0,9.0 0.0,4.5Z" fill="#fffffd"/></g><g transform="translate(64 72)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g><g transform="translate(103.93 25) rotate(-45 11.071067811865476 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.1,0.0Q22.1,0.0 22.1,4.0L22.1,4.0Q22.1,8.0 18.1,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g>', "g.schedule": '<g transform="translate(18 18)"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L96.0,0.0Q108.0,0.0 108.0,12.0L108.0,96.0Q108.0,108.0 96.0,108.0L12.0,108.0Q0.0,108.0 0.0,96.0Z" fill="none" stroke="#fffffe" stroke-width="8" stroke-linejoin="round"/></g><g transform="translate(33 39)"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#fffffe"/></g><g transform="translate(56 40)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L49.0,0.0Q54.0,0.0 54.0,5.0L54.0,7.0Q54.0,12.0 49.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffe"/></g><g transform="translate(33 65)" opacity="0.8"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#fffffd"/></g><g transform="translate(56 66)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L49.0,0.0Q54.0,0.0 54.0,5.0L54.0,7.0Q54.0,12.0 49.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffd"/></g><g transform="translate(33 91)" opacity="0.8"><path d="M14.0,7.0L14.0,7.8L13.8,8.6L13.6,9.3L13.3,10.0L12.9,10.7L12.5,11.4L11.9,11.9L11.4,12.5L10.7,12.9L10.0,13.3L9.3,13.6L8.6,13.8L7.8,14.0L7.0,14.0L6.2,14.0L5.4,13.8L4.7,13.6L4.0,13.3L3.3,12.9L2.6,12.5L2.1,11.9L1.5,11.4L1.1,10.7L0.7,10.0L0.4,9.3L0.2,8.6L0.0,7.8L0.0,7.0L0.0,6.2L0.2,5.4L0.4,4.7L0.7,4.0L1.1,3.3L1.5,2.6L2.1,2.1L2.6,1.5L3.3,1.1L4.0,0.7L4.7,0.4L5.4,0.2L6.2,0.0L7.0,0.0L7.8,0.0L8.6,0.2L9.3,0.4L10.0,0.7L10.7,1.1L11.4,1.5L11.9,2.1L12.5,2.6L12.9,3.3L13.3,4.0L13.6,4.7L13.8,5.4L14.0,6.2Z" fill="#fffffd"/></g><g transform="translate(56 92)" opacity="0.49999999999999994"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L49.0,0.0Q54.0,0.0 54.0,5.0L54.0,7.0Q54.0,12.0 49.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffd"/></g>', "g.walkin": '<g transform="translate(14 8)" opacity="0.45"><path d="M28.6,5.8Q30.0,0.0 36.0,0.0L80.0,0.0Q86.0,0.0 87.4,5.8L114.6,118.2Q116.0,124.0 110.0,124.0L6.0,124.0Q0.0,124.0 1.4,118.2Z" fill="#fffffd"/></g><g transform="translate(54 40)"><path d="M36.0,18.0L35.9,20.0L35.5,22.0L35.0,23.9L34.2,25.8L33.2,27.6L32.1,29.2L30.7,30.7L29.2,32.1L27.6,33.2L25.8,34.2L23.9,35.0L22.0,35.5L20.0,35.9L18.0,36.0L16.0,35.9L14.0,35.5L12.1,35.0L10.2,34.2L8.4,33.2L6.8,32.1L5.3,30.7L3.9,29.2L2.8,27.6L1.8,25.8L1.0,23.9L0.5,22.0L0.1,20.0L0.0,18.0L0.1,16.0L0.5,14.0L1.0,12.1L1.8,10.2L2.8,8.4L3.9,6.8L5.3,5.3L6.8,3.9L8.4,2.8L10.2,1.8L12.1,1.0L14.0,0.5L16.0,0.1L18.0,0.0L20.0,0.1L22.0,0.5L23.9,1.0L25.8,1.8L27.6,2.8L29.2,3.9L30.7,5.3L32.1,6.8L33.2,8.4L34.2,10.2L35.0,12.1L35.5,14.0L35.9,16.0Z" fill="#fffffe"/></g><g transform="translate(40 90)"><path d="M11.2,36.0Q0.0,36.0 2.0,25.0L2.4,23.1Q4.0,14.0 10.0,7.0L10.0,7.0Q16.0,0.0 25.2,0.0L38.8,0.0Q48.0,0.0 54.0,7.0L54.0,7.0Q60.0,14.0 61.6,23.1L62.0,25.0Q64.0,36.0 52.8,36.0Z" fill="#fffffe"/></g>', "g.storyline": '<g transform="translate(14 22)"><path d="M0.0,14.0Q0.0,0.0 14.0,0.0L102.0,0.0Q116.0,0.0 116.0,14.0L116.0,60.0Q116.0,74.0 102.0,74.0L70.0,74.0Q56.0,74.0 46.1,83.9L39.3,90.7Q30.0,100.0 32.0,87.0L32.0,87.0Q34.0,74.0 20.8,74.0L14.0,74.0Q0.0,74.0 0.0,60.0Z" fill="#fffffe"/></g><g transform="translate(32 42)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L75.0,0.0Q80.0,0.0 80.0,5.0L80.0,5.0Q80.0,10.0 75.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#0e1017"/></g><g transform="translate(32 62)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L51.0,0.0Q56.0,0.0 56.0,5.0L56.0,5.0Q56.0,10.0 51.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#0e1017"/></g>', "g.evstats": '<g transform="translate(16 84)" opacity="0.8"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.0,0.0Q22.0,0.0 22.0,4.0L22.0,36.0Q22.0,40.0 18.0,40.0L4.0,40.0Q0.0,40.0 0.0,36.0Z" fill="#fffffd"/></g><g transform="translate(46 60)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.0,0.0Q22.0,0.0 22.0,4.0L22.0,60.0Q22.0,64.0 18.0,64.0L4.0,64.0Q0.0,64.0 0.0,60.0Z" fill="#fffffe"/></g><g transform="translate(76 74)" opacity="0.8"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.0,0.0Q22.0,0.0 22.0,4.0L22.0,46.0Q22.0,50.0 18.0,50.0L4.0,50.0Q0.0,50.0 0.0,46.0Z" fill="#fffffd"/></g><g transform="translate(106 40)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.0,0.0Q22.0,0.0 22.0,4.0L22.0,80.0Q22.0,84.0 18.0,84.0L4.0,84.0Q0.0,84.0 0.0,80.0Z" fill="#fffffe"/></g><g transform="translate(3.87 34) rotate(97.59464336859145 18.132745950421555 3)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L33.3,0.0Q36.3,0.0 36.3,3.0L36.3,3.0Q36.3,6.0 33.3,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffe"/></g><g transform="translate(19.87 34) rotate(97.59464336859145 18.132745950421555 3)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L33.3,0.0Q36.3,0.0 36.3,3.0L36.3,3.0Q36.3,6.0 33.3,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffe"/></g><g transform="translate(11 29)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L35.0,0.0Q38.0,0.0 38.0,3.0L38.0,3.0Q38.0,6.0 35.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffe"/></g><g transform="translate(9 41)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L35.0,0.0Q38.0,0.0 38.0,3.0L38.0,3.0Q38.0,6.0 35.0,6.0L3.0,6.0Q0.0,6.0 0.0,3.0Z" fill="#fffffe"/></g>', "g.season": '<g transform="translate(18 22)"><path d="M2.0,12.0Q0.0,12.0 1.1,10.3L6.9,1.7Q8.0,0.0 9.4,1.4L14.6,6.6Q16.0,8.0 17.4,6.6L22.6,1.4Q24.0,0.0 25.1,1.7L30.9,10.3Q32.0,12.0 30.0,12.0Z" fill="#fffffe"/></g><g transform="translate(14 40)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L35.0,0.0Q40.0,0.0 40.0,5.0L40.0,9.0Q40.0,14.0 35.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffe"/></g><g transform="translate(60 40)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L65.0,0.0Q70.0,0.0 70.0,5.0L70.0,9.0Q70.0,14.0 65.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffe"/></g><g transform="translate(14 66)" opacity="0.8"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L35.0,0.0Q40.0,0.0 40.0,5.0L40.0,9.0Q40.0,14.0 35.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(60 66)" opacity="0.8"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L65.0,0.0Q70.0,0.0 70.0,5.0L70.0,9.0Q70.0,14.0 65.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(14 92)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L35.0,0.0Q40.0,0.0 40.0,5.0L40.0,9.0Q40.0,14.0 35.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(60 92)" opacity="0.6"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L65.0,0.0Q70.0,0.0 70.0,5.0L70.0,9.0Q70.0,14.0 65.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#fffffd"/></g><g transform="translate(14 118)" opacity="0.4"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L112.0,0.0Q116.0,0.0 116.0,4.0L116.0,4.0Q116.0,8.0 112.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g>', "g.rehearsal": '<g transform="translate(16 56)"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L102.0,0.0Q112.0,0.0 112.0,10.0L112.0,60.0Q112.0,70.0 102.0,70.0L10.0,70.0Q0.0,70.0 0.0,60.0Z" fill="#fffffe"/></g><g transform="translate(16 14)" opacity="0.85"><path d="M0.8,17.9Q0.0,12.0 6.0,11.3L102.0,0.7Q108.0,0.0 108.8,5.9L111.2,24.1Q112.0,30.0 106.0,30.7L10.0,41.3Q4.0,42.0 3.2,36.1Z" fill="#fffffd"/></g><g transform="translate(29.57 33.5) rotate(68.96248897457819 17.42838827718412 3.5)" opacity="0.7"><path d="M0.0,3.5Q0.0,0.0 3.5,0.0L31.4,0.0Q34.9,0.0 34.9,3.5L34.9,3.5Q34.9,7.0 31.4,7.0L3.5,7.0Q0.0,7.0 0.0,3.5Z" fill="#0e1017"/></g><g transform="translate(61.57 29.5) rotate(68.96248897457819 17.42838827718412 3.5)" opacity="0.7"><path d="M0.0,3.5Q0.0,0.0 3.5,0.0L31.4,0.0Q34.9,0.0 34.9,3.5L34.9,3.5Q34.9,7.0 31.4,7.0L3.5,7.0Q0.0,7.0 0.0,3.5Z" fill="#0e1017"/></g><g transform="translate(90.9 25.5) rotate(72.89727103094764 17.101470508735446 3.5)" opacity="0.7"><path d="M0.0,3.5Q0.0,0.0 3.5,0.0L30.7,0.0Q34.2,0.0 34.2,3.5L34.2,3.5Q34.2,7.0 30.7,7.0L3.5,7.0Q0.0,7.0 0.0,3.5Z" fill="#0e1017"/></g>', "g.slowmo": '<g transform="translate(58 36)"><path d="M0.0,9.0Q0.0,0.0 7.5,5.0L46.5,31.0Q54.0,36.0 46.5,41.0L7.5,67.0Q0.0,72.0 0.0,63.0Z" fill="#fffffe"/></g><g transform="translate(12 46)" opacity="0.7"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L32.0,0.0Q36.0,0.0 36.0,4.0L36.0,4.0Q36.0,8.0 32.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g><g transform="translate(6 68)" opacity="0.85"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L38.0,0.0Q42.0,0.0 42.0,4.0L42.0,4.0Q42.0,8.0 38.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g><g transform="translate(12 90)" opacity="0.7"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L32.0,0.0Q36.0,0.0 36.0,4.0L36.0,4.0Q36.0,8.0 32.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g><g transform="translate(116.37 34.3)" opacity="0.5"><path d="M5.3,1.1L8.7,5.6L11.7,10.4L14.2,15.6L16.1,20.9L17.5,26.4L18.3,32.0L18.6,37.7L18.3,43.4L17.5,49.0L16.1,54.5L14.2,59.8L11.7,65.0L8.7,69.8L5.3,74.3L4.6,75.0L3.7,75.3L2.8,75.4L1.9,75.2L1.1,74.7L0.4,74.0L0.1,73.1L0.0,72.2L0.2,71.3L0.7,70.5L3.8,66.4L6.4,62.1L8.6,57.5L10.4,52.7L11.6,47.8L12.4,42.8L12.6,37.7L12.4,32.6L11.6,27.6L10.4,22.7L8.6,17.9L6.4,13.3L3.8,9.0L0.7,4.9L0.2,4.1L0.0,3.2L0.1,2.3L0.4,1.4L1.1,0.7L1.9,0.2L2.8,0.0L3.7,0.1L4.6,0.4Z" fill="#fffffd"/></g>', "g.freeze": '<g transform="translate(14 22)"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L104.0,0.0Q116.0,0.0 116.0,12.0L116.0,88.0Q116.0,100.0 104.0,100.0L12.0,100.0Q0.0,100.0 0.0,88.0Z" fill="none" stroke="#fffffe" stroke-width="8" stroke-linejoin="round"/></g><g transform="translate(48 44)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L11.0,0.0Q16.0,0.0 16.0,5.0L16.0,51.0Q16.0,56.0 11.0,56.0L5.0,56.0Q0.0,56.0 0.0,51.0Z" fill="#fffffe"/></g><g transform="translate(80 44)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L11.0,0.0Q16.0,0.0 16.0,5.0L16.0,51.0Q16.0,56.0 11.0,56.0L5.0,56.0Q0.0,56.0 0.0,51.0Z" fill="#fffffe"/></g><g transform="translate(17.01 33.5) rotate(45 10.985281374238571 2.5)" opacity="0.7"><path d="M0.0,2.5Q0.0,0.0 2.5,0.0L19.5,0.0Q22.0,0.0 22.0,2.5L22.0,2.5Q22.0,5.0 19.5,5.0L2.5,5.0Q0.0,5.0 0.0,2.5Z" fill="#fffffd"/></g><g transform="translate(105.01 105.5) rotate(-135 10.985281374238571 2.5)" opacity="0.7"><path d="M0.0,2.5Q0.0,0.0 2.5,0.0L19.5,0.0Q22.0,0.0 22.0,2.5L22.0,2.5Q22.0,5.0 19.5,5.0L2.5,5.0Q0.0,5.0 0.0,2.5Z" fill="#fffffd"/></g>', "g.drawClear": '<g transform="translate(20 48)" opacity="0.85"><path d="M3.9,69.2Q0.0,70.0 0.8,66.1L3.2,53.9Q4.0,50.0 6.8,47.2L51.2,2.8Q54.0,0.0 56.8,2.8L67.2,13.2Q70.0,16.0 67.2,18.8L22.8,63.2Q20.0,66.0 16.1,66.8Z" fill="#fffffd"/></g><g transform="translate(71.72 36) rotate(45 34.2842712474619 6)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L62.6,0.0Q68.6,0.0 68.6,6.0L68.6,6.0Q68.6,12.0 62.6,12.0L6.0,12.0Q0.0,12.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(71.72 36) rotate(135 34.2842712474619 6)"><path d="M0.0,6.0Q0.0,0.0 6.0,0.0L62.6,0.0Q68.6,0.0 68.6,6.0L68.6,6.0Q68.6,12.0 62.6,12.0L6.0,12.0Q0.0,12.0 0.0,6.0Z" fill="#fffffe"/></g>', "g.clip": '<g transform="translate(46 10)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L44.0,0.0Q52.0,0.0 52.0,8.0L52.0,84.0Q52.0,92.0 44.0,92.0L8.0,92.0Q0.0,92.0 0.0,84.0Z" fill="none" stroke="#fffffe" stroke-width="7" stroke-linejoin="round"/></g><g transform="translate(28 96)"><path d="M32.0,16.0L31.9,17.8L31.6,19.6L31.1,21.3L30.4,22.9L29.5,24.5L28.5,26.0L27.3,27.3L26.0,28.5L24.5,29.5L22.9,30.4L21.3,31.1L19.6,31.6L17.8,31.9L16.0,32.0L14.2,31.9L12.4,31.6L10.7,31.1L9.1,30.4L7.5,29.5L6.0,28.5L4.7,27.3L3.5,26.0L2.5,24.5L1.6,22.9L0.9,21.3L0.4,19.6L0.1,17.8L0.0,16.0L0.1,14.2L0.4,12.4L0.9,10.7L1.6,9.1L2.5,7.5L3.5,6.0L4.7,4.7L6.0,3.5L7.5,2.5L9.1,1.6L10.7,0.9L12.4,0.4L14.2,0.1L16.0,0.0L17.8,0.1L19.6,0.4L21.3,0.9L22.9,1.6L24.5,2.5L26.0,3.5L27.3,4.7L28.5,6.0L29.5,7.5L30.4,9.1L31.1,10.7L31.6,12.4L31.9,14.2Z" fill="none" stroke="#fffffe" stroke-width="7" stroke-linejoin="round"/></g><g transform="translate(84 96)"><path d="M32.0,16.0L31.9,17.8L31.6,19.6L31.1,21.3L30.4,22.9L29.5,24.5L28.5,26.0L27.3,27.3L26.0,28.5L24.5,29.5L22.9,30.4L21.3,31.1L19.6,31.6L17.8,31.9L16.0,32.0L14.2,31.9L12.4,31.6L10.7,31.1L9.1,30.4L7.5,29.5L6.0,28.5L4.7,27.3L3.5,26.0L2.5,24.5L1.6,22.9L0.9,21.3L0.4,19.6L0.1,17.8L0.0,16.0L0.1,14.2L0.4,12.4L0.9,10.7L1.6,9.1L2.5,7.5L3.5,6.0L4.7,4.7L6.0,3.5L7.5,2.5L9.1,1.6L10.7,0.9L12.4,0.4L14.2,0.1L16.0,0.0L17.8,0.1L19.6,0.4L21.3,0.9L22.9,1.6L24.5,2.5L26.0,3.5L27.3,4.7L28.5,6.0L29.5,7.5L30.4,9.1L31.1,10.7L31.6,12.4L31.9,14.2Z" fill="none" stroke="#fffffe" stroke-width="7" stroke-linejoin="round"/></g><g transform="translate(43.98 79) rotate(-38.99099404250548 31.018512172212596 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L58.0,0.0Q62.0,0.0 62.0,4.0L62.0,4.0Q62.0,8.0 58.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g><g transform="translate(37.98 79) rotate(-141.00900595749454 31.018512172212596 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L58.0,0.0Q62.0,0.0 62.0,4.0L62.0,4.0Q62.0,8.0 58.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g>', "g.results": '<g transform="translate(14 26)" opacity="0.6"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L104.0,0.0Q116.0,0.0 116.0,12.0L116.0,80.0Q116.0,92.0 104.0,92.0L12.0,92.0Q0.0,92.0 0.0,80.0Z" fill="#fffffd"/></g><g transform="translate(43.47 36)"><path d="M28.5,0.0L36.2,19.5L57.1,20.7L40.9,34.0L46.2,54.3L28.5,43.0L10.9,54.3L16.2,34.0L0.0,20.7L20.9,19.5Z" fill="#fffffe"/></g><g transform="translate(30 100)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L80.0,0.0Q84.0,0.0 84.0,4.0L84.0,4.0Q84.0,8.0 80.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g>', "g.picks": '<g transform="translate(20 32)"><path d="M92.0,46.0L91.7,51.2L90.8,56.2L89.4,61.2L87.4,66.0L84.9,70.5L82.0,74.7L78.5,78.5L74.7,82.0L70.5,84.9L66.0,87.4L61.2,89.4L56.2,90.8L51.2,91.7L46.0,92.0L40.8,91.7L35.8,90.8L30.8,89.4L26.0,87.4L21.5,84.9L17.3,82.0L13.5,78.5L10.0,74.7L7.1,70.5L4.6,66.0L2.6,61.2L1.2,56.2L0.3,51.2L0.0,46.0L0.3,40.8L1.2,35.8L2.6,30.8L4.6,26.0L7.1,21.5L10.0,17.3L13.5,13.5L17.3,10.0L21.5,7.1L26.0,4.6L30.8,2.6L35.8,1.2L40.8,0.3L46.0,0.0L51.2,0.3L56.2,1.2L61.2,2.6L66.0,4.6L70.5,7.1L74.7,10.0L78.5,13.5L82.0,17.3L84.9,21.5L87.4,26.0L89.4,30.8L90.8,35.8L91.7,40.8Z" fill="none" stroke="#fffffe" stroke-width="10" stroke-linejoin="round"/></g><g transform="translate(44 56)"><path d="M44.0,22.0L43.9,24.5L43.4,26.9L42.8,29.3L41.8,31.5L40.6,33.7L39.2,35.7L37.6,37.6L35.7,39.2L33.7,40.6L31.5,41.8L29.3,42.8L26.9,43.4L24.5,43.9L22.0,44.0L19.5,43.9L17.1,43.4L14.7,42.8L12.5,41.8L10.3,40.6L8.3,39.2L6.4,37.6L4.8,35.7L3.4,33.7L2.2,31.5L1.2,29.3L0.6,26.9L0.1,24.5L0.0,22.0L0.1,19.5L0.6,17.1L1.2,14.7L2.2,12.5L3.4,10.3L4.8,8.3L6.4,6.4L8.3,4.8L10.3,3.4L12.5,2.2L14.7,1.2L17.1,0.6L19.5,0.1L22.0,0.0L24.5,0.1L26.9,0.6L29.3,1.2L31.5,2.2L33.7,3.4L35.7,4.8L37.6,6.4L39.2,8.3L40.6,10.3L41.8,12.5L42.8,14.7L43.4,17.1L43.9,19.5Z" fill="none" stroke="#fffffd" stroke-width="9" stroke-linejoin="round"/></g><g transform="translate(58 70)"><path d="M16.0,8.0L15.9,8.9L15.8,9.8L15.6,10.6L15.2,11.5L14.8,12.3L14.3,13.0L13.7,13.7L13.0,14.3L12.3,14.8L11.5,15.2L10.6,15.6L9.8,15.8L8.9,15.9L8.0,16.0L7.1,15.9L6.2,15.8L5.4,15.6L4.5,15.2L3.7,14.8L3.0,14.3L2.3,13.7L1.7,13.0L1.2,12.3L0.8,11.5L0.4,10.6L0.2,9.8L0.1,8.9L0.0,8.0L0.1,7.1L0.2,6.2L0.4,5.4L0.8,4.5L1.2,3.7L1.7,3.0L2.3,2.3L3.0,1.7L3.7,1.2L4.5,0.8L5.4,0.4L6.2,0.2L7.1,0.1L8.0,0.0L8.9,0.1L9.8,0.2L10.6,0.4L11.5,0.8L12.3,1.2L13.0,1.7L13.7,2.3L14.3,3.0L14.8,3.7L15.2,4.5L15.6,5.4L15.8,6.2L15.9,7.1Z" fill="#fffffe"/></g><g transform="translate(51.23 48) rotate(-45 40.76955262170048 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L77.5,0.0Q81.5,0.0 81.5,4.0L81.5,4.0Q81.5,8.0 77.5,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g><g transform="translate(108 16)"><path d="M0.0,6.0L20.0,0.0L14.0,20.0Z" fill="#fffffe"/></g>', "g.poll": '<g transform="translate(16 26)"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L83.0,0.0Q90.0,0.0 90.0,7.0L90.0,13.0Q90.0,20.0 83.0,20.0L7.0,20.0Q0.0,20.0 0.0,13.0Z" fill="#fffffe"/></g><g transform="translate(16 60)" opacity="0.8"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L55.0,0.0Q62.0,0.0 62.0,7.0L62.0,13.0Q62.0,20.0 55.0,20.0L7.0,20.0Q0.0,20.0 0.0,13.0Z" fill="#fffffd"/></g><g transform="translate(16 94)" opacity="0.6"><path d="M0.0,7.0Q0.0,0.0 7.0,0.0L31.0,0.0Q38.0,0.0 38.0,7.0L38.0,13.0Q38.0,20.0 31.0,20.0L7.0,20.0Q0.0,20.0 0.0,13.0Z" fill="#fffffd"/></g><g transform="translate(111 27)"><path d="M18.0,9.0L17.9,10.0L17.8,11.0L17.5,12.0L17.1,12.9L16.6,13.8L16.0,14.6L15.4,15.4L14.6,16.0L13.8,16.6L12.9,17.1L12.0,17.5L11.0,17.8L10.0,17.9L9.0,18.0L8.0,17.9L7.0,17.8L6.0,17.5L5.1,17.1L4.2,16.6L3.4,16.0L2.6,15.4L2.0,14.6L1.4,13.8L0.9,12.9L0.5,12.0L0.2,11.0L0.1,10.0L0.0,9.0L0.1,8.0L0.2,7.0L0.5,6.0L0.9,5.1L1.4,4.2L2.0,3.4L2.6,2.6L3.4,2.0L4.2,1.4L5.1,0.9L6.0,0.5L7.0,0.2L8.0,0.1L9.0,0.0L10.0,0.1L11.0,0.2L12.0,0.5L12.9,0.9L13.8,1.4L14.6,2.0L15.4,2.6L16.0,3.4L16.6,4.2L17.1,5.1L17.5,6.0L17.8,7.0L17.9,8.0Z" fill="#fffffe"/></g>', "g.twpred": '<g transform="translate(28 16)"><path d="M88.0,44.0L87.7,48.9L86.9,53.8L85.5,58.5L83.6,63.1L81.3,67.4L78.4,71.4L75.1,75.1L71.4,78.4L67.4,81.3L63.1,83.6L58.5,85.5L53.8,86.9L48.9,87.7L44.0,88.0L39.1,87.7L34.2,86.9L29.5,85.5L24.9,83.6L20.6,81.3L16.6,78.4L12.9,75.1L9.6,71.4L6.7,67.4L4.4,63.1L2.5,58.5L1.1,53.8L0.3,48.9L0.0,44.0L0.3,39.1L1.1,34.2L2.5,29.5L4.4,24.9L6.7,20.6L9.6,16.6L12.9,12.9L16.6,9.6L20.6,6.7L24.9,4.4L29.5,2.5L34.2,1.1L39.1,0.3L44.0,0.0L48.9,0.3L53.8,1.1L58.5,2.5L63.1,4.4L67.4,6.7L71.4,9.6L75.1,12.9L78.4,16.6L81.3,20.6L83.6,24.9L85.5,29.5L86.9,34.2L87.7,39.1Z" fill="#fffffe"/></g><g transform="translate(46 36)" opacity="0.3"><path d="M20.0,10.0L19.9,11.1L19.7,12.2L19.4,13.3L19.0,14.3L18.5,15.3L17.8,16.2L17.1,17.1L16.2,17.8L15.3,18.5L14.3,19.0L13.3,19.4L12.2,19.7L11.1,19.9L10.0,20.0L8.9,19.9L7.8,19.7L6.7,19.4L5.7,19.0L4.7,18.5L3.8,17.8L2.9,17.1L2.2,16.2L1.5,15.3L1.0,14.3L0.6,13.3L0.3,12.2L0.1,11.1L0.0,10.0L0.1,8.9L0.3,7.8L0.6,6.7L1.0,5.7L1.5,4.7L2.2,3.8L2.9,2.9L3.8,2.2L4.7,1.5L5.7,1.0L6.7,0.6L7.8,0.3L8.9,0.1L10.0,0.0L11.1,0.1L12.2,0.3L13.3,0.6L14.3,1.0L15.3,1.5L16.2,2.2L17.1,2.9L17.8,3.8L18.5,4.7L19.0,5.7L19.4,6.7L19.7,7.8L19.9,8.9Z" fill="#0e1017"/></g><g transform="translate(26 102)" opacity="0.85"><path d="M9.5,5.4Q12.0,0.0 18.0,0.0L74.0,0.0Q80.0,0.0 82.5,5.4L89.5,20.6Q92.0,26.0 86.0,26.0L6.0,26.0Q0.0,26.0 2.5,20.6Z" fill="#fffffd"/></g>', "g.music": '<g transform="translate(46 26)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L9.0,0.0Q12.0,0.0 12.0,3.0L12.0,73.0Q12.0,76.0 9.0,76.0L3.0,76.0Q0.0,76.0 0.0,73.0Z" fill="#fffffe"/></g><g transform="translate(96 16)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L9.0,0.0Q12.0,0.0 12.0,3.0L12.0,73.0Q12.0,76.0 9.0,76.0L3.0,76.0Q0.0,76.0 0.0,73.0Z" fill="#fffffe"/></g><g transform="translate(46 12)"><path d="M0.0,17.0Q0.0,14.0 2.9,13.3L59.1,0.7Q62.0,0.0 62.0,3.0L62.0,19.0Q62.0,22.0 59.1,22.7L2.9,35.3Q0.0,36.0 0.0,33.0Z" fill="#fffffe"/></g><g transform="translate(24 88)"><path d="M32.0,16.0L31.9,17.8L31.6,19.6L31.1,21.3L30.4,22.9L29.5,24.5L28.5,26.0L27.3,27.3L26.0,28.5L24.5,29.5L22.9,30.4L21.3,31.1L19.6,31.6L17.8,31.9L16.0,32.0L14.2,31.9L12.4,31.6L10.7,31.1L9.1,30.4L7.5,29.5L6.0,28.5L4.7,27.3L3.5,26.0L2.5,24.5L1.6,22.9L0.9,21.3L0.4,19.6L0.1,17.8L0.0,16.0L0.1,14.2L0.4,12.4L0.9,10.7L1.6,9.1L2.5,7.5L3.5,6.0L4.7,4.7L6.0,3.5L7.5,2.5L9.1,1.6L10.7,0.9L12.4,0.4L14.2,0.1L16.0,0.0L17.8,0.1L19.6,0.4L21.3,0.9L22.9,1.6L24.5,2.5L26.0,3.5L27.3,4.7L28.5,6.0L29.5,7.5L30.4,9.1L31.1,10.7L31.6,12.4L31.9,14.2Z" fill="#fffffe"/></g><g transform="translate(74 78)"><path d="M32.0,16.0L31.9,17.8L31.6,19.6L31.1,21.3L30.4,22.9L29.5,24.5L28.5,26.0L27.3,27.3L26.0,28.5L24.5,29.5L22.9,30.4L21.3,31.1L19.6,31.6L17.8,31.9L16.0,32.0L14.2,31.9L12.4,31.6L10.7,31.1L9.1,30.4L7.5,29.5L6.0,28.5L4.7,27.3L3.5,26.0L2.5,24.5L1.6,22.9L0.9,21.3L0.4,19.6L0.1,17.8L0.0,16.0L0.1,14.2L0.4,12.4L0.9,10.7L1.6,9.1L2.5,7.5L3.5,6.0L4.7,4.7L6.0,3.5L7.5,2.5L9.1,1.6L10.7,0.9L12.4,0.4L14.2,0.1L16.0,0.0L17.8,0.1L19.6,0.4L21.3,0.9L22.9,1.6L24.5,2.5L26.0,3.5L27.3,4.7L28.5,6.0L29.5,7.5L30.4,9.1L31.1,10.7L31.6,12.4L31.9,14.2Z" fill="#fffffe"/></g>', "g.duck": '<g transform="translate(18 32)"><path d="M0.0,30.0Q0.0,24.0 6.0,24.0L14.0,24.0Q20.0,24.0 24.4,19.9L41.6,4.1Q46.0,0.0 46.0,6.0L46.0,74.0Q46.0,80.0 41.6,75.9L24.4,60.1Q20.0,56.0 14.0,56.0L6.0,56.0Q0.0,56.0 0.0,50.0Z" fill="#fffffe"/></g><g transform="translate(64 56) rotate(90 36 5)" opacity="0.9"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L67.0,0.0Q72.0,0.0 72.0,5.0L72.0,5.0Q72.0,10.0 67.0,10.0L5.0,10.0Q0.0,10.0 0.0,5.0Z" fill="#fffffd"/></g><g transform="translate(81.4 78)"><path d="M20.5,26.9Q18.6,30.0 16.7,26.9L1.9,3.1Q0.0,0.0 3.6,0.0L33.6,0.0Q37.2,0.0 35.3,3.1Z" fill="#fffffe"/></g>', "g.ext": '<g transform="translate(22 20)"><path d="M0.0,28.0Q0.0,20.0 8.0,20.0L29.0,20.0Q34.0,20.0 34.0,15.0L34.0,15.0Q34.0,10.0 37.1,6.1L38.0,5.0Q42.0,0.0 48.4,0.0L51.6,0.0Q58.0,0.0 62.0,5.0L62.9,6.1Q66.0,10.0 66.0,15.0L66.0,15.0Q66.0,20.0 71.0,20.0L92.0,20.0Q100.0,20.0 100.0,28.0L100.0,49.0Q100.0,54.0 95.0,54.0L95.0,54.0Q90.0,54.0 86.1,57.1L85.0,58.0Q80.0,62.0 80.0,68.4L80.0,69.6Q80.0,76.0 85.0,80.0L86.1,80.9Q90.0,84.0 95.0,84.0L95.0,84.0Q100.0,84.0 100.0,89.0L100.0,96.0Q100.0,104.0 92.0,104.0L8.0,104.0Q0.0,104.0 0.0,96.0Z" fill="#fffffe"/></g>', "b.show": '<g transform="translate(110 0)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L31.0,0.0Q34.0,0.0 34.0,3.0L34.0,23.0Q34.0,26.0 31.0,26.0L10.5,26.0Q7.5,26.0 5.9,23.5L1.6,16.8Q0.0,14.3 0.0,11.3Z" fill="#fffffe"/></g><g transform="translate(118 4)"><path d="M0.0,2.0Q0.0,0.0 2.0,0.0L18.0,0.0Q20.0,0.0 20.0,2.0L20.0,2.0Q20.0,4.0 18.0,4.0L2.0,4.0Q0.0,4.0 0.0,2.0Z" fill="#0e1017"/></g><g transform="translate(118 11)"><path d="M0.0,2.0Q0.0,0.0 2.0,0.0L12.0,0.0Q14.0,0.0 14.0,2.0L14.0,2.0Q14.0,4.0 12.0,4.0L2.0,4.0Q0.0,4.0 0.0,2.0Z" fill="#0e1017"/></g><g transform="translate(118 18)"><path d="M0.0,2.0Q0.0,0.0 2.0,0.0L16.0,0.0Q18.0,0.0 18.0,2.0L18.0,2.0Q18.0,4.0 16.0,4.0L2.0,4.0Q0.0,4.0 0.0,2.0Z" fill="#0e1017"/></g>', "g.cdPlus": '<g transform="translate(16 52)"><path d="M72.0,36.0L71.8,40.0L71.1,44.0L70.0,47.9L68.4,51.6L66.5,55.2L64.1,58.4L61.5,61.5L58.4,64.1L55.2,66.5L51.6,68.4L47.9,70.0L44.0,71.1L40.0,71.8L36.0,72.0L32.0,71.8L28.0,71.1L24.1,70.0L20.4,68.4L16.8,66.5L13.6,64.1L10.5,61.5L7.9,58.4L5.5,55.2L3.6,51.6L2.0,47.9L0.9,44.0L0.2,40.0L0.0,36.0L0.2,32.0L0.9,28.0L2.0,24.1L3.6,20.4L5.5,16.8L7.9,13.6L10.5,10.5L13.6,7.9L16.8,5.5L20.4,3.6L24.1,2.0L28.0,0.9L32.0,0.2L36.0,0.0L40.0,0.2L44.0,0.9L47.9,2.0L51.6,3.6L55.2,5.5L58.4,7.9L61.5,10.5L64.1,13.6L66.5,16.8L68.4,20.4L70.0,24.1L71.1,28.0L71.8,32.0Z" fill="none" stroke="#fffffe" stroke-width="9" stroke-linejoin="round"/></g><g transform="translate(45 38)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L10.0,0.0Q14.0,0.0 14.0,4.0L14.0,7.0Q14.0,11.0 10.0,11.0L4.0,11.0Q0.0,11.0 0.0,7.0Z" fill="#fffffe"/></g><g transform="translate(37 73) rotate(-90 15 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L26.0,0.0Q30.0,0.0 30.0,4.0L30.0,4.0Q30.0,8.0 26.0,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g><g transform="translate(46.82 88.5) rotate(29.357753542791272 13.17877987534291 4)" opacity="0.85"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L22.4,0.0Q26.4,0.0 26.4,4.0L26.4,4.0Q26.4,8.0 22.4,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffd"/></g><g transform="translate(46 82)"><path d="M12.0,6.0L12.0,6.7L11.8,7.3L11.7,8.0L11.4,8.6L11.1,9.2L10.7,9.7L10.2,10.2L9.7,10.7L9.2,11.1L8.6,11.4L8.0,11.7L7.3,11.8L6.7,12.0L6.0,12.0L5.3,12.0L4.7,11.8L4.0,11.7L3.4,11.4L2.8,11.1L2.3,10.7L1.8,10.2L1.3,9.7L0.9,9.2L0.6,8.6L0.3,8.0L0.2,7.3L0.0,6.7L0.0,6.0L0.0,5.3L0.2,4.7L0.3,4.0L0.6,3.4L0.9,2.8L1.3,2.3L1.8,1.8L2.3,1.3L2.8,0.9L3.4,0.6L4.0,0.3L4.7,0.2L5.3,0.0L6.0,0.0L6.7,0.0L7.3,0.2L8.0,0.3L8.6,0.6L9.2,0.9L9.7,1.3L10.2,1.8L10.7,2.3L11.1,2.8L11.4,3.4L11.7,4.0L11.8,4.7L12.0,5.3Z" fill="#fffffe"/></g><g transform="translate(70 40)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L35.0,0.0Q40.0,0.0 40.0,5.0L40.0,7.0Q40.0,12.0 35.0,12.0L5.0,12.0Q0.0,12.0 0.0,7.0Z" fill="#fffffe"/></g><g transform="translate(84 26)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L7.0,0.0Q12.0,0.0 12.0,5.0L12.0,35.0Q12.0,40.0 7.0,40.0L5.0,40.0Q0.0,40.0 0.0,35.0Z" fill="#fffffe"/></g>', "g.moments": '<g transform="translate(14 58)" opacity="0.6"><path d="M0.0,12.0Q0.0,0.0 12.0,0.0L104.0,0.0Q116.0,0.0 116.0,12.0L116.0,50.0Q116.0,62.0 104.0,62.0L12.0,62.0Q0.0,62.0 0.0,50.0Z" fill="#fffffd"/></g><g transform="translate(30 74)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L41.0,0.0Q46.0,0.0 46.0,5.0L46.0,6.0Q46.0,11.0 41.0,11.0L5.0,11.0Q0.0,11.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(30 94)"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L79.0,0.0Q84.0,0.0 84.0,5.0L84.0,6.0Q84.0,11.0 79.0,11.0L5.0,11.0Q0.0,11.0 0.0,6.0Z" fill="#fffffe"/></g><g transform="translate(78 14)"><path d="M26.0,0.0L33.1,18.9L52.0,26.0L33.1,33.1L26.0,52.0L18.9,33.1L0.0,26.0L18.9,18.9Z" fill="#fffffe"/></g>', "g.momentReplay": '<g transform="translate(23.28 22.52)"><path d="M0.3,33.9L2.4,28.9L5.0,24.2L8.1,19.9L11.6,15.8L15.5,12.1L19.8,8.9L24.3,6.1L29.2,3.8L34.2,2.1L39.4,0.8L44.8,0.1L50.1,0.0L55.4,0.4L60.7,1.4L65.8,2.9L70.8,5.0L75.5,7.5L79.9,10.5L84.0,14.0L87.7,17.9L91.0,22.1L93.8,26.6L96.2,31.5L98.0,36.5L99.3,41.7L100.0,47.0L100.2,52.3L99.8,57.7L98.9,63.0L97.5,68.1L95.5,73.1L93.0,77.8L90.0,82.3L86.6,86.4L82.7,90.1L78.5,93.5L74.0,96.3L69.2,98.7L64.2,100.6L59.0,101.9L53.7,102.7L48.4,103.0L43.0,102.7L37.7,101.8L32.6,100.4L27.6,98.4L22.8,96.0L18.3,93.1L14.2,89.7L10.4,85.9L7.0,81.7L4.1,77.2L3.5,75.6L3.4,73.9L3.9,72.2L4.8,70.8L6.1,69.7L7.7,69.1L9.5,69.0L11.1,69.5L12.6,70.4L13.6,71.7L15.9,75.3L18.6,78.5L21.6,81.5L24.8,84.2L28.4,86.5L32.1,88.4L36.0,89.9L40.1,91.1L44.2,91.7L48.5,92.0L52.7,91.8L56.8,91.2L60.9,90.1L64.8,88.6L68.6,86.8L72.2,84.5L75.5,81.9L78.5,78.9L81.2,75.7L83.5,72.2L85.5,68.5L87.1,64.6L88.2,60.5L88.9,56.4L89.2,52.2L89.1,48.0L88.5,43.8L87.5,39.7L86.0,35.7L84.2,31.9L82.0,28.4L79.4,25.0L76.5,22.0L73.3,19.3L69.8,16.9L66.1,14.9L62.2,13.3L58.2,12.1L54.0,11.3L49.8,11.0L45.6,11.1L41.4,11.6L37.3,12.6L33.3,14.0L29.5,15.8L25.9,18.0L22.6,20.5L19.5,23.4L16.8,26.6L14.3,30.1L12.3,33.8L10.7,37.6L9.8,39.1L8.6,40.3L7.0,41.0L5.3,41.2L3.6,40.9L2.1,40.1L0.9,38.8L0.2,37.3L0.0,35.6Z" fill="#fffffe"/></g><g transform="translate(8.77 37.41)"><path d="M14.5,28.1Q12.2,30.6 11.0,27.5L1.2,3.1Q0.0,0.0 3.3,0.6L30.9,5.4Q34.2,6.0 32.0,8.5Z" fill="#fffffe"/></g><g transform="translate(48 50)" opacity="0.95"><path d="M24.0,0.0L30.4,17.6L48.0,24.0L30.4,30.4L24.0,48.0L17.6,30.4L0.0,24.0L17.6,17.6Z" fill="#fffffd"/></g>', "g.h2h": '<g transform="translate(19 23)"><path d="M34.0,17.0L33.9,18.9L33.6,20.8L33.0,22.6L32.3,24.4L31.4,26.0L30.3,27.6L29.0,29.0L27.6,30.3L26.0,31.4L24.4,32.3L22.6,33.0L20.8,33.6L18.9,33.9L17.0,34.0L15.1,33.9L13.2,33.6L11.4,33.0L9.6,32.3L8.0,31.4L6.4,30.3L5.0,29.0L3.7,27.6L2.6,26.0L1.7,24.4L1.0,22.6L0.4,20.8L0.1,18.9L0.0,17.0L0.1,15.1L0.4,13.2L1.0,11.4L1.7,9.6L2.6,8.0L3.7,6.4L5.0,5.0L6.4,3.7L8.0,2.6L9.6,1.7L11.4,1.0L13.2,0.4L15.1,0.1L17.0,0.0L18.9,0.1L20.8,0.4L22.6,1.0L24.4,1.7L26.0,2.6L27.6,3.7L29.0,5.0L30.3,6.4L31.4,8.0L32.3,9.6L33.0,11.4L33.6,13.2L33.9,15.1Z" fill="#fffffe"/></g><g transform="translate(10 64)"><path d="M7.3,26.0Q0.0,26.0 2.0,19.0L2.0,19.0Q4.0,12.0 9.1,6.9L10.0,6.0Q16.0,0.0 24.5,0.0L27.5,0.0Q36.0,0.0 42.0,6.0L42.9,6.9Q48.0,12.0 50.0,19.0L50.0,19.0Q52.0,26.0 44.7,26.0Z" fill="#fffffe"/></g><g transform="translate(91 23)" opacity="0.85"><path d="M34.0,17.0L33.9,18.9L33.6,20.8L33.0,22.6L32.3,24.4L31.4,26.0L30.3,27.6L29.0,29.0L27.6,30.3L26.0,31.4L24.4,32.3L22.6,33.0L20.8,33.6L18.9,33.9L17.0,34.0L15.1,33.9L13.2,33.6L11.4,33.0L9.6,32.3L8.0,31.4L6.4,30.3L5.0,29.0L3.7,27.6L2.6,26.0L1.7,24.4L1.0,22.6L0.4,20.8L0.1,18.9L0.0,17.0L0.1,15.1L0.4,13.2L1.0,11.4L1.7,9.6L2.6,8.0L3.7,6.4L5.0,5.0L6.4,3.7L8.0,2.6L9.6,1.7L11.4,1.0L13.2,0.4L15.1,0.1L17.0,0.0L18.9,0.1L20.8,0.4L22.6,1.0L24.4,1.7L26.0,2.6L27.6,3.7L29.0,5.0L30.3,6.4L31.4,8.0L32.3,9.6L33.0,11.4L33.6,13.2L33.9,15.1Z" fill="#fffffd"/></g><g transform="translate(82 64)" opacity="0.85"><path d="M7.3,26.0Q0.0,26.0 2.0,19.0L2.0,19.0Q4.0,12.0 9.1,6.9L10.0,6.0Q16.0,0.0 24.5,0.0L27.5,0.0Q36.0,0.0 42.0,6.0L42.9,6.9Q48.0,12.0 50.0,19.0L50.0,19.0Q52.0,26.0 44.7,26.0Z" fill="#fffffd"/></g><g transform="translate(63 42)"><path d="M0.0,3.0Q0.0,0.0 3.0,0.0L15.0,0.0Q18.0,0.0 18.0,3.0L18.0,5.0Q18.0,8.0 15.0,8.0L3.0,8.0Q0.0,8.0 0.0,5.0Z" fill="#fffffe"/></g><g transform="translate(14 104)"><path d="M0.0,8.0Q0.0,0.0 8.0,0.0L108.0,0.0Q116.0,0.0 116.0,8.0L116.0,10.0Q116.0,18.0 108.0,18.0L8.0,18.0Q0.0,18.0 0.0,10.0Z" fill="#fffffe"/></g>', "g.setTimer": '<g transform="translate(26 34)"><path d="M92.0,46.0L91.7,51.2L90.8,56.2L89.4,61.2L87.4,66.0L84.9,70.5L82.0,74.7L78.5,78.5L74.7,82.0L70.5,84.9L66.0,87.4L61.2,89.4L56.2,90.8L51.2,91.7L46.0,92.0L40.8,91.7L35.8,90.8L30.8,89.4L26.0,87.4L21.5,84.9L17.3,82.0L13.5,78.5L10.0,74.7L7.1,70.5L4.6,66.0L2.6,61.2L1.2,56.2L0.3,51.2L0.0,46.0L0.3,40.8L1.2,35.8L2.6,30.8L4.6,26.0L7.1,21.5L10.0,17.3L13.5,13.5L17.3,10.0L21.5,7.1L26.0,4.6L30.8,2.6L35.8,1.2L40.8,0.3L46.0,0.0L51.2,0.3L56.2,1.2L61.2,2.6L66.0,4.6L70.5,7.1L74.7,10.0L78.5,13.5L82.0,17.3L84.9,21.5L87.4,26.0L89.4,30.8L90.8,35.8L91.7,40.8Z" fill="none" stroke="#fffffe" stroke-width="10" stroke-linejoin="round"/></g><g transform="translate(62 14)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L16.0,0.0Q20.0,0.0 20.0,4.0L20.0,10.0Q20.0,14.0 16.0,14.0L4.0,14.0Q0.0,14.0 0.0,10.0Z" fill="#fffffe"/></g><g transform="translate(103.93 25) rotate(-45 11.071067811865476 4)"><path d="M0.0,4.0Q0.0,0.0 4.0,0.0L18.1,0.0Q22.1,0.0 22.1,4.0L22.1,4.0Q22.1,8.0 18.1,8.0L4.0,8.0Q0.0,8.0 0.0,4.0Z" fill="#fffffe"/></g><g transform="translate(60 60)"><path d="M0.0,6.0Q0.0,0.0 5.2,3.0L28.8,17.0Q34.0,20.0 28.8,23.0L5.2,37.0Q0.0,40.0 0.0,34.0Z" fill="#fffffe"/></g>', "g.statsStrip": '<g transform="translate(14 24)" opacity="0.55"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L106.0,0.0Q116.0,0.0 116.0,10.0L116.0,36.0Q116.0,46.0 106.0,46.0L10.0,46.0Q0.0,46.0 0.0,36.0Z" fill="#fffffd"/></g><g transform="translate(56 30)" opacity="0.85"><path d="M0.7,2.9Q0.0,0.0 3.0,0.0L29.0,0.0Q32.0,0.0 31.3,2.9L24.7,31.1Q24.0,34.0 21.0,34.0L11.0,34.0Q8.0,34.0 7.3,31.1Z" fill="#fffffd"/></g><g transform="translate(10 86)"><path d="M0.0,10.0Q0.0,0.0 10.0,0.0L114.0,0.0Q124.0,0.0 124.0,10.0L124.0,28.0Q124.0,38.0 114.0,38.0L10.0,38.0Q0.0,38.0 0.0,28.0Z" fill="#fffffe"/></g><g transform="translate(22 98)" opacity="0.55"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L21.0,0.0Q26.0,0.0 26.0,5.0L26.0,9.0Q26.0,14.0 21.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#0e1017"/></g><g transform="translate(58 98)" opacity="0.8"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L23.0,0.0Q28.0,0.0 28.0,5.0L28.0,9.0Q28.0,14.0 23.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#0e1017"/></g><g transform="translate(96 98)" opacity="0.55"><path d="M0.0,5.0Q0.0,0.0 5.0,0.0L21.0,0.0Q26.0,0.0 26.0,5.0L26.0,9.0Q26.0,14.0 21.0,14.0L5.0,14.0Q0.0,14.0 0.0,9.0Z" fill="#0e1017"/></g>', "g.gresetSplash": '<g transform="translate(28.92 36.5)"><path d="M0.3,29.9L2.1,25.7L4.4,21.6L7.0,17.8L10.0,14.3L13.3,11.1L17.0,8.2L20.9,5.8L25.1,3.7L29.4,2.1L33.9,0.9L38.5,0.2L43.1,0.0L47.7,0.2L52.3,0.9L56.8,2.1L61.1,3.7L65.3,5.8L69.2,8.2L72.8,11.1L76.2,14.3L79.2,17.8L81.8,21.6L84.0,25.7L85.8,29.9L86.2,31.6L86.0,33.3L85.2,34.9L84.1,36.2L82.6,37.0L80.9,37.3L79.2,37.1L77.6,36.4L76.3,35.2L75.5,33.7L74.1,30.5L72.4,27.4L70.5,24.5L68.2,21.8L65.6,19.4L62.9,17.2L59.9,15.4L56.7,13.8L53.5,12.6L50.1,11.7L46.6,11.2L43.1,11.0L39.6,11.2L36.1,11.7L32.7,12.6L29.4,13.8L26.3,15.4L23.3,17.2L20.5,19.4L18.0,21.8L15.7,24.5L13.7,27.4L12.0,30.5L10.7,33.7L9.8,35.2L8.6,36.4L7.0,37.1L5.3,37.3L3.6,37.0L2.1,36.2L0.9,34.9L0.2,33.3L0.0,31.6Z" fill="#fffffe"/></g><g transform="translate(77.42 45.04)"><path d="M29.1,24.2Q30.6,27.0 27.5,27.1L3.1,27.8Q0.0,27.9 1.6,25.2L14.6,2.7Q16.1,0.0 17.6,2.7Z" fill="#fffffe"/></g><g transform="translate(28.92 90.18)" opacity="0.85"><path d="M85.8,7.4L84.0,11.6L81.8,15.7L79.2,19.5L76.2,23.0L72.8,26.2L69.2,29.1L65.3,31.5L61.1,33.6L56.8,35.2L52.3,36.4L47.7,37.1L43.1,37.3L38.5,37.1L33.9,36.4L29.4,35.2L25.1,33.6L20.9,31.5L17.0,29.1L13.3,26.2L10.0,23.0L7.0,19.5L4.4,15.7L2.1,11.6L0.3,7.4L0.0,5.7L0.2,4.0L0.9,2.4L2.1,1.2L3.6,0.3L5.3,0.0L7.0,0.2L8.6,0.9L9.8,2.1L10.7,3.6L12.0,6.8L13.7,9.9L15.7,12.8L18.0,15.5L20.5,17.9L23.3,20.1L26.3,21.9L29.4,23.5L32.7,24.7L36.1,25.6L39.6,26.1L43.1,26.3L46.6,26.1L50.1,25.6L53.5,24.7L56.7,23.5L59.9,21.9L62.9,20.1L65.6,17.9L68.2,15.5L70.5,12.8L72.4,9.9L74.1,6.8L75.5,3.6L76.3,2.1L77.6,0.9L79.2,0.2L80.9,0.0L82.6,0.3L84.1,1.2L85.2,2.4L86.0,4.0L86.2,5.7Z" fill="#fffffd"/></g><g transform="translate(36 91.04)" opacity="0.85"><path d="M1.5,3.7Q0.0,1.0 3.1,0.9L27.5,0.1Q30.6,0.0 29.0,2.7L16.0,25.2Q14.5,27.9 13.0,25.2Z" fill="#fffffd"/></g><g transform="translate(48 22)"><path d="M3.0,18.0Q0.0,18.0 1.5,15.4L8.5,2.6Q10.0,0.0 12.1,2.1L21.9,11.9Q24.0,14.0 26.1,11.9L35.9,2.1Q38.0,0.0 39.5,2.6L46.5,15.4Q48.0,18.0 45.0,18.0Z" fill="#fffffe"/></g>' };
  }
});

// src/art.js
var require_art = __commonJS({
  "src/art.js"(exports2, module2) {
    "use strict";
    var VT = "#7c3aed";
    var VT2 = "#c3a2ff";
    var P1 = "#e63950";
    var P2 = "#2f8bff";
    var BEE = "#ffb020";
    var INK = "#0e1017";
    var SYNC = "#29c6ff";
    var TW = "#9146ff";
    var TW2 = "#c3a2ff";
    var OKG = "#35dc84";
    var FONT = `font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif"`;
    var esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    var fit = (text, max, big, small) => {
      const n = String(text).length;
      return n <= max ? big : Math.max(small, Math.round(big * max / n));
    };
    var short = (s, n) => {
      s = String(s || "").trim();
      return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
    };
    var sideColor = (side) => Number(side) === 2 ? P2 : P1;
    function frame(inner2, { bg = INK, accent = null, dim = false } = {}) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="${bg}"/>` + (accent ? `<rect width="144" height="10" fill="${accent}"/>` : "") + inner2 + (dim ? `<rect width="144" height="144" fill="rgba(0,0,0,.6)"/><text x="72" y="134" ${FONT} font-size="15" font-weight="800" fill="#ff8a8a" text-anchor="middle" letter-spacing="1">APP OFFLINE</text>` : "") + `</svg>`;
    }
    var label = (t, y = 128, size = 17, fill = "#fff", ls = 1.5) => `<text x="72" y="${y}" ${FONT} font-size="${size}" font-weight="800" fill="${fill}" text-anchor="middle" letter-spacing="${ls}">${esc(t)}</text>`;
    var DA = require_designer_art();
    var MAIN = "#fffffe";
    var SOFT = "#fffffd";
    function glyph(name, c = "#fff", soft) {
      const g = DA["g." + name] || "";
      if (c === "#fff" && !soft) return g;
      return g.split(MAIN).join(c).split(SOFT).join(soft || c);
    }
    var ICONS = {
      cube3d: (c, s2) => glyph("cube3d", c, s2),
      speaker: (c, on = true) => glyph(on ? "speaker" : "speakerOff", c),
      reset: (c, s2) => glyph("reset", c, s2),
      swap: (c, s2) => glyph("swap", c, s2),
      undo: (c, s2) => glyph("undo", c, s2),
      next: (c, s2) => glyph("next", c, s2),
      clear: (c, s2) => glyph("clear", c, s2),
      layout: (c, s2) => glyph("layout", c, s2),
      screen: (c, s2) => glyph("screen", c, s2),
      bracket: (c, s2) => glyph("bracket", c, s2),
      refresh: (c, s2) => glyph("resync", c, s2),
      pull: (c, s2) => glyph("pull", c, s2),
      upload: (c, s2) => glyph("upload", c, s2),
      eye: (c, s2) => glyph("eye", c, s2),
      bolt: (c, s2) => glyph("bolt", c, s2),
      trophy: (c, s2) => glyph("trophy", c, s2),
      twitch: (c, s2) => glyph("chat", c, s2),
      mic: (c, s2) => glyph("mic", c, s2),
      leader: (c, s2) => glyph("leader", c, s2),
      swords: (c, s2) => glyph("swords", c, s2),
      board: (c, s2) => glyph("board", c, s2),
      crown: (c, s2) => glyph("crown", c, s2),
      pencil: (c, s2) => glyph("pencil", c, s2),
      person: (c, s2) => glyph("person", c, s2),
      personPlus: (c, s2) => glyph("personPlus", c, s2),
      vs: (c, s2) => glyph("vs", c, s2),
      plus1: (c, s2) => glyph("plus1", c, s2),
      podium: (c, s2) => glyph("podium", c, s2),
      top8: (c, s2) => glyph("top8", c, s2),
      loser: (c, s2) => glyph("loser", c, s2),
      chatLink: (c, s2) => glyph("chatLink", c, s2),
      chatNext: (c, s2) => glyph("chatNext", c, s2),
      queue: (c, s2) => glyph("queue", c, s2),
      sidebar: (c, s2) => glyph("sidebar", c, s2),
      scan: (c, s2) => glyph("scan", c, s2),
      switchArrows: (c, s2) => glyph("switchArrows", c, s2),
      lock: (c, s2) => glyph("lock", c, s2),
      unlock: (c, s2) => glyph("unlock", c, s2),
      tempo: (c, s2) => glyph("tempo", c, s2),
      pilot: (c, s2) => glyph("pilot", c, s2),
      replay: (c, s2) => glyph("replay", c, s2),
      ticket: (c, s2) => glyph("ticket", c, s2),
      formatBar: (c, s2) => glyph("formatBar", c, s2),
      flow: (c, s2) => glyph("flow", c, s2),
      chapter: (c, s2) => glyph("chapter", c, s2),
      statsCard: (c, s2) => glyph("statsCard", c, s2),
      sponsor: (c, s2) => glyph("sponsor", c, s2),
      // 1.12.16
      // 1.12.18: the show
      ...Object.fromEntries([
        "rundown",
        "countdown",
        "schedule",
        "walkin",
        "storyline",
        "evstats",
        "season",
        "rehearsal",
        "slowmo",
        "freeze",
        "drawClear",
        "clip",
        "results",
        "picks",
        "poll",
        "twpred",
        "music",
        "duck",
        "ext",
        "cdPlus",
        "moments",
        "momentReplay",
        "h2h",
        "setTimer",
        "statsStrip",
        "gresetSplash"
      ].map((n) => [n, (c, s2) => glyph(n, c, s2)])),
      // 1.12.21: the set as it's told
      confirm: (c, s2) => glyph("confirm", c, s2),
      controller: (c, s2) => glyph("controller", c, s2),
      sides: (c, s2) => glyph("sides", c, s2),
      hexLife: (c, s2) => glyph("hexLife", c, s2)
    };
    var art2 = {
      score({ side = 1, name = "", score = 0, mode = "tapHold", offline = false } = {}) {
        const c = sideColor(side), n = short(name || `Player ${side}`, 12);
        const hint = mode === "subtract" ? "\u22121" : mode === "add" ? "+1" : "TAP +1 \xB7 HOLD \u22121";
        return frame(
          `<rect width="144" height="144" fill="${c}" opacity=".22"/><text x="72" y="30" ${FONT} font-size="${fit(n, 9, 19, 12)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text><text x="72" y="104" ${FONT} font-size="${String(score).length > 1 ? 68 : 82}" font-weight="900" fill="#fff" text-anchor="middle">${esc(score)}</text>` + label(hint, 132, mode === "tapHold" ? 11 : 18, "rgba(255,255,255,.75)", mode === "tapHold" ? 0 : 1),
          { accent: c, dim: offline }
        );
      },
      reset: ({ offline, hint } = {}) => frame(`<g transform="translate(18,${hint ? 2 : 8}) scale(.75)">${ICONS.reset("#fff")}</g>` + (hint ? label("RESET", 114, 16) + label(hint, 134, 11, "rgba(255,255,255,.6)", 1) : label("RESET")), { accent: BEE, dim: offline }),
      swap: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.swap("#fff")}</g>` + label("SWAP"), { accent: BEE, dim: offline }),
      // Electrocute 1P / 2P: a bolt in the player's colour, crackling
      undo: ({ offline, label: l } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.undo("#fff")}</g>` + label(l || "UNDO", 128, l ? 14 : 17), { accent: BEE, dim: offline }),
      // 1.12.3: Hide all — every splash off at once (lit while anything full-screen is up)
      hideAll: ({ on = false, offline = false } = {}) => frame(`<g transform="translate(24,4) scale(.66)">${glyph("hideAll", on ? "#29c6ff" : "#fff")}</g>` + label("HIDE ALL", 116, 16, "#fff", 2) + label(on ? "SPLASH UP" : "NOTHING UP", 135, 11, on ? "#7fe0ff" : "rgba(255,255,255,.5)", 1.5), { dim: offline }),
      nextmatch: ({ offline, label: l } = {}) => frame(`<g transform="translate(6,-12) scale(.92)">${ICONS.next(BEE)}</g>` + label(l || "NEXT MATCH", 130, 15), { dim: offline }),
      clear: ({ offline } = {}) => frame(`<g transform="translate(14,2) scale(.8)">${ICONS.clear("#fff")}</g>` + label("NEXT SET", 130, 16), { accent: BEE, dim: offline }),
      // FullVS (1.12.6's name for the VS Splash)
      vs({ on = false, hint = "", offline = false } = {}) {
        const g = hint ? `<g transform="translate(30,6) scale(.6)">` : `<g transform="translate(22,10) scale(.7)">`;
        return on ? frame(`${g}${ICONS.vs(INK)}</g>` + label("ON AIR", hint ? 112 : 128, 16, INK, 3) + (hint ? label(hint, 132, 10, "rgba(14,16,23,.7)", 1) : ""), { bg: BEE, dim: offline }) : frame(`${g}${ICONS.vs("#fff")}</g>` + label("FULLVS", hint ? 112 : 128, 16, "#fff", 2) + (hint ? label(hint, 132, 10, "rgba(255,255,255,.5)", 1) : ""), { dim: offline });
      },
      // 1.12.10: the layout's stinger over the stream, now (between two OBS scenes, on a big moment)
      stinger({ offline = false } = {}) {
        return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.bolt("#fff")}</g>` + label("STINGER", 104, 16, "#fff", 2) + label("PLAY IT NOW", 128, 10, "rgba(255,255,255,.5)", 1.2), { dim: offline });
      },
      // the commentary screen (1.12.6): lit while on stream; shows how many cameras are live
      comm({ on = false, live = 0, offline = false } = {}) {
        return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.mic(on ? INK : "#fff")}</g>` + label(on ? "ON AIR" : "COMMENTARY", 104, on ? 16 : 13, on ? INK : "#fff", 1.5) + label(live ? `${live} ${live === 1 ? "CAMERA" : "CAMERAS"} LIVE` : "NO CAMERAS", 128, 10, on ? "rgba(14,16,23,.7)" : "rgba(255,255,255,.5)", 1.2), { bg: on ? BEE : void 0, dim: offline });
      },
      // which VS the VS button plays: FullVS or GlassVS (a tap switches)
      vsStyle({ glass = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,8) scale(.5)">${ICONS.switchArrows("#fff", glass ? "#9fd8ff" : BEE)}</g>` + label("VS STYLE", 96, 12, "rgba(255,255,255,.6)", 2) + label(glass ? "GLASSVS" : "FULLVS", 122, 18, glass ? "#9fd8ff" : BEE, 1.5), { dim: offline });
      },
      player({ side = 1, name = "", offline = false } = {}) {
        const c = sideColor(side), n = short(name || "Set name", 12);
        return frame(`<g transform="translate(36,14) scale(.5)">${ICONS.person("#fff")}</g><text x="72" y="104" ${FONT} font-size="${fit(n, 8, 22, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text>` + label(`PLAYER ${side}`, 132, 13, "rgba(255,255,255,.7)", 1.5) + `<g transform="translate(${side === 1 ? 104 : 108},121) scale(.11)">${ICONS.pencil("rgba(255,255,255,.7)")}</g>`, { accent: c, dim: offline });
      },
      bracket({ on = false, offline = false, label: l } = {}) {
        return on ? frame(`<g transform="translate(16,6) scale(.76)">${ICONS.bracket(INK)}</g>` + label("ON AIR", 130, 16, INK, 3), { bg: BEE, dim: offline }) : frame(`<g transform="translate(16,6) scale(.76)">${ICONS.bracket("#fff")}</g>` + label(l || "BRACKET", 130, l ? 13 : 16, "rgba(255,255,255,.75)", l ? 1 : 2), { accent: BEE, dim: offline });
      },
      // Refresh bracket: cyan "pull from start.gg" key: a small bracket with a download arrow dropping into a tray
      bracketRefresh({ busy = false, label: l, offline = false } = {}) {
        const done = l === "UPDATED", col = busy ? BEE : done ? "#3ddc84" : SYNC;
        return frame(`<rect y="10" width="144" height="134" fill="${SYNC}" opacity=".1"/><g transform="translate(10,20) scale(.42)">${ICONS.bracket("rgba(255,255,255,.55)")}</g><g transform="translate(58,16) scale(.6)">${ICONS.pull(col)}</g>` + label(busy ? "SYNCING\u2026" : l || "GET RESULTS", 130, 14, busy ? BEE : done ? "#3ddc84" : "#fff", 1.2), { accent: col, dim: offline });
      },
      // Victory splash: a gold trophy; lit gold while it's on stream, dim until someone has won the set
      victory({ on = false, ready = false, offline = false } = {}) {
        const GOLD = "#f6c453";
        return on ? frame(`<g transform="translate(22,6) scale(.7)">${ICONS.trophy(INK)}</g>` + label("ON AIR", 130, 16, INK, 3), { bg: GOLD, dim: offline }) : frame(`<g transform="translate(22,6) scale(.7)" opacity="${ready ? 1 : 0.45}">${ICONS.trophy(GOLD)}</g>` + label(ready ? "VICTORY" : "NO WINNER", 130, ready ? 16 : 13, ready ? "#fff" : "rgba(255,255,255,.55)", 2), { accent: GOLD, dim: offline });
      },
      // Bracket side: W / L tabs; the side on stream lights up. Press flips it (or shows the bracket on Losers)
      bracketSide({ side = "W", on = false, paged = true, offline = false, label: l } = {}) {
        const tab = (x, t, lit) => `<rect x="${x}" y="20" width="52" height="40" rx="6" fill="${lit ? BEE : "none"}" stroke="${lit ? BEE : "rgba(255,255,255,.4)"}" stroke-width="3"/><text x="${x + 26}" y="51" ${FONT} font-size="28" font-weight="900" font-style="italic" fill="${lit ? INK : "rgba(255,255,255,.6)"}" text-anchor="middle">${t}</text>`;
        const live = on && paged, big = l ? l : !on ? "LOSERS" : !paged ? "ONE PAGE" : side === "L" ? "LOSERS" : "WINNERS";
        return frame(tab(14, "W", live && side === "W") + tab(78, "L", live && side === "L") + `<text x="72" y="98" ${FONT} font-size="${fit(big, 7, 25, 15)}" font-weight="900" fill="${live ? "#fff" : "rgba(255,255,255,.85)"}" text-anchor="middle" letter-spacing="1">${esc(big)}</text>` + label(!on ? "SHOW SIDE" : !paged ? "NO SIDES" : "TAP TO FLIP", 130, 13, live ? BEE : "rgba(255,255,255,.6)", 2), { accent: BEE, dim: offline });
      },
      latency({ viewers = 0, worst = null, offline = false } = {}) {
        const col = worst == null ? "rgba(255,255,255,.55)" : worst < 100 ? "#3ddc84" : worst < 250 ? "#9ee34b" : worst < 600 ? BEE : "#ff5d6c";
        const ms = worst == null ? "\u2014" : worst >= 1e3 ? (worst / 1e3).toFixed(1) + "s" : String(worst);
        return frame(`<g transform="translate(14,4) scale(.36)">${ICONS.eye("#fff")}</g><text x="84" y="44" ${FONT} font-size="30" font-weight="900" fill="#fff" text-anchor="start">${viewers}</text><text x="72" y="104" ${FONT} font-size="${ms.length > 4 ? 40 : 50}" font-weight="900" fill="${col}" text-anchor="middle">${esc(ms)}</text>` + label(worst == null ? "LATENCY" : "MS \xB7 SLOWEST", 132, 12, "rgba(255,255,255,.65)", 1.2), { accent: col === "rgba(255,255,255,.55)" ? "#555a66" : col, dim: offline });
      },
      postlink({ ready = false, offline = false, flash = false } = {}) {
        const C = "#9147ff";
        return frame(`<g transform="translate(18,6) scale(.75)" opacity="${ready || flash ? 1 : 0.45}">${ICONS.chatLink(flash ? "#fff" : ready ? "#fff" : "#8d919d", flash ? "#fff" : ready ? C : "#3a3d48")}</g>` + label(flash ? "POSTED" : ready ? "POST LINK" : "NOT SHARED", 132, ready ? 15 : 12, ready || flash ? "#fff" : "rgba(255,255,255,.45)", 1.5), { bg: flash ? C : "#0a0a0e", dim: offline });
      },
      sggReport({ ready = false, sent = false, mode = "ask", offline = false, flash = false } = {}) {
        const C = "#4f7dff", on = ready || sent;
        return frame(`<g transform="translate(20,4) scale(.72)">${ICONS.upload(flash || sent ? "#fff" : on ? "#fff" : "rgba(255,255,255,.4)", flash || sent ? "#fff" : on ? C : "rgba(255,255,255,.25)")}</g>` + label(flash ? "SENT!" : sent ? "REPORTED" : ready ? "REPORT" : mode === "off" ? "REPORTS OFF" : "NO RESULT", 132, on ? 15 : 12, on ? "#fff" : "rgba(255,255,255,.45)", 1.5), { bg: sent ? "#1c3fa8" : "#0a0a0e", dim: offline });
      },
      standings({ on = false, ready = false, offline = false } = {}) {
        const GOLD = "#f2c14e";
        return frame(
          `<g transform="translate(20,2) scale(.72)" opacity="${on || ready ? 1 : 0.5}">${ICONS.podium(on ? "#fff" : GOLD, on ? "rgba(255,255,255,.75)" : "#6b6f7c")}</g>` + label(on ? "ON AIR" : ready ? "STANDINGS" : "NO RESULTS", 132, ready || on ? 15 : 12, on ? "#fff" : ready ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.45)", 1.5),
          { bg: on ? "#c3132d" : "#0a0a0e", dim: offline }
        );
      },
      top8({ on = false, offline = false, label: l } = {}) {
        const CR = "#e0263f";
        const body = `<g transform="translate(34,14) scale(.66)">${ICONS.top8(on ? "#fff" : "#fff", on ? "rgba(255,255,255,.5)" : CR)}</g><text x="30" y="40" ${FONT} font-size="20" font-weight="900" font-style="italic" fill="${on ? "#fff" : "#e8eaf0"}" text-anchor="middle" letter-spacing="2">TOP</text>` + label(on ? "ON AIR" : l || "SPLASH", 132, l && !on ? 13 : 16, on ? "#fff" : "rgba(255,255,255,.7)", on ? 3 : l ? 1 : 2);
        const bg = on ? "" : `<defs><radialGradient id="t8g" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#5a0812"/><stop offset="1" stop-color="#0a0a0e"/></radialGradient></defs><rect width="144" height="144" fill="url(#t8g)"/>`;
        return frame(bg + body, { bg: on ? CR : "#0a0a0e", dim: offline });
      },
      loser({ side = 1, on = false, offline = false } = {}) {
        const c = sideColor(side);
        return frame(`<g transform="translate(26,8) scale(.64)">${ICONS.loser(on ? INK : "#fff", on ? INK : c)}</g>` + label(`PLAYER ${side}`, 128, 15, on ? INK : "rgba(255,255,255,.7)", 2), { bg: on ? c : INK, accent: on ? null : c, dim: offline });
      },
      // ---- viewer matches (Twitch Stuff)
      viewerNext({ next = "", count = 0, busy = false, offline = false } = {}) {
        const n = short(next || "", 12);
        return frame(`<g transform="translate(16,10) scale(.5)">${ICONS.chatNext("#fff")}</g><text x="132" y="50" ${FONT} font-size="28" font-weight="900" fill="#fff" text-anchor="end">${count}</text><text x="72" y="104" ${FONT} font-size="${n ? fit(n, 9, 19, 12) : 14}" font-weight="800" fill="${n ? "#fff" : "rgba(255,255,255,.55)"}" text-anchor="middle">${esc(n || "QUEUE EMPTY")}</text>` + label(busy ? "LOADING\u2026" : "NEXT VIEWER", 132, 13, TW2, 1.5), { dim: offline });
      },
      viewerResult({ who = "streamer", s = 0, v = 0, playing = true, offline = false } = {}) {
        const me = who !== "viewer", col = me ? OKG : TW2;
        return frame(`<rect y="10" width="144" height="134" fill="${me ? OKG : TW}" opacity=".12"/><text x="72" y="44" ${FONT} font-size="17" font-weight="800" fill="${col}" text-anchor="middle" letter-spacing="1.5">${me ? "I WON" : "THEY WON"}</text><text x="72" y="100" ${FONT} font-size="${playing ? 48 : 26}" font-weight="900" fill="#fff" text-anchor="middle">${playing ? `${s}\u2013${v}` : "NO MATCH"}</text>` + label("TAP +1 \xB7 HOLD \u22121", 132, 11, "rgba(255,255,255,.7)", 0), { accent: col, dim: offline });
      },
      viewerQueue({ open = false, count = 0, offline = false } = {}) {
        return open ? frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="${INK}" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="44" font-weight="900" fill="${INK}" text-anchor="middle">OPEN</text>` + label(`${count} WAITING`, 130, 14, INK, 1.5), { bg: OKG, dim: offline }) : frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="rgba(255,255,255,.7)" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="31" font-weight="900" fill="#fff" text-anchor="middle">CLOSED</text>` + label(count ? `${count} WAITING` : "TAP TO OPEN", 130, 13, "rgba(255,255,255,.6)", 1.5), { accent: TW, dim: offline });
      },
      viewerSidebar({ on = true, offline = false } = {}) {
        return on ? frame(`<g transform="translate(26,6) scale(.64)">${ICONS.sidebar("#fff")}</g>` + label("ON SCREEN", 128, 15, "#fff", 2), { bg: TW, dim: offline }) : frame(`<g transform="translate(26,6) scale(.64)" opacity=".55">${ICONS.sidebar("#fff")}</g>` + label("SIDEBAR OFF", 128, 13, "rgba(255,255,255,.7)", 1.5), { dim: offline });
      },
      viewerSplash({ on = false, ready = true, offline = false } = {}) {
        return on ? frame(`<g transform="translate(22,10) scale(.7)">${ICONS.vs("#fff")}</g>` + label("ON AIR", 128, 16, "#fff", 3), { bg: TW, dim: offline }) : frame(`<g transform="translate(22,10) scale(.7)" opacity="${ready ? 1 : 0.4}">${ICONS.vs("#fff")}</g>` + label(ready ? "VIEWER VS" : "NO MATCH", 128, 14, ready ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.45)", 1.5), { dim: offline });
      },
      // game formats: the confirm key shows the score of the battle and lights up green when a result is waiting
      formatNext({ score = "", label: l = "", pending = false, done = false, none = false, offline = false } = {}) {
        const t = none ? "NO FORMAT" : done ? "FINISHED" : short(score || "\u2014", 9);
        return frame(`<text x="72" y="${none || done ? 74 : 80}" ${FONT} font-size="${none || done ? 20 : fit(t, 5, 44, 22)}" font-weight="900" fill="${pending ? INK : "#fff"}" text-anchor="middle">${esc(t)}</text>` + (l ? `<text x="72" y="30" ${FONT} font-size="13" font-weight="700" fill="${pending ? INK : "rgba(255,255,255,.6)"}" text-anchor="middle">${esc(short(l, 18))}</text>` : "") + label(pending ? "CONFIRM \u203A" : "NEXT MATCH", 128, 15, pending ? INK : "rgba(255,255,255,.7)", 1.5), { bg: pending ? OKG : void 0, dim: offline });
      },
      // 1.12.5: the team formats' Player VS (the lock-in splash): lit while it's up
      // GlassVS (the lock-in VS; 1.12.5's Player VS) — any match since 1.12.6
      playerVs({ on = false, hint = "", offline = false } = {}) {
        return on ? frame(`<g transform="translate(30,8) scale(.6)">${ICONS.swords(INK)}</g>` + label("GLASSVS", 112, 16, INK, 1.5) + label(hint || "ON AIR", 132, hint ? 10 : 12, INK, hint ? 1 : 2), { bg: BEE, dim: offline }) : frame(`<g transform="translate(30,8) scale(.6)">${ICONS.swords("#fff")}</g>` + label("GLASSVS", 112, 16, "#fff", 1.5) + label(hint || "SHOW", 132, hint ? 10 : 11, "rgba(255,255,255,.55)", 1.5), { dim: offline });
      },
      // 1.12.5: Team Death Battle — lock in the fighters picked for this battle (closes the switch window)
      // 1.12.13: once locked (until the next set is recorded) the same key undoes it — PRESS TO UNDO
      formatLock({ open = false, none = false, undo = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,6) scale(.5)">${ICONS.lock(open ? "#fff" : undo ? BEE : "#5d616c")}</g>` + label(undo ? "LOCKED" : "LOCK IN", 112, 18, open || undo ? "#fff" : "#8d919d", 2) + label(none ? "NO TEAM DEATH BATTLE" : open ? "PICKS READY?" : undo ? "PRESS TO UNDO" : "LOCKED", 132, none ? 9 : 11, open || undo ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.45)", 1.2), { dim: offline });
      },
      // 1.12.16: run an automation (picked in the key's settings) — lit while it runs
      automation({ name = "", running = false, missing = false, offline = false } = {}) {
        const n = String(name || "AUTOMATION").toUpperCase(), short2 = n.length > 13 ? n.slice(0, 12) + "\u2026" : n;
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.flow(running ? INK : missing ? "#5d616c" : BEE)}</g>` + label(running ? "RUNNING" : "RUN", 112, 16, running ? INK : "#fff", 2) + label(missing ? "PICK ONE" : short2, 132, short2.length > 10 ? 9 : 11, running ? "rgba(14,16,23,.75)" : "rgba(255,255,255,.65)", 1.2), { bg: running ? BEE : void 0, dim: offline });
      },
      // 1.12.16: mark a VOD chapter now — says MARKED for a moment
      chapter({ flash = "", offline = false } = {}) {
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.chapter(flash ? "#fff" : BEE)}</g>` + label(flash || "CHAPTER", 112, flash ? 18 : 15, "#fff", 2) + label(flash ? "IN THE VOD" : "MARK NOW", 132, 10, "rgba(255,255,255,.6)", 1.6), { dim: offline });
      },
      // 1.12.16: the caster stats card for one player — lit while it's on stream
      stats({ side = 1, name = "", on = false, offline = false } = {}) {
        const n = String(name || `PLAYER ${side}`).toUpperCase(), short2 = n.length > 12 ? n.slice(0, 11) + "\u2026" : n;
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.statsCard(on ? INK : "#fff")}</g>` + label(on ? "ON AIR" : "STATS", 112, 16, on ? INK : "#fff", 2) + label(short2, 132, short2.length > 9 ? 10 : 12, on ? "rgba(14,16,23,.75)" : "rgba(255,255,255,.65)", 1.2), { bg: on ? BEE : void 0, dim: offline });
      },
      // 1.12.16: sponsors — tap: the next one now · hold: the rotation on / off
      sponsor({ on = false, none = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.sponsor(none ? "#5d616c" : on ? BEE : "#8d919d")}</g>` + label(none ? "SPONSORS" : "SPONSOR", 112, 15, none ? "#8d919d" : "#fff", 1.6) + label(none ? "NONE ADDED" : on ? "NEXT \xB7 HOLD: OFF" : "OFF \xB7 HOLD: ON", 132, 9, "rgba(255,255,255,.6)", 1.2), { dim: offline });
      },
      // 1.12.15: instant replay
      replay({ offline = false } = {}) {
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.replay(BEE)}</g>` + label("REPLAY", 112, 17, "#fff", 2) + label("FROM OBS", 132, 10, "rgba(255,255,255,.6)", 1.6), { dim: offline });
      },
      // 1.12.15: Run of show — on/off, and what it's doing
      autopilot({ on = false, running = false, step = "", offline = false } = {}) {
        const S = { victory: "VICTORY", "after victory": "VICTORY", stinger: "STINGER", bracket: "BRACKET", "next match": "NEXT MATCH", "back to the scoreboard": "SCOREBOARD", paused: "PAUSED", done: "WAITING" };
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.pilot(on ? BEE : "#5d616c")}</g>` + label(on ? "AUTO ON" : "AUTO OFF", 112, 15, on ? "#fff" : "#8d919d", 1.5) + label(on ? running ? S[step] || "RUNNING" : S[step] || "WAITING" : "RUN OF SHOW", 132, 10, on ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.45)", 1.4), { dim: offline });
      },
      // 1.12.15: tap tempo — looks set to "On the beat" pulse with it; shows the tempo once it has one
      tempo({ bpm = 0, offline = false } = {}) {
        return frame(`<g transform="translate(36,4) scale(.5)">${ICONS.tempo(bpm ? BEE : "#8d919d")}</g>` + label(bpm ? String(bpm) : "TAP", 112, bpm ? 22 : 18, "#fff", bpm ? 1 : 2) + label(bpm ? "BPM \xB7 TAP" : "TEMPO", 132, 11, "rgba(255,255,255,.6)", 1.6), { dim: offline });
      },
      // 1.12.14: its own key for taking a lock-in back (the Lock in key does it too, pressed again) — lit while there's one to undo
      formatUnlock({ ready = false, none = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,6) scale(.5)">${ICONS.unlock(ready ? BEE : "#5d616c")}</g>` + label("UNDO", 112, 18, ready ? "#fff" : "#8d919d", 2) + label(none ? "NO TEAM DEATH BATTLE" : "LOCK-IN", 132, none ? 9 : 12, ready ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.45)", 1.4), { dim: offline });
      },
      formatUndo({ ready = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,26) scale(.5)">${ICONS.undo(ready ? BEE : "#5d616c")}</g>` + label("UNDO", 110, 18, ready ? "#fff" : "#8d919d") + label("RESULT", 130, 13, "rgba(255,255,255,.6)"), { dim: offline });
      },
      formatSplash({ kind: kind2 = "fboard", on = false, offline = false } = {}) {
        const t = { fvs: "TEAM VS", fboard: "BOARD", fwin: "CHAMPION", flead: "LEADERBOARD" }[kind2] || "BOARD", ic = { fvs: ICONS.swords, fboard: ICONS.board, fwin: ICONS.crown, flead: ICONS.leader }[kind2] || ICONS.board;
        return frame(`<g transform="translate(32,10) scale(.56)">${ic(on ? INK : "#fff")}</g>` + label(on ? "ON AIR" : t, 128, on ? 16 : t.length > 9 ? 12 : 15, on ? INK : "#fff", 2), { bg: on ? BEE : void 0, dim: offline });
      },
      // the format bar along the bottom of the layout (teams, survivors, challengers, standings): lit while on stream
      // Team Death Battle: put in the next fighter of one team (while the switch window is open)
      formatSwitch({ side = 1, open = false, none = false, name = "", lives = 0, max = 0, color = "", offline = false } = {}) {
        const c = /^#[0-9a-f]{6}$/i.test(color) ? color : side === 2 ? "#3fb6ff" : "#ff5a1f";
        const hexes = Array.from({ length: Math.min(6, max) }, (_, k) => {
          const x = 72 - (Math.min(6, max) - 1) * 10 + k * 20;
          return `<path d="M${x} 82l8 4.6v9.2l-8 4.6-8-4.6v-9.2z" fill="${k < lives ? c : "none"}" stroke="${c}" stroke-width="2.4" opacity="${k < lives ? 1 : 0.45}"/>`;
        }).join("");
        const arrows = `<g transform="translate(40,14) scale(.44)">${ICONS.switchArrows(open ? "#fff" : "#7a7f8c", open ? c : "#5d616c")}</g>`;
        const lock = `<g transform="translate(44,14) scale(.4)">${ICONS.lock("#7a7f8c")}</g>`;
        return frame((none ? lock : open ? arrows : lock) + (none ? "" : hexes) + label(none ? "NO TEAM DEATH BATTLE" : open ? name || `P${side} SWITCH` : `P${side} \xB7 ${name || "LOCKED"}`, 128, none ? 11 : (name || "").length > 10 ? 13 : 16, "#fff", 1) + `<text x="56" y="22" ${FONT} font-size="12" font-weight="800" fill="${c}" text-anchor="middle" letter-spacing="1.5">${open ? `P${side} \xB7 SWITCH` : "SWITCH"}</text>`, { accent: c, dim: offline });
      },
      formatBar({ on = false, kind: kind2 = "", offline = false } = {}) {
        const t = { teams: "TEAM BAR", elim: "SURVIVORS", koth: "CHALLENGERS", league: "STANDINGS" }[kind2] || "FORMAT BAR";
        return frame(`<g transform="translate(26,4) scale(.64)">${ICONS.formatBar(on ? INK : "#fff")}</g>` + label(on ? "ON AIR" : t, 126, on ? 16 : 14, on ? INK : "#fff", 2), { bg: on ? BEE : void 0, dim: offline });
      },
      // viewer tournament: signups (lit while open, with the count) and confirm & next match (green when a match is won)
      vtSignup({ open = false, count = 0, started = false, offline = false } = {}) {
        return frame((started ? `<g transform="translate(40,18) scale(.44)">${ICONS.trophy(open ? "#fff" : VT2)}</g>` : `<text x="72" y="70" ${FONT} font-size="44" font-weight="900" fill="${open ? "#fff" : VT2}" text-anchor="middle">${count}</text>`) + label(started ? "STARTED" : open ? "SIGN-UPS OPEN" : "SIGN-UPS", 106, 13, "#fff", 1.5) + label(started ? "BRACKET IS ON" : "!enter", 128, 13, "rgba(255,255,255,.7)"), { bg: open ? VT : void 0, dim: offline });
      },
      vtNext({ now = "", won = false, done = false, champion = "", offline = false } = {}) {
        const bg = won ? "#1f9d55" : void 0;
        return frame(done ? `<g transform="translate(40,16) scale(.44)">${ICONS.trophy(BEE)}</g>` + label(champion || "CHAMPION", 112, 15, "#fff") : `<g transform="translate(36,26) scale(.5)">${ICONS.next(won ? "#fff" : VT2)}</g>` + label(won ? "CONFIRM \u203A" : "NEXT MATCH", 106, 15, "#fff", 1.5) + label(short(now || "NO MATCH YET", 20), 128, 11, "rgba(255,255,255,.75)", 0), { bg, dim: offline });
      },
      // viewer tournament: the "how to join" splash, and its bracket on stream
      vtJoin({ on = false, count = 0, open = false, ready = true, offline = false } = {}) {
        return on ? frame(`<g transform="translate(28,4) scale(.6)">${ICONS.ticket("#fff", "#fff")}</g>` + label("ON AIR", 104, 15, "#fff", 3) + label(`${count} IN`, 128, 13, "rgba(255,255,255,.85)", 1), { bg: VT, dim: offline }) : frame(`<g transform="translate(28,4) scale(.6)" opacity="${ready ? 1 : 0.45}">${ICONS.ticket("#fff")}</g>` + label("JOIN SPLASH", 110, 13, "#fff", 1.5) + label(ready ? open ? `${count} IN \xB7 OPEN` : `${count} IN` : "NOT SET UP", 130, 11, "rgba(255,255,255,.6)", 1), { dim: offline });
      },
      vtBracket({ on = false, ready = true, offline = false } = {}) {
        return on ? frame(`<g transform="translate(16,8) scale(.72)">${ICONS.bracket("#fff")}</g>` + label("ON AIR", 128, 16, "#fff", 3), { bg: VT, dim: offline }) : frame(`<g transform="translate(16,8) scale(.72)">${ICONS.bracket(ready ? VT2 : "#5d616c")}</g>` + label(ready ? "TOURNEY BRACKET" : "NOT STARTED", 128, 12, ready ? "#fff" : "#8d919d", 1), { dim: offline });
      },
      // effects quality (1.11): the gauge and the level; pressing steps Auto → Full → Light → Ultra-light (or sets one)
      fxq({ q = "auto", offline = false } = {}) {
        const name = { auto: "AUTO", full: "FULL", light: "LIGHT", off: "NO ENGINE", ultra: "ULTRA-LIGHT" }[q] || "AUTO", lit = q === "ultra" ? "#35dc84" : q === "full" ? "#ffb020" : "#29c6ff";
        return frame(`<g transform="translate(28,4) scale(.62)">${glyph("gauge", lit)}</g>` + label("EFFECTS", 112, 13, "rgba(255,255,255,.65)", 2) + label(name, 134, name.length > 8 ? 14 : 17, "#fff"), { dim: offline });
      },
      // Refresh OBS (1.12): reloads every BeeboScore browser source in OBS; flashes DONE (or what went wrong) after a press
      obsRefresh({ flash = "", offline = false } = {}) {
        const ok = flash === "DONE", bad = flash && !ok;
        return frame(`<g transform="translate(26,6) scale(.64)">${glyph("obsRefresh", bad ? "#ff5a5a" : ok ? "#35dc84" : "#29c6ff")}</g>` + label("REFRESH", 112, 15, "#fff", 2) + label(flash || "OBS", 134, flash ? 13 : 15, bad ? "#ff8a8a" : ok ? "#7df0b0" : "rgba(255,255,255,.65)", 2), { dim: offline });
      },
      // the BeeboScore key (1.12, bottom-right of the match section): connected or not, and whether the deck shows 1v1 or a format
      status({ offline = false, section = "solo", format = "" } = {}) {
        const c = offline ? "#8d919d" : "#ffb020";
        return frame(`<text x="72" y="58" ${FONT} font-size="30" font-weight="900" fill="${c}" text-anchor="middle" letter-spacing="1">BEEBO</text><text x="72" y="84" ${FONT} font-size="17" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="4">SCORE</text>` + label(offline ? "APP CLOSED" : section === "solo" ? "1V1 KEYS" : short(format || "FORMAT", 16), 124, 12, offline ? "#ff8a8a" : "rgba(255,255,255,.7)", 1.5), { dim: offline });
      },
      // 1.12.8: "Everything, in pages" — turns the deck's page; shows where you are and what's next
      page({ page = 0, total = 2, name = "", next = "", offline = false } = {}) {
        const dots = Array.from({ length: total }, (_, i) => `<circle cx="${72 + (i - (total - 1) / 2) * 16}" cy="104" r="${i === page ? 5 : 3.5}" fill="${i === page ? "#ffb020" : "rgba(255,255,255,.35)"}"/>`).join("");
        return frame(`<path d="M58 30 L86 54 L58 78" fill="none" stroke="#ffb020" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` + dots + label(short(name || "PAGE", 12), 126, 12, "#fff", 1.5) + label(next ? "\u25B8 " + short(next, 10) : "", 20, 10, "rgba(255,255,255,.6)", 1.5), { dim: offline });
      },
      blank() {
        return frame("");
      },
      // stream sound: on/off (lit while on), or a louder / quieter key showing the level
      sound({ on = false, vol = 60, mode = "toggle", offline = false } = {}) {
        if (mode === "up" || mode === "down") return frame(`<g transform="translate(26,14) scale(.64)">${ICONS.speaker(on ? BEE : "#8d919d", true)}</g><text x="118" y="64" ${FONT} font-size="40" font-weight="900" fill="${on ? "#fff" : "#8d919d"}" text-anchor="middle">${mode === "up" ? "+" : "\u2212"}</text>` + label(on ? vol + "%" : "SOUND OFF", 126, on ? 22 : 15, on ? "#fff" : "#8d919d"), { dim: offline });
        return frame(`<g transform="translate(30,12) scale(.6)">${ICONS.speaker(on ? INK : "#8d919d", on)}</g>` + label(on ? "SOUND ON" : "SOUND OFF", 112, 16, on ? INK : "#fff") + label(on ? vol + "%" : "STREAM", 134, 13, on ? INK : "rgba(255,255,255,.6)"), { bg: on ? BEE : void 0, dim: offline });
      },
      screen({ name = "", on = false, missing = false, offline = false } = {}) {
        const t = short(name || "Pick a screen", 22), words = t.split(" "), lines = [];
        for (const w of words) {
          if (lines.length && (lines[lines.length - 1] + " " + w).length <= 11) lines[lines.length - 1] += " " + w;
          else lines.push(w);
        }
        const ls = lines.slice(0, 2), ink = on ? INK : "#fff";
        return frame(`<g transform="translate(44,14) scale(.39)">${ICONS.screen(on ? INK : "#fff")}</g>` + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 100 : 90 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(l)}</text>`).join("") + label(missing ? "NOT IN LAYOUT" : on ? "ON AIR" : "SCREEN", 134, 12, on ? INK : "rgba(255,255,255,.65)", 1.5), { bg: on ? BEE : void 0, dim: offline || missing });
      },
      layout({ title = "", mode = "next", offline = false } = {}) {
        const t = short(title || "Layout", 22), words = t.split(" "), lines = [];
        for (const w of words) {
          if (lines.length && (lines[lines.length - 1] + " " + w).length <= 11) lines[lines.length - 1] += " " + w;
          else lines.push(w);
        }
        const ls = lines.slice(0, 2);
        return frame(`<g transform="translate(40,18) scale(.45)">${ICONS.layout(BEE)}</g>` + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 102 : 92 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join("") + label(mode === "specific" ? "LAYOUT" : "NEXT LAYOUT \u203A", 134, 12, "rgba(255,255,255,.65)", 1.5), { dim: offline });
      }
    };
    art2.show = ({ g, name, sub = "", on = false, offline = false, flash = "" } = {}) => {
      const big = flash || name, top = sub ? 4 : 10;
      return on ? frame(`<g transform="translate(30,${top}) scale(.58)">${ICONS[g](INK)}</g>` + label(big, sub ? 108 : 124, fit(big, 10, 16, 11), INK, 1.5) + (sub ? label(sub, 130, fit(sub, 14, 12, 9), "rgba(14,16,23,.72)", 0.8) : ""), { bg: BEE, dim: offline }) : frame(`<g transform="translate(30,${top}) scale(.58)">${ICONS[g]("#fff")}</g>` + label(big, sub ? 108 : 124, fit(big, 10, 16, 11), "#fff", 1.5) + (sub ? label(sub, 130, fit(sub, 14, 12, 9), "rgba(255,255,255,.55)", 0.8) : ""), { dim: offline });
    };
    var listIcon = (inner2) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">${inner2}</svg>`;
    var LIST = Object.fromEntries(Object.entries({
      score: "plus1",
      reset: "reset",
      swap: "swap",
      undo: "undo",
      nextmatch: "next",
      clear: "clear",
      layout: "layout",
      screen: "screen",
      fswitch: "switchArrows",
      fnext: "confirm",
      fundo: "undo",
      fsplash: "swords",
      fbar: "formatBar",
      playervs: "swords",
      vsstyle: "switchArrows",
      comm: "mic",
      flock: "lock",
      funlock: "unlock",
      tempo: "tempo",
      autopilot: "pilot",
      replay: "replay",
      automation: "flow",
      chapter: "chapter",
      stats: "statsCard",
      sponsor: "sponsor",
      player: "person",
      vtopen: "personPlus",
      vtnext: "next",
      sound: "speaker",
      fxq: "gauge",
      obsrefresh: "obsRefresh",
      hideall: "hideAll",
      slot: "layout",
      stinger: "bolt",
      bracket: "bracket",
      bracketrefresh: "pull",
      victory: "trophy",
      bracketside: "sides",
      latency: "eye",
      viewernext: "chatNext",
      viewerresult: "plus1",
      viewerqueue: "queue",
      viewersidebar: "sidebar",
      viewersplash: "vs",
      sggreport: "upload",
      postlink: "chatLink",
      standings: "podium",
      top8: "top8",
      vs: "vs",
      loser: "loser",
      vtjoin: "ticket",
      vtbracket: "bracket",
      rundown: "rundown",
      countdown: "countdown",
      schedule: "schedule",
      walkin: "walkin",
      storyline: "storyline",
      evstats: "evstats",
      season: "season",
      rehearsal: "rehearsal",
      replayslow: "slowmo",
      replayfreeze: "freeze",
      drawclear: "drawClear",
      clip: "clip",
      results: "results",
      picks: "picks",
      poll: "poll",
      twpred: "twpred",
      music: "music",
      duck: "duck",
      ext: "ext",
      // 1.12.18
      cdplus: "cdPlus",
      // 1.12.19
      moments: "moments",
      momentreplay: "momentReplay",
      h2h: "h2h",
      settimer: "setTimer",
      // 1.12.21
      statsstrip: "statsStrip",
      greset: "gresetSplash"
      // 1.12.23
    }).map(([k, g]) => [k, listIcon(glyph(g))]));
    var GROUPS = {
      match: { color: "#ffb020", name: "Match" },
      stream: { color: "#29c6ff", name: "Stream" },
      bracket: { color: "#4f7dff", name: "Bracket" },
      format: { color: "#ff6a1a", name: "Format" },
      vt: { color: "#9d5cff", name: "Viewer tournament" },
      vm: { color: "#ff5fa2", name: "Viewer matches" },
      show: { color: "#b6f03a", name: "The show" }
      // 1.12.18: rundown, screens, replays, viewers
    };
    var GROUP_OF = {
      score: "match",
      player: "match",
      loser: "match",
      swap: "match",
      reset: "match",
      undo: "match",
      clear: "match",
      vs: "match",
      playervs: "match",
      vsstyle: "match",
      victory: "match",
      moments: "match",
      momentreplay: "match",
      h2h: "match",
      settimer: "match",
      // 1.12.21: the set as it's told
      statsstrip: "match",
      greset: "match",
      // 1.12.23: the splashes tell the story
      layout: "stream",
      screen: "stream",
      comm: "stream",
      sound: "stream",
      latency: "stream",
      fxq: "stream",
      obsrefresh: "stream",
      hideall: "stream",
      stinger: "stream",
      tempo: "stream",
      autopilot: "stream",
      replay: "stream",
      automation: "stream",
      chapter: "stream",
      stats: "stream",
      sponsor: "stream",
      nextmatch: "bracket",
      bracket: "bracket",
      top8: "bracket",
      standings: "bracket",
      bracketside: "bracket",
      bracketrefresh: "bracket",
      sggreport: "bracket",
      postlink: "bracket",
      fnext: "format",
      fundo: "format",
      fsplash: "format",
      fbar: "format",
      fswitch: "format",
      flock: "format",
      funlock: "format",
      vtopen: "vt",
      vtjoin: "vt",
      vtbracket: "vt",
      vtnext: "vt",
      viewernext: "vm",
      viewerresult: "vm",
      viewerqueue: "vm",
      viewersplash: "vm",
      viewersidebar: "vm",
      rundown: "show",
      countdown: "show",
      schedule: "show",
      walkin: "show",
      storyline: "show",
      evstats: "show",
      season: "show",
      rehearsal: "show",
      replayslow: "show",
      replayfreeze: "show",
      drawclear: "show",
      clip: "show",
      results: "show",
      picks: "show",
      poll: "show",
      twpred: "show",
      music: "show",
      duck: "show",
      ext: "show",
      cdplus: "show"
    };
    var FORMAT_NAMES2 = { crew: "CREW BATTLE", sajam: "TEAM BATTLE", gauntlet: "GAUNTLET", death: "DEATH BATTLE", koth: "KING OF THE HILL", league: "LEAGUE", tdb: "TEAM DEATH BATTLE" };
    var hexRgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    var mixHex = (a, b, k) => "#" + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * k).toString(16).padStart(2, "0")).join("");
    function grouped2(svg, action, tag = "") {
      if (!svg) return svg;
      const gk = GROUP_OF[action], g = GROUPS[gk];
      if (!g) return svg.split(MAIN).join("#fff").split(SOFT).join("#fff");
      const bgM = svg.match(/<rect width="144" height="144" fill="(#[0-9a-fA-F]{6})"\/>/), bg = bgM ? bgM[1].toLowerCase() : "";
      const lum = bg ? hexRgb(bg).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0) / 255 : 0;
      const lit = lum > 0.16, hot = bg === OKG, litC = !lit ? "" : bg === BEE ? gk === "match" ? BEE : null : bg;
      svg = svg.split(MAIN).join(mixHex(g.color, "#ffffff", 0.3)).split(SOFT).join(g.color);
      const c = g.color, top = mixHex(c, "#ffffff", 0.28), deep = mixHex(c, "#000000", 0.38), id = `k${gk}${hot ? "h" : lit ? "l" + (litC || "").slice(1) : "d"}`;
      const face = lit ? (hot ? `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5df0a0"/><stop offset="1" stop-color="#1fa862"/></linearGradient></defs>` : `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${litC ? mixHex(litC, "#ffffff", 0.22) : top}"/><stop offset="1" stop-color="${litC ? mixHex(litC, "#000000", 0.3) : deep}"/></linearGradient></defs>`) + `<rect width="144" height="144" fill="#07080c"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}f)"/><rect x="3" y="3" width="138" height="66" rx="22" fill="#ffffff" fill-opacity=".14"/>` : `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f2b"/><stop offset="1" stop-color="#0a0b11"/></linearGradient><radialGradient id="${id}g" cx=".5" cy="1.1" r=".85"><stop offset="0" stop-color="${c}" stop-opacity=".42"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><rect width="144" height="144" fill="#07080c"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}f)"/><rect x="3" y="3" width="138" height="138" rx="22" fill="url(#${id}g)"/><rect x="5" y="5" width="134" height="40" rx="20" fill="#ffffff" fill-opacity=".045"/>`;
      svg = svg.replace(/<rect width="144" height="144" fill="[^"]*"\/>/, face);
      const edge = `<rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="${lit ? "#ffffff" : c}" stroke-opacity="${lit ? 0.5 : 0.62}" stroke-width="2.5"/>`;
      const badge = `<circle cx="124" cy="20" r="13" fill="${lit ? "#0e1017" : c}" fill-opacity="${lit ? 0.55 : 1}"/><g transform="translate(-4,8)">${(DA["b." + gk] || "").replace(/^<g transform="translate\(110 0\)">.*?<\/g>/, "").split("#0e1017").join(lit ? c : "#0e1017")}</g>`;
      const t = short(tag, 18);
      const pill = tag ? `<rect x="7" y="8" width="${Math.min(100, 12 + t.length * 6.2).toFixed(0)}" height="18" rx="9" fill="${lit ? "#0e1017" : c}" fill-opacity="${lit ? 0.55 : 0.95}"/><text x="${(7 + Math.min(100, 12 + t.length * 6.2) / 2).toFixed(0)}" y="21" ${FONT} font-size="${fit(t, 13, 10.5, 7.5)}" font-weight="900" fill="${lit ? c : "#0e1017"}" text-anchor="middle" letter-spacing=".4">${esc(t)}</text>` : "";
      return svg.replace(/<rect width="144" height="10" fill="[^"]*"\/>/, "").replace(/<\/svg>$/, edge + pill + badge + `<!--sb:${hot ? "hot" : lit ? "lit" : "idle"}--></svg>`);
    }
    var inner = (svg) => String(svg).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    var reid = (x, p) => x.replace(/id="([\w-]+)"/g, `id="${p}$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${p}$1)`).replace(/href="#([\w-]+)"/g, `href="#${p}$1"`);
    var wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`;
    function disabled(svg, reason = "") {
      const r = short(String(reason || "NOT NOW").toUpperCase(), 18);
      return wrap(`<g opacity=".3">${inner(svg)}</g><rect x="3" y="3" width="138" height="138" rx="22" fill="#0b0c11" fill-opacity=".45"/><rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="#5d616c" stroke-opacity=".7" stroke-width="2" stroke-dasharray="7 6"/><rect x="10" y="${116 - 4}" width="124" height="24" rx="12" fill="#1c1f28" stroke="#3b3f4b" stroke-width="1.5"/><text x="72" y="${116 + 12}" ${FONT} font-size="${fit(r, 13, 12, 8)}" font-weight="900" fill="#9aa0ad" text-anchor="middle" letter-spacing=".6">${esc(r)}</text><!--sb:off-->`);
    }
    function blend(a, b, e) {
      const k = e * e * (3 - 2 * e), up = (1 - k) * 12, s = 0.92 + 0.08 * k;
      return wrap(`<g opacity="${(1 - k).toFixed(3)}" transform="translate(0,${(-k * 12).toFixed(1)})">${reid(inner(a), "o")}</g><g opacity="${k.toFixed(3)}" transform="translate(${(72 * (1 - s)).toFixed(2)},${(72 * (1 - s) + up).toFixed(2)}) scale(${s.toFixed(3)})">${inner(b)}</g>`);
    }
    function shine(svg, phase, hot = false) {
      const x = -90 + phase * 330, glow = 0.35 + 0.35 * Math.sin(phase * Math.PI * 2);
      return wrap(inner(svg) + `<defs><linearGradient id="ksh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${hot ? 0.5 : 0.32}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g transform="translate(${x.toFixed(1)},0) skewX(-18)"><rect x="0" y="3" width="44" height="138" fill="url(#ksh)"/></g><rect x="3" y="3" width="138" height="138" rx="22" fill="none" stroke="#ffffff" stroke-opacity="${glow.toFixed(2)}" stroke-width="3"/>`);
    }
    var pressed = (svg) => wrap(`<rect width="144" height="144" fill="#07080c"/><g transform="translate(5.04,5.04) scale(.93)">${inner(svg)}</g>`);
    var stateOf = (svg) => {
      const m = /<!--sb:(\w+)-->/.exec(svg || "");
      return m ? m[1] : "idle";
    };
    var tinted = (svg, action) => {
      const g = GROUPS[GROUP_OF[action]], c = g ? g.color : "#fff";
      return svg.split(MAIN).join(c).split(SOFT).join(c).replace(/#fff\b/g, c);
    };
    var dataUrl2 = (svg) => "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg);
    module2.exports = { art: art2, LIST, dataUrl: dataUrl2, P1, P2, BEE, GROUPS, GROUP_OF, FORMAT_NAMES: FORMAT_NAMES2, grouped: grouped2, tinted, disabled, blend, shine, pressed, stateOf };
  }
});

// src/slots.js
var require_slots = __commonJS({
  "src/slots.js"(exports2, module2) {
    "use strict";
    var K = (k, settings = {}) => ({ k, settings });
    var UNDO = K("undo", { any: true });
    var RESET = K("reset", { holdClear: true });
    var XL_MATCH = [K("player", { side: 1 }), K("score", { side: 1 }), K("swap"), K("score", { side: 2 }), K("player", { side: 2 }), UNDO, RESET, K("obsrefresh")];
    var XL_SHOW = [K("vs", { style: "full" }), K("playervs"), K("victory"), K("bracket"), K("top8"), K("standings"), K("vsstyle"), K("hideall")];
    var XL_STORY = [K("moments"), K("momentreplay"), K("h2h"), K("settimer"), K("statsstrip"), K("greset"), K("stats", { side: 1 }), K("stats", { side: 2 })];
    var XL_SIDE = {
      solo: [K("nextmatch"), K("sggreport"), K("bracketside"), K("loser", { side: 1 }), K("loser", { side: 2 }), K("clear"), K("fxq"), K("vsstyle")],
      format: [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "fvs" }), K("fsplash", { kind: "fwin" }), K("fbar"), K("fundo"), K("nextmatch"), K("sggreport")],
      tdb: [K("fnext"), K("fswitch", { side: 1 }), K("fswitch", { side: 2 }), K("flock"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "fvs" }), K("fsplash", { kind: "fwin" }), K("fbar")],
      // King of the Hill — the leaderboard (this event + the Emperor of the World) instead of a team VS it doesn't have
      koth: [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "flead" }), K("fsplash", { kind: "fwin" }), K("fbar"), K("fundo"), K("nextmatch"), K("sggreport")]
    };
    var XL_CORE = [XL_MATCH, XL_SHOW, null, XL_STORY];
    var STD_CORE = [
      [K("score", { side: 1 }), K("swap"), UNDO, RESET, K("score", { side: 2 })],
      [K("vs"), K("victory"), K("bracket"), K("hideall"), K("obsrefresh")]
    ];
    var STD_SIDE = {
      solo: [K("nextmatch"), K("top8"), K("standings"), K("sggreport"), K("bracketside")],
      format: [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "fvs" }), K("fsplash", { kind: "fwin" }), K("fbar")],
      tdb: [K("fswitch", { side: 1 }), K("flock"), K("fswitch", { side: 2 }), K("fnext"), K("fsplash", { kind: "fboard" })],
      koth: [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "flead" }), K("fsplash", { kind: "fwin" }), K("fbar")]
    };
    var PAGE = K("page");
    var XL_PAGES = [
      { name: "MATCH", rows: [XL_MATCH, XL_SHOW, [...XL_SIDE.solo.slice(0, 7), PAGE], XL_STORY] },
      { name: "FORMATS", rows: [
        XL_MATCH,
        XL_SHOW,
        [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "fvs" }), K("fsplash", { kind: "fwin" }), K("fsplash", { kind: "flead" }), K("fbar"), K("fundo"), PAGE],
        [K("fswitch", { side: 1 }), K("flock"), K("fswitch", { side: 2 }), K("funlock"), K("nextmatch"), K("sggreport"), K("top8"), K("standings")]
      ] }
    ];
    var STD_PAGES = [
      { name: "MATCH", row: [K("nextmatch"), K("top8"), K("standings"), K("sggreport"), PAGE] },
      { name: "FORMAT", row: [K("fnext"), K("fsplash", { kind: "fboard" }), K("fsplash", { kind: "fvs" }), K("fsplash", { kind: "fwin" }), PAGE] },
      { name: "TEAMS", row: [K("fswitch", { side: 1 }), K("flock"), K("fswitch", { side: 2 }), K("fbar"), PAGE] },
      { name: "MORE", row: [K("fundo"), K("fsplash", { kind: "flead" }), K("vsstyle"), K("playervs"), PAGE] },
      { name: "STORY", row: [K("moments"), K("momentreplay"), K("h2h"), K("settimer"), PAGE] },
      { name: "SPLASH", row: [K("statsstrip"), K("greset"), K("bracketside"), K("fxq"), PAGE] }
    ];
    var ALL_KEYS = [...STD_CORE.flat(), ...STD_PAGES.flatMap((p) => p.row.filter((k) => k.k !== "page"))];
    var sdMode2 = (status2) => status2 && status2.sdLayout === "all" ? "all" : "follow";
    function pagesFor2(cols, rows) {
      return cols >= 8 && rows >= 4 ? XL_PAGES : cols === 5 && rows === 3 ? STD_PAGES : null;
    }
    function sectionOf2(status2) {
      const f = status2 && status2.format;
      if (!f) return "solo";
      if (f.preset === "koth" || f.rules && f.rules.mode === "koth") return "koth";
      return f.preset === "tdb" || f.rules && f.rules.mode === "tdb" ? "tdb" : "format";
    }
    function slotFor2(cols, rows, column, row, status2, page = 0) {
      if (sdMode2(status2) === "all") {
        const P = pagesFor2(cols, rows), pg = P ? P[((Number(page) || 0) % P.length + P.length) % P.length] : null;
        if (cols >= 8 && rows >= 4) return row > 3 || column > 7 ? K("blank") : pg.rows[row][column];
        if (cols === 5 && rows === 3) return row < 2 ? STD_CORE[row][column] : pg.row[column];
        return ALL_KEYS[row * cols + column] || K("blank");
      }
      const sec = sectionOf2(status2);
      if (cols >= 8 && rows >= 4) {
        if (row > 3 || column > 7) return K("blank");
        return (row === 2 ? XL_SIDE[sec] : XL_CORE[row])[column];
      }
      if (cols === 5 && rows === 3) return row < 2 ? STD_CORE[row][column] : STD_SIDE[sec][column];
      const list = [...STD_CORE.flat(), ...STD_SIDE[sec]], i = row * cols + column;
      return list[i] || K("blank");
    }
    function profileFor2(device) {
      const s = device && device.size || {}, t = device && device.type;
      if (t === 2 || s.columns >= 8 && s.rows >= 4) return { name: "profiles/BeeboScore XL", cols: 8, rows: 4, label: "Stream Deck XL" };
      if (t === 0 || s.columns === 5 && s.rows === 3) return { name: "profiles/BeeboScore", cols: 5, rows: 3, label: "Stream Deck" };
      return null;
    }
    var DEVICE_NAMES2 = { 0: "Stream Deck", 1: "Stream Deck Mini", 2: "Stream Deck XL", 3: "Stream Deck Mobile", 4: "Corsair G-Keys", 5: "Stream Deck Pedal", 6: "Corsair Voyager", 7: "Stream Deck +", 8: "SCUF controller", 9: "Stream Deck Neo" };
    module2.exports = { slotFor: slotFor2, sectionOf: sectionOf2, profileFor: profileFor2, pagesFor: pagesFor2, sdMode: sdMode2, DEVICE_NAMES: DEVICE_NAMES2, XL_PAGES, STD_PAGES, XL_CORE, XL_SIDE, STD_CORE, STD_SIDE, XL_MATCH, XL_SHOW, XL_STORY };
  }
});

// src/plugin.js
var WebSocket = require_ws();
var ART = require_art();
var { art, dataUrl, grouped, FORMAT_NAMES } = ART;
Object.assign(art, { disabled: ART.disabled, blend: ART.blend, shine: ART.shine, pressed: ART.pressed, stateOf: ART.stateOf });
var { slotFor, sectionOf, profileFor, pagesFor, sdMode, DEVICE_NAMES } = require_slots();
var pages = /* @__PURE__ */ new Map();
var argv = process.argv.slice(2);
var arg = (k) => {
  const i = argv.indexOf("-" + k);
  return i >= 0 ? argv[i + 1] : "";
};
var PORT = arg("port");
var PLUGIN_UUID = arg("pluginUUID");
var REGISTER = arg("registerEvent");
var PREFIX = "com.t1fgc.beeboscore.lite.";
var INFO = (() => {
  try {
    return JSON.parse(arg("info") || "{}");
  } catch {
    return {};
  }
})();
var VERSIONS = { plugin: INFO.plugin && INFO.plugin.version || (true ? "1.31.0.0" : ""), app: INFO.application && INFO.application.version || "" };
var CANDIDATES = ["http://127.0.0.1:3200", "http://127.0.0.1:3300", "http://127.0.0.1:3201", "http://127.0.0.1:3202", "http://127.0.0.1:3301"];
var ws = null;
var globals = { address: "" };
var base = "";
var status = null;
var online = false;
var devices = /* @__PURE__ */ new Map();
for (const d of INFO.devices || []) if (d && d.id) devices.set(d.id, d);
var contexts = /* @__PURE__ */ new Map();
var send = (event, extra) => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ event, ...extra }));
};
var kind = (action) => String(action || "").replace(PREFIX, "");
async function http(path, body, address = base) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(address + path, {
      method: body ? "POST" : "GET",
      signal: ctrl.signal,
      headers: { "X-Beebo-Client": "streamdeck", "X-Beebo-Plugin": VERSIONS.plugin, "X-Beebo-SD": VERSIONS.app, ...body ? { "Content-Type": "application/json" } : {} },
      body: body ? JSON.stringify(body) : void 0
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error("BeeboScore asked for a password \u2014 use the address of this PC.");
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  } finally {
    clearTimeout(t);
  }
}
async function findApp() {
  const list = globals.address ? [globals.address.replace(/\/+$/, "")] : CANDIDATES;
  for (const a of list) {
    try {
      const d = await http("/api/remote/status", null, a);
      if (d && d.p1) {
        base = a;
        return d;
      }
    } catch {
    }
  }
  return null;
}
var polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    let d = null;
    if (base) {
      try {
        d = await http("/api/remote/status");
      } catch {
        d = null;
      }
    }
    if (!d) d = await findApp();
    const was = online;
    online = !!d;
    if (d) applyStatus(d);
    else if (was) renderAll();
    if (was !== online) {
      for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx);
    }
  } finally {
    polling = false;
  }
}
function applyStatus(d) {
  const changed = !status || JSON.stringify(status) !== JSON.stringify(d);
  const first = !status;
  status = d;
  if (changed) {
    for (const c of contexts.values()) resolveSlot(c);
    renderAll();
    for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx);
  }
  if (first) reportDevices();
  setupCheck(d);
}
async function act(body, ctx, okFlash) {
  try {
    const r = await http("/api/remote/action", body);
    if (r && r.status) applyStatus(r.status);
    if (r && r.url) send("openUrl", { payload: { url: base + r.url } });
    if (okFlash && ctx) send("showOk", { context: ctx });
    return r;
  } catch (e) {
    if (ctx) send("showAlert", { context: ctx });
    log(`action ${body.action} failed: ${e.message}`);
    poll();
  }
}
var log = (msg) => send("logMessage", { payload: { message: "[BeeboScore] " + msg } });
function resolveSlot(c) {
  if (kind(c.real) !== "slot") return false;
  const d = devices.get(c.device) || {}, size = d.size || {}, at = c.coords || {};
  const cols = size.columns || (d.type === 2 ? 8 : 5), rows = size.rows || (d.type === 2 ? 4 : 3);
  const k = slotFor(cols, rows, Number(at.column) || 0, Number(at.row) || 0, status, pages.get(c.device) || 0);
  const action = PREFIX + k.k, js = JSON.stringify(k.settings);
  if (action === c.action && js === JSON.stringify(c.settings)) return false;
  if (c.holdTimer) clearTimeout(c.holdTimer);
  c.action = action;
  c.settings = { ...k.settings };
  c.flash = "";
  c.image = null;
  return true;
}
var deviceList = () => [...devices.values()].map((d) => {
  const p = profileFor(d);
  return { name: d.name || DEVICE_NAMES[d.type] || "Stream Deck", type: d.type, cols: (d.size || {}).columns || 0, rows: (d.size || {}).rows || 0, profile: p ? p.label : "" };
});
function reportDevices(extra = {}) {
  if (base) http("/api/remote/action", { action: "sdreport", devices: deviceList(), ...extra }).catch(() => {
  });
}
var setupSeen = null;
function setupCheck(d) {
  const r = d && d.sdSetup, n = r ? r.n : 0;
  if (setupSeen === null) {
    setupSeen = n;
    if (!r || Date.now() - r.at > 2e4) return;
  } else if (n === setupSeen) return;
  setupSeen = n;
  if (!n) return;
  const sent = [];
  for (const dev of devices.values()) {
    const p = profileFor(dev);
    if (!p) continue;
    send("switchToProfile", { context: PLUGIN_UUID, device: dev.id, payload: { profile: p.name } });
    sent.push(dev.name || p.label);
  }
  log(`set up: ${sent.join(", ") || "no deck with a BeeboScore profile"}`);
  reportDevices({ setup: n, sent });
}
function render(ctx) {
  const c = contexts.get(ctx);
  if (!c) return;
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1, p = status ? status["p" + side] : null;
  const off = !online;
  let svg = "", state = null, fb = null;
  switch (kind(c.action)) {
    case "score":
      svg = art.score({ side, name: p && p.name, score: p ? p.score : "\u2013", mode: s.mode || "tapHold", offline: off });
      if (c.controller === "Encoder") {
        const ft = status && status.firstTo, sc = p ? p.score : 0;
        fb = { title: `P${side} \xB7 ${p && p.name || "Player " + side}`, value: off ? "offline" : String(sc), indicator: { value: ft ? Math.min(100, Math.round(sc / ft * 100)) : 0 } };
      }
      break;
    case "page": {
      const d = devices.get(c.device) || {}, sz = d.size || {}, P = pagesFor(sz.columns || (d.type === 2 ? 8 : 5), sz.rows || (d.type === 2 ? 4 : 3)) || [{ name: "PAGE" }], i = (pages.get(c.device) || 0) % P.length;
      svg = art.page({ page: i, total: P.length, name: P[i].name, next: P[(i + 1) % P.length].name, offline: off });
      break;
    }
    case "status":
      svg = art.status({ offline: off, section: sectionOf(status), format: status && status.format ? FORMAT_NAMES[status.format.preset] || "FORMAT" : "" });
      break;
    case "blank":
      svg = art.blank();
      break;
    case "reset":
      svg = art.reset({ offline: off, hint: s.holdClear ? "HOLD: NEXT SET" : "" });
      break;
    case "swap":
      svg = art.swap({ offline: off });
      break;
    case "undo":
      svg = art.undo({ offline: off, label: status && status.undo === "format" ? "UNDO RESULT" : "" });
      break;
    case "clear":
      svg = art.clear({ offline: off });
      break;
    case "stinger":
      svg = art.stinger({ offline: off });
      break;
    case "hideall": {
      const on = !!(status && (status.vs || status.victory || status.splash || status.screen || status.twitch && status.twitch.splash));
      svg = art.hideAll({ on, offline: off });
      break;
    }
    case "nextmatch":
      svg = art.nextmatch({ offline: off, label: c.busy ? "LOADING\u2026" : status && !status.startgg ? "NO START.GG" : "" });
      break;
    case "vs": {
      const style = s.style === "full" || s.style === "glass" ? s.style : status && status.vsStyle === "glass" ? "glass" : "full", pick = !s.style;
      if (style === "glass") {
        const on2 = !!(status && status.playerVs);
        svg = art.playerVs({ on: on2, hint: pick ? "HOLD: FULLVS" : "", offline: off });
        state = on2 ? 1 : 0;
        break;
      }
      const on = !!(status && status.vs);
      svg = art.vs({ on, hint: pick ? "HOLD: GLASSVS" : "", offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "playervs": {
      const on = !!(status && status.playerVs);
      svg = art.playerVs({ on, offline: off });
      state = on ? 1 : 0;
      break;
    }
    // GlassVS
    case "comm": {
      const on = !!(status && status.splash === "comm");
      svg = art.comm({ on, live: status && status.cams || 0, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "vsstyle": {
      const g = !!(status && status.vsStyle === "glass");
      svg = art.vsStyle({ glass: g, offline: off });
      state = g ? 1 : 0;
      break;
    }
    case "flock": {
      const f = status && status.format, t = f && f.tdb;
      svg = art.formatLock({ open: !!(t && t.open), undo: !!(t && t.undo), none: !t, offline: off });
      break;
    }
    case "funlock": {
      const f = status && status.format, t = f && f.tdb;
      svg = art.formatUnlock({ ready: !!(t && t.undo), none: !t, offline: off });
      break;
    }
    case "tempo":
      svg = art.tempo({ bpm: status && status.tempo || 0, offline: off });
      break;
    case "replay":
      svg = art.replay({ offline: off });
      break;
    case "automation": {
      const L = status && status.autos || [], want = String(s.auto || "").toLowerCase(), a = L.find((x) => x.id === s.auto || x.name.toLowerCase() === want) || !want && L[0];
      svg = art.automation({ name: a ? a.name : s.auto || "", running: !!(a && a.running), missing: !a, offline: off });
      break;
    }
    // 1.12.16
    case "chapter":
      svg = art.chapter({ flash: c.flash || "", offline: off });
      break;
    case "stats": {
      const side2 = Number(s.side) === 2 ? 2 : 1, st = status && status.stats || {};
      svg = art.stats({ side: side2, name: status && status["p" + side2] ? status["p" + side2].name : "", on: !!(st.show && st.side === side2), offline: off });
      break;
    }
    case "sponsor": {
      const sp = status && status.spon || {};
      svg = art.sponsor({ on: !!sp.on, none: !sp.n, offline: off });
      break;
    }
    case "autopilot": {
      const a = status && status.autopilot || {};
      svg = art.autopilot({ on: !!a.on, running: !!a.running, step: a.step || "", offline: off });
      break;
    }
    case "bracket": {
      const on = !!(status && status.splash === "bracket");
      const b = status && status.bracket, hint = status && !status.startgg ? "NO START.GG" : b && b.top8 && !on ? "TOP 8 SET" : "";
      svg = art.bracket({ on, offline: off, label: c.loading ? "LOADING\u2026" : hint });
      state = on ? 1 : 0;
      break;
    }
    case "bracketrefresh":
      svg = art.bracketRefresh({ busy: !!c.busy || !!(status && status.bracket && status.bracket.loading), offline: off, label: status && !status.startgg ? "NO START.GG" : c.flash || "" });
      break;
    case "victory": {
      const on = !!(status && status.victory);
      svg = art.victory({ on, ready: !!(status && status.winner), offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "bracketside": {
      const on = !!(status && status.splash === "bracket"), b = status && status.bracket || {};
      const want = s.bside === "W" ? "W" : s.bside === "L" ? "L" : "";
      const lab = c.loading ? "LOADING\u2026" : status && !status.startgg ? "NO START.GG" : !on && want === "W" ? "WINNERS" : "";
      svg = art.bracketSide({ side: b.side || "W", on, paged: b.ready ? !!b.paged : true, offline: off, label: lab });
      break;
    }
    case "latency": {
      const l = status && status.latency || {};
      svg = art.latency({ viewers: l.viewers || 0, worst: l.worst, offline: off });
      break;
    }
    case "viewernext": {
      const t = status && status.twitch || {};
      svg = art.viewerNext({ next: t.next, count: t.count || 0, busy: !!c.busy, offline: off });
      break;
    }
    case "viewerresult": {
      const t = status && status.twitch || {}, cur = t.current;
      svg = art.viewerResult({ who: s.who === "viewer" ? "viewer" : "streamer", s: cur ? cur.s : 0, v: cur ? cur.v : 0, playing: !!cur, offline: off });
      break;
    }
    case "viewerqueue": {
      const t = status && status.twitch || {};
      svg = art.viewerQueue({ open: !!t.open, count: t.count || 0, offline: off });
      state = t.open ? 1 : 0;
      break;
    }
    case "viewersidebar": {
      const t = status && status.twitch || {}, on = t.sidebar !== false;
      svg = art.viewerSidebar({ on, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "viewersplash": {
      const t = status && status.twitch || {};
      svg = art.viewerSplash({ on: !!t.splash, ready: !!t.current, offline: off });
      state = t.splash ? 1 : 0;
      break;
    }
    case "sggreport": {
      const r = status && status.sggReport || {};
      svg = art.sggReport({ ready: !!r.can, sent: !!r.sent, mode: r.mode, offline: off });
      break;
    }
    case "postlink": {
      const sh = status && status.share || {};
      svg = art.postlink({ ready: !!(sh.on && sh.online && sh.chat), offline: off });
      break;
    }
    case "standings": {
      const on = !!(status && status.splash === "standings");
      svg = art.standings({ on, ready: !!(status && status.bracket && status.bracket.standings), offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "top8": {
      const on = !!(status && status.splash === "top8");
      svg = art.top8({ on, offline: off, label: c.loading ? "LOADING\u2026" : status && !status.startgg ? "NO START.GG" : "" });
      state = on ? 1 : 0;
      break;
    }
    case "loser": {
      const on = !!(p && p.loser);
      svg = art.loser({ side, on, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "player":
      svg = art.player({ side, name: p && p.name, offline: off });
      break;
    case "fnext": {
      const f = status && status.format;
      svg = art.formatNext({ none: !f, done: f && f.status === "done", score: f ? f.tags && f.tags.length === 2 && f.kind === "teams" ? f.score : f.score : "", label: f ? f.name : "", pending: !!(f && f.pending), offline: off });
      break;
    }
    case "fundo": {
      const f = status && status.format;
      svg = art.formatUndo({ ready: !!(f && f.canUndo), offline: off });
      break;
    }
    case "vtopen": {
      const v = status && status.vt;
      svg = art.vtSignup({ open: !!(v && v.open && v.status === "signup"), count: v ? v.count : 0, started: !!(v && v.status !== "signup"), offline: off });
      state = v && v.open ? 1 : 0;
      break;
    }
    case "vtjoin": {
      const v = status && status.vt, on = !!(status && status.splash === "vtjoin");
      svg = art.vtJoin({ on, count: v ? v.count : 0, open: !!(v && v.open), ready: !!v, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "vtbracket": {
      const v = status && status.vt, on = !!(v && v.source === "viewer" && status && ["bracket", "top8"].includes(status.splash));
      svg = art.vtBracket({ on, ready: !!(v && v.status !== "signup"), offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "vtnext": {
      const v = status && status.vt;
      svg = art.vtNext({ now: v ? v.now : "", won: !!(v && v.winner), done: !!(v && v.status === "done"), champion: v ? v.champion : "", offline: off });
      break;
    }
    case "fswitch": {
      const f = status && status.format, t = f && f.tdb, tm = t && t.teams[side - 1];
      svg = art.formatSwitch({ side, none: !t, open: !!(t && t.open), name: tm ? tm.cur : "", lives: tm ? tm.lives : 0, max: t ? t.max : 0, color: tm ? tm.color : "", offline: off });
      break;
    }
    case "fbar": {
      const f = status && status.format, on = !!(f && status.fbar !== false);
      svg = art.formatBar({ on, kind: f ? f.preset === "koth" ? "koth" : f.kind : "", offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "fsplash": {
      const k = s.kind || "fboard", on = !!(status && status.splash === k);
      svg = art.formatSplash({ kind: k, on, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "fxq":
      svg = art.fxq({ q: status && status.fxq || "auto", offline: off });
      break;
    case "obsrefresh":
      svg = art.obsRefresh({ flash: c.flash || "", offline: off });
      break;
    case "sound": {
      const so = status && status.sound || {}, on = !!so.on;
      svg = art.sound({ on, vol: so.vol ?? 60, mode: s.smode || "toggle", offline: off });
      state = on && (s.smode || "toggle") === "toggle" ? 1 : 0;
      break;
    }
    case "screen": {
      const list = status && status.screens || [], sc = list.find((x) => x.id === s.screen) || list.find((x) => x.name === s.screenName);
      const on = !!(sc && status && status.screen === sc.id);
      svg = art.screen({ name: sc ? sc.name : s.screenName || "", on, missing: !!s.screenName && !sc && !!status, offline: off });
      state = on ? 1 : 0;
      break;
    }
    case "layout": {
      const list = status && status.layouts || [];
      const target = s.mode === "specific" ? list.find((o) => o.name === s.layout) : list.find((o) => o.name === (status && status.layout));
      svg = art.layout({ title: target ? target.title : s.mode === "specific" ? "Pick a layout" : "Layout", mode: s.mode || "next", offline: off });
      break;
    }
    default: {
      const sk = SHOWKEYS[kind(c.action)];
      if (!sk) return;
      svg = art.show({ ...sk(status && status.x ? status.x : {}, s, status || {}, c), offline: off });
      break;
    }
  }
  {
    const k = kind(c.action), f = status && status.format, v = status && status.vt;
    const tag = ["fundo", "fsplash", "fbar", "flock", "funlock"].includes(k) ? f ? FORMAT_NAMES[f.preset] || "GAME FORMAT" : "NO FORMAT RUNNING" : ["vtopen", "vtjoin", "vtbracket", "vtnext"].includes(k) ? v ? v.name || "VIEWER TOURNEY" : "VIEWER TOURNEY" : "";
    svg = grouped(svg, k, tag);
    const u = off ? null : usable(k, s, status);
    if (u) svg = art.disabled(svg, u);
  }
  if (state !== null && c.state !== state) {
    c.state = state;
    send("setState", { context: ctx, payload: { state } });
  }
  if (status && /^#[0-9a-f]{6}$/i.test(status.accent || "")) svg = svg.split("#ffb020").join(status.accent);
  paint(ctx, svg, kind(c.action) + "|" + JSON.stringify(c.settings || {}));
  if (c.title !== "") {
    c.title = "";
    send("setTitle", { context: ctx, payload: { title: "", target: 0 } });
  }
  if (fb) {
    const j = JSON.stringify(fb);
    if (j !== c.feedback) {
      c.feedback = j;
      send("setFeedback", { context: ctx, payload: fb });
    }
  }
}
function renderAll() {
  for (const ctx of contexts.keys()) render(ctx);
}
function usable(k, s, st) {
  if (!st) return null;
  const f = st.format, live = !!(f && f.status !== "done"), tdb = f && f.tdb, br = st.bracket || {}, tw = st.twitch || {};
  switch (k) {
    case "fnext":
    case "fbar":
    case "fsplash":
      return f ? k === "fsplash" && s.kind === "flead" && f.preset !== "koth" ? "KING OF THE HILL" : null : "NO FORMAT";
    case "fundo":
      return !f ? "NO FORMAT" : f.canUndo ? null : "NOTHING TO UNDO";
    case "fswitch":
    case "flock":
      return !tdb ? "TEAM DEATH BATTLE" : null;
    case "funlock":
      return !tdb ? "TEAM DEATH BATTLE" : tdb.undo ? null : "NOTHING LOCKED";
    case "vtopen":
    case "vtjoin":
    case "vtbracket":
    case "vtnext":
      return st.vt ? null : "NO TOURNAMENT";
    case "viewernext":
    case "viewerresult":
    case "viewerqueue":
    case "viewersplash":
    case "viewersidebar":
      return tw.chat === "off" || !tw.chat ? "TWITCH CHAT OFF" : null;
    case "nextmatch":
    case "bracket":
    case "top8":
    case "standings":
    case "bracketside":
    case "bracketrefresh":
      return st.startgg || br.ready ? null : "NO BRACKET";
    case "sggreport":
      return !st.startgg ? "NO START.GG" : null;
    case "victory":
      return st.winner || st.victory ? null : "NO WINNER YET";
    case "stats": {
      const p = st["p" + (Number(s.side) === 2 ? 2 : 1)];
      return p && p.name ? null : "NO PLAYER";
    }
    case "sponsor":
      return st.spon && st.spon.n ? null : "NO SPONSORS";
    case "automation":
      return (st.autos || []).length ? null : "NONE MADE";
    case "undo":
      return st.undo ? null : "NOTHING TO UNDO";
    // 1.12.21: the set as it's told
    case "momentreplay":
      return st.x && st.x.mo && !st.x.mo.on ? "MOMENTS OFF" : st.x && st.x.mo && st.x.mo.last ? null : "NO MOMENT YET";
    case "h2h":
    case "greset": {
      const ok = (n) => !!n && !/^Player [12]$/.test(n);
      return ok((st.p1 || {}).name) && ok((st.p2 || {}).name) ? null : "NO PLAYERS";
    }
    // 1.12.18: the show
    case "rundown":
      return st.x && st.x.rd && st.x.rd.empty ? "NO RUNDOWN" : null;
    case "cdplus":
      return st.x && st.x.full === "countdown" ? null : "COUNTDOWN OFF";
    case "walkin": {
      const p = st["p" + (Number(s.side) === 2 ? 2 : 1)];
      return p && p.name && !/^Player [12]$/.test(p.name) ? null : "NO PLAYER";
    }
    case "storyline":
      return st.x && st.x.stories ? null : st.x && st.x.card === "storyline" ? null : "NO STORIES YET";
    case "picks":
      return tw.chat === "off" || !tw.chat ? "TWITCH CHAT OFF" : null;
    case "poll":
      return tw.chat === "off" || !tw.chat ? "TWITCH CHAT OFF" : st.x && (st.x.pollLast || st.x.poll) ? null : "NO POLL YET";
    case "twpred":
      return st.x && st.x.tw ? null : "NOT ALLOWED";
    case "music":
    case "duck":
      return st.x && st.x.music ? null : "NO MUSIC";
    case "ext": {
      const L = st.x && st.x.ext || [];
      return L.some((e) => e.id === s.ext) || !s.ext && L.length ? null : "NO EXTENSION";
    }
    default:
      return null;
  }
}
var ANIM = { step: 50, trans: 300, wave: 28, cycle: 3200, sweep: 900, restFps: 2, sweepFps: 10, budget: 70 };
var animT = null;
var sentTimes = [];
var nowMs = () => Date.now();
function push(c, ctx, svg) {
  const img = dataUrl(svg);
  c.shown = svg;
  if (img === c.image) return;
  c.image = img;
  sentTimes.push(nowMs());
  send("setImage", { context: ctx, payload: { image: img, target: 0 } });
}
function paint(ctx, svg, sig) {
  const c = contexts.get(ctx);
  if (!c) return;
  if (c.final === svg && c.image) return;
  const was = c.final, wasState = art.stateOf(was), st = art.stateOf(svg);
  const swap = !!was && (c.sig !== sig || wasState !== st && (wasState === "off" || st === "off" || wasState === "idle" !== (st === "idle")));
  c.final = svg;
  c.sig = sig;
  c.live = st === "lit" || st === "hot" ? st : "";
  if (c.phase === void 0) c.phase = Math.random() * ANIM.cycle;
  if (swap && online) {
    const col = c.coords && Number(c.coords.column) || 0;
    c.trans = { from: c.shown || was, t0: nowMs() + col * ANIM.wave };
    c.lastF = 0;
  } else if (!c.trans) push(c, ctx, c.live ? art.shine(svg, -1, c.live === "hot") : svg);
  if (c.trans || c.live) tickSoon();
}
function pressFx(ctx) {
  const c = contexts.get(ctx);
  if (!c || !c.final) return;
  c.press = nowMs() + 120;
  tickSoon();
}
function tickSoon() {
  if (!animT) animT = setTimeout(tick, ANIM.step);
}
function frameOf(c, t) {
  let s = c.final;
  if (c.live) {
    const p = (t + c.phase) % ANIM.cycle / ANIM.cycle, sw = ANIM.sweep / ANIM.cycle;
    s = art.shine(s, p < sw ? p / sw : -1, c.live === "hot");
  }
  if (c.trans) {
    const e = (t - c.trans.t0) / ANIM.trans;
    if (e >= 1) c.trans = null;
    else if (e > 0) s = art.blend(c.trans.from, s, e);
    else s = c.trans.from;
  }
  if (c.press && t < c.press) s = art.pressed(s);
  else c.press = 0;
  return s;
}
function tick() {
  animT = null;
  const t = nowMs();
  sentTimes = sentTimes.filter((x) => t - x < 1e3);
  let busy = sentTimes.length > ANIM.budget, more = false;
  for (const [ctx, c] of contexts) {
    if (!c.final) continue;
    const moving = !!(c.trans || c.press);
    if (!moving && !c.live) continue;
    more = true;
    if (busy && !moving) continue;
    if (busy && c.trans) {
      c.trans = null;
      push(c, ctx, c.final);
      continue;
    }
    let every = ANIM.step;
    if (!moving && c.live) {
      const p = (t + c.phase) % ANIM.cycle / ANIM.cycle;
      every = p < ANIM.sweep / ANIM.cycle ? 1e3 / ANIM.sweepFps : 1e3 / ANIM.restFps;
    }
    if (t - (c.lastF || 0) < every - 5) continue;
    c.lastF = t;
    push(c, ctx, frameOf(c, t));
  }
  if (more) animT = setTimeout(tick, ANIM.step);
}
function pushToPI(ctx) {
  const c = contexts.get(ctx);
  if (!c) return;
  send("sendToPropertyInspector", { action: c.real || c.action, context: ctx, payload: {
    online,
    address: base,
    configured: globals.address || "",
    layouts: status && status.layouts || [],
    layout: status && status.layout,
    screens: status && status.screens || [],
    version: status && status.version
  } });
}
var HOLD_MS = 450;
function keyDown(ctx) {
  const c = contexts.get(ctx);
  if (!c) return;
  pressFx(ctx);
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1;
  switch (kind(c.action)) {
    case "score": {
      const mode = s.mode || "tapHold";
      if (mode === "add") return act({ action: "score", side, delta: 1 });
      if (mode === "subtract") return act({ action: "score", side, delta: -1 });
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "score", side, delta: -1 });
      }, HOLD_MS);
      return;
    }
    case "reset":
      if (s.holdClear) {
        c.held = false;
        c.holdTimer = setTimeout(() => {
          c.held = true;
          act({ action: "clear" }, ctx, true);
        }, 650);
        return;
      }
      if (s.hold) {
        c.held = false;
        c.holdTimer = setTimeout(() => {
          c.held = true;
          act({ action: "reset" }, ctx, true);
        }, 700);
        return;
      }
      return act({ action: "reset" });
    case "page": {
      const d = devices.get(c.device) || {}, sz = d.size || {}, P = pagesFor(sz.columns || (d.type === 2 ? 8 : 5), sz.rows || (d.type === 2 ? 4 : 3));
      if (!P) return;
      pages.set(c.device, ((pages.get(c.device) || 0) + 1) % P.length);
      for (const x of contexts.values()) if (x.device === c.device) resolveSlot(x);
      renderAll();
      return;
    }
    case "swap":
      return act({ action: "swap" });
    case "undo":
      return act({ action: "undoAny" }, ctx);
    // one Undo: takes back a format result too, when that was the last thing
    case "hideall":
      return act({ action: "hideAll" }, ctx, true);
    case "stinger":
      return act({ action: "stinger" }, ctx);
    case "clear":
      return act({ action: "clear" }, ctx, true);
    case "vs": {
      if (s.style === "full" || s.style === "glass") return act({ action: "vs", style: s.style, show: "toggle" }, ctx);
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "vsstyle", style: "toggle" }, ctx);
      }, 650);
      return;
    }
    case "comm":
      return act({ action: "comm", show: "toggle" }, ctx);
    case "vsstyle":
      return act({ action: "vsstyle", style: "toggle" }, ctx);
    case "playervs":
      return act({ action: "playervs", show: "toggle" }, ctx);
    case "flock":
      return act({ action: "format", do: "lock", toggle: true }, ctx, true);
    case "funlock":
      return act({ action: "format", do: "unlock" }, ctx, true);
    case "tempo": {
      act({ action: "tempo", do: "tap" }, ctx, true);
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "tempo", do: "off" }, ctx, true);
      }, 700);
      return;
    }
    case "autopilot":
      return act({ action: "autopilot", do: "toggle" }, ctx, true);
    case "replay":
      return act({ action: "replay" }, ctx, true);
    case "automation": {
      const L = status && status.autos || [], a = L.find((x) => x.id === s.auto || x.name.toLowerCase() === String(s.auto || "").toLowerCase()) || !s.auto && L[0];
      if (!a) return send("showAlert", { context: ctx });
      return act({ action: "automation", id: a.id }, ctx, true);
    }
    case "chapter":
      return act({ action: "chapter", label: s.label || "Highlight" }, ctx, true).then(() => {
        c.flash = "MARKED";
        render(ctx);
        setTimeout(() => {
          c.flash = "";
          render(ctx);
        }, 1500);
      });
    case "stats":
      return act({ action: "stats", side: Number(s.side) === 2 ? 2 : 1, show: "toggle" }, ctx, true);
    case "sponsor": {
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "sponsor", do: "toggle" }, ctx, true);
      }, 650);
      return;
    }
    case "bracket":
      return loading(ctx, act({ action: "splash", kind: "bracket", show: "toggle" }, ctx));
    case "top8":
      return loading(ctx, act({ action: "splash", kind: "top8", show: "toggle" }, ctx));
    case "standings":
      return loading(ctx, act({ action: "splash", kind: "standings", show: "toggle" }, ctx));
    case "postlink":
      return act({ action: "postlink" }, ctx, true);
    case "sggreport":
      return act({ action: "sggreport" }, ctx, true);
    case "loser":
      return act({ action: "loser", side }, ctx);
    case "player":
      return act({ action: "pick", side }, ctx);
    case "fnext": {
      const f = status && status.format;
      if (!f) return;
      if (f.pending) return act({ action: "format", do: "confirm" }, ctx);
      return;
    }
    case "fundo":
      return act({ action: "format", do: "undo" }, ctx);
    case "fxq":
      return act({ action: "fxq", quality: s.fxq || "cycle" }, ctx);
    case "obsrefresh":
      c.flash = "\u2026";
      render(ctx);
      return act({ action: "obsrefresh" }, ctx, true).then((r) => {
        c.flash = r && r.ok ? "DONE" : "FAILED";
      }, () => {
        c.flash = "FAILED";
      }).finally(() => {
        render(ctx);
        setTimeout(() => {
          c.flash = "";
          render(ctx);
        }, 1600);
      });
    case "sound":
      return act(s.smode === "up" || s.smode === "down" ? { action: "sound", step: s.smode === "up" ? 10 : -10 } : { action: "sound", on: "toggle" }, ctx);
    case "vtopen":
      return act({ action: "vt", do: "open", open: "toggle" }, ctx);
    case "vtnext":
      return act({ action: "vt", do: "next" }, ctx);
    case "vtjoin":
      return act({ action: "vtjoin", show: "toggle" }, ctx);
    case "vtbracket":
      return act({ action: "vtbracket", show: "toggle" }, ctx);
    case "fbar":
      return act({ action: "fbar", show: "toggle" }, ctx);
    case "fswitch":
      return act({ action: "fswitch", side }, ctx);
    case "fsplash":
      return act({ action: "format", do: "splash", kind: s.kind || "fboard", show: "toggle" }, ctx);
    case "screen": {
      const list = status && status.screens || [], sc = list.find((x) => x.id === s.screen) || list.find((x) => x.name === s.screenName);
      return act({ action: "screen", name: sc ? sc.id : s.screenName || s.screen || "", show: "toggle" }, ctx);
    }
    case "layout":
      return act(s.mode === "specific" ? { action: "layout", name: s.layout } : { action: "layout", name: "next", sameGame: s.mode !== "any" }, ctx);
    case "bracketrefresh": {
      c.busy = true;
      render(ctx);
      return act({ action: "bracketRefresh" }, ctx, true).finally(() => {
        c.busy = false;
        c.flash = "UPDATED";
        render(ctx);
        setTimeout(() => {
          c.flash = "";
          render(ctx);
        }, 1500);
      });
    }
    case "latency":
      return act({ action: "latencyTest" }, ctx, true);
    case "viewernext": {
      c.busy = true;
      render(ctx);
      return act({ action: "viewerNext" }, ctx).finally(() => {
        c.busy = false;
        render(ctx);
      });
    }
    case "viewerresult": {
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "viewerResult", who: s.who === "viewer" ? "viewer" : "streamer", delta: -1 }, ctx);
      }, HOLD_MS);
      return;
    }
    case "viewerqueue":
      return act({ action: "viewerQueue", open: "toggle" }, ctx);
    case "viewersplash":
      return act({ action: "viewerSplash", show: "toggle" }, ctx);
    case "viewersidebar":
      return act({ action: "viewerSidebar", show: "toggle" }, ctx);
    case "victory":
      return act({ action: "victory", show: "toggle" }, ctx);
    case "bracketside":
      return loading(ctx, act({ action: "bracketSide", side: s.bside === "W" || s.bside === "L" ? s.bside : "toggle" }, ctx));
    case "nextmatch": {
      c.busy = true;
      render(ctx);
      return act({ action: "nextMatch" }, ctx, true).finally(() => {
        c.busy = false;
        render(ctx);
      });
    }
    // 1.12.18: the show — tap does it; the rundown (back a segment) and the storyline (the next one) also have a hold
    case "rundown":
    case "storyline":
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act(kind(c.action) === "rundown" ? { action: "rundown", do: "prev" } : { action: "storyline", do: "next" }, ctx, true);
      }, 650);
      return;
    // 1.12.21: the set as it's told — the set timer: tap starts and stops it, hold takes it off the stream
    case "settimer":
      c.held = false;
      c.holdTimer = setTimeout(() => {
        c.held = true;
        act({ action: "timer", do: "hide" }, ctx, true);
      }, 650);
      return;
    case "moments":
      return act({ action: "moments", do: "toggle" }, ctx, true);
    case "momentreplay":
      return flashing(ctx, act({ action: "moments", do: "replay" }, ctx, true), "ON STREAM");
    case "h2h":
      return act({ action: "h2h" }, ctx);
    case "statsstrip":
      return act({ action: "strip", do: "toggle" }, ctx, true);
    // 1.12.23
    case "greset":
      return act({ action: "greset" }, ctx);
    case "countdown":
      return act({ action: "countdown" }, ctx);
    case "cdplus":
      return flashing(ctx, act({ action: "countdown", do: "plus", mins: Math.max(1, Math.min(10, Number(s.mins) || 1)) }, ctx), `+${Math.max(1, Math.min(10, Number(s.mins) || 1))} MIN`);
    // 1.12.19
    case "schedule":
      return act({ action: "schedule" }, ctx);
    case "walkin":
      return act({ action: "walkin", side }, ctx);
    case "evstats":
      return act({ action: "evstats" }, ctx);
    case "season":
      return act({ action: "season" }, ctx);
    case "rehearsal":
      return act({ action: "rehearsal" }, ctx, true);
    case "replayslow":
      return act({ action: "replaySlow", speed: Number(s.speed) || 50 }, ctx);
    case "replayfreeze":
      return act({ action: "replayFreeze" }, ctx);
    case "drawclear":
      return act({ action: "drawClear" }, ctx, true);
    case "clip":
      return flashing(ctx, act({ action: "clip" }, ctx, true), "CLIPPING\u2026");
    case "results":
      return flashing(ctx, act({ action: "results" }, ctx, true), "IN THE APP");
    case "picks":
      return act({ action: "pred", do: "predToggle" }, ctx);
    case "poll":
      return act({ action: "poll", do: "pollToggle" }, ctx);
    case "twpred":
      return act({ action: "twpred", do: "toggle" }, ctx);
    case "music":
      return act({ action: "music", do: "toggle" }, ctx);
    case "duck":
      return act({ action: "music", do: "duck" }, ctx);
    case "ext": {
      const L = status && status.x && status.x.ext || [], e = L.find((x) => x.id === s.ext) || !s.ext && L[0];
      if (!e) return send("showAlert", { context: ctx });
      const cue = s.cue || e.screens[0] && e.screens[0].id || e.cues[0] && e.cues[0].id;
      return act({ action: "ext", ext: e.id, cue, screen: e.screens.some((x) => x.id === cue) ? cue : void 0 }, ctx);
    }
  }
}
function flashing(ctx, p, word) {
  const c = contexts.get(ctx);
  if (!c) return p;
  c.flash = word;
  render(ctx);
  return Promise.resolve(p).finally(() => setTimeout(() => {
    c.flash = "";
    render(ctx);
  }, 1600));
}
var mmss = (ms) => {
  const t = Math.max(0, Math.round((Number(ms) || 0) / 1e3)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, q = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(q).padStart(2, "0");
};
var setClock = (ms) => {
  const t = Math.max(0, Math.floor((Number(ms) || 0) / 1e3)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), z = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${z(m)}:${z(t % 60)}` : `${z(m)}:${z(t % 60)}`;
};
var cut = (t, n) => {
  t = String(t || "");
  return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
};
var SHOWKEYS = {
  rundown: (x) => {
    const r = x.rd || {};
    return { g: "rundown", name: r.name ? "NEXT" : "START", sub: r.name ? r.left != null ? `${mmss(r.left)} \xB7 ${cut(r.name, 9)}` : cut(r.name, 16) : cut(r.next || "THE RUNDOWN", 16), on: !!r.name };
  },
  countdown: (x) => ({ g: "countdown", name: "COUNTDOWN", on: x.full === "countdown" }),
  cdplus: (x, s) => ({ g: "cdPlus", name: `+${Math.max(1, Math.min(10, Number(s.mins) || 1))} MIN`, sub: "COUNTDOWN" }),
  // 1.12.19
  schedule: (x) => ({ g: "schedule", name: "COMING UP", on: x.full === "schedule" }),
  walkin: (x, s, st) => {
    const side = Number(s.side) === 2 ? 2 : 1, p = st["p" + side] || {};
    return { g: "walkin", name: "WALK-IN", sub: cut(p.name || `PLAYER ${side}`, 14), on: x.full === "walkin" && Number(x.fullSide) === side };
  },
  storyline: (x) => ({ g: "storyline", name: "STORYLINE", sub: x.stories ? `${x.stories} \xB7 HOLD: NEXT` : "", on: x.card === "storyline" }),
  evstats: (x) => ({ g: "evstats", name: "NUMBERS", sub: "THE EVENT", on: x.full === "evstats" }),
  season: (x) => ({ g: "season", name: "SEASON", sub: "THE TABLE", on: x.full === "season" }),
  rehearsal: (x) => ({ g: "rehearsal", name: x.reh ? "STOP" : "REHEARSE", sub: x.reh ? "REHEARSING" : "", on: !!x.reh }),
  replayslow: (x, s) => ({ g: "slowmo", name: "SLOW-MO", sub: x.replay && x.replay.speed < 100 ? `${x.replay.speed}%` : `${Number(s.speed) || 50}%`, on: !!(x.replay && x.replay.speed < 100) }),
  replayfreeze: (x) => ({ g: "freeze", name: x.replay && x.replay.frozen ? "FROZEN" : "FREEZE", on: !!(x.replay && x.replay.frozen) }),
  drawclear: () => ({ g: "drawClear", name: "CLEAR", sub: "THE DRAWING" }),
  clip: (x, s, st, c) => ({ g: "clip", name: "CLIP THIS", sub: c.flash || "VERTICAL" }),
  results: (x, s, st, c) => ({ g: "results", name: "RESULTS", sub: c.flash || "GRAPHICS" }),
  picks: (x) => ({ g: "picks", name: "PICKS", sub: x.pred ? x.pred.open ? `OPEN \xB7 ${x.pred.total}` : `${x.pred.pct1}% \xB7 ${100 - x.pred.pct1}%` : "OPEN THEM", on: !!(x.pred && x.pred.open) }),
  poll: (x) => ({ g: "poll", name: "POLL", sub: x.poll ? x.poll.open ? "OPEN \xB7 TAP: END" : "CLOSED" : "START AGAIN", on: !!(x.poll && x.poll.open) }),
  twpred: (x) => {
    const t = x.tw && x.tw.status || "";
    return { g: "twpred", name: "PREDICTION", sub: t === "ACTIVE" ? "OPEN \xB7 TAP: LOCK" : t === "LOCKED" ? "LOCKED \xB7 TAP: PAY" : t ? t : "START ONE", on: t === "ACTIVE" || t === "LOCKED" };
  },
  music: (x) => ({ g: "music", name: "MUSIC", sub: x.music && x.music.on ? "PLAYING" : "OFF", on: !!(x.music && x.music.on) }),
  duck: (x) => ({ g: "duck", name: "DUCK", sub: x.music && x.music.duck ? "TURNED DOWN" : "", on: !!(x.music && x.music.duck) }),
  // 1.12.21: the set as it's told
  moments: (x) => {
    const mo = x.mo || {};
    return { g: "moments", name: "MOMENTS", sub: mo.on === false ? "OFF" : mo.now ? cut(String(mo.last || "ON STREAM").toUpperCase(), 16) : "ON", on: mo.on !== false };
  },
  momentreplay: (x, s, st, c) => {
    const mo = x.mo || {};
    return { g: "momentReplay", name: "REPLAY", sub: c.flash || (mo.last ? cut(String(mo.last).toUpperCase(), 16) : "THE MOMENT"), on: !!mo.now };
  },
  h2h: (x) => ({ g: "h2h", name: "HEAD TO HEAD", sub: x.h2h ? "ON STREAM" : "THE LINE", on: !!x.h2h }),
  statsstrip: (x) => ({ g: "statsStrip", name: "STATS STRIP", sub: x.strip === false ? "OFF" : "ON FULLVS", on: x.strip !== false }),
  // 1.12.23
  greset: (x) => ({ g: "gresetSplash", name: "BRACKET RESET", sub: x.full === "greset" ? "ON STREAM" : "SPLASH", on: x.full === "greset" }),
  settimer: (x) => {
    const t = x.timer || {};
    return { g: "setTimer", name: t.show ? setClock(t.ms) : "SET TIMER", sub: !t.show ? "TAP: START" : t.run ? "TAP: STOP \xB7 HOLD: HIDE" : "STOPPED \xB7 HOLD: HIDE", on: !!(t.show && t.run) };
  },
  ext: (x, s) => {
    const L = x.ext || [], e = L.find((y) => y.id === s.ext) || !s.ext && L[0];
    const cue = e && (s.cue || e.screens[0] && e.screens[0].id || e.cues[0] && e.cues[0].id), it = e && [...e.screens, ...e.cues].find((y) => y.id === cue);
    return { g: "ext", name: cut(it ? it.label.toUpperCase() : "EXTENSION", 12), sub: e ? cut(e.name.toUpperCase(), 16) : "" };
  }
};
function loading(ctx, p) {
  const c = contexts.get(ctx);
  if (!c) return p;
  const t = setTimeout(() => {
    c.loading = true;
    render(ctx);
  }, 250);
  return Promise.resolve(p).finally(() => {
    clearTimeout(t);
    if (c.loading) {
      c.loading = false;
      render(ctx);
    }
  });
}
function keyUp(ctx) {
  const c = contexts.get(ctx);
  if (!c || !c.holdTimer) return;
  clearTimeout(c.holdTimer);
  c.holdTimer = null;
  const s = c.settings || {}, side = Number(s.side) === 2 ? 2 : 1;
  if (!c.held && kind(c.action) === "score") act({ action: "score", side, delta: 1 });
  if (!c.held && kind(c.action) === "viewerresult") act({ action: "viewerResult", who: s.who === "viewer" ? "viewer" : "streamer", delta: 1 }, ctx);
  if (!c.held && kind(c.action) === "vs") act({ action: "vs", show: "toggle" }, ctx);
  if (!c.held && kind(c.action) === "sponsor") act({ action: "sponsor", do: "next" }, ctx, true);
  if (!c.held && kind(c.action) === "rundown") act({ action: "rundown", do: "next" }, ctx, true);
  if (!c.held && kind(c.action) === "storyline") act({ action: "storyline" }, ctx);
  if (!c.held && kind(c.action) === "settimer") act({ action: "timer", do: "toggle" }, ctx, true);
  if (!c.held && kind(c.action) === "reset" && s.holdClear) act({ action: "reset" }, ctx);
  else if (!c.held && kind(c.action) === "reset" && s.hold) send("showAlert", { context: ctx });
}
function onMessage(raw) {
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  const { event, context: ctx, action, payload = {} } = m;
  switch (event) {
    case "willAppear":
      {
        const c = { action, real: action, device: m.device, coords: payload.coordinates || null, settings: payload.settings || {}, controller: payload.controller || "Keypad", image: null, title: null, state: payload.state, feedback: null };
        contexts.set(ctx, c);
        resolveSlot(c);
      }
      render(ctx);
      if (!status) poll();
      break;
    case "willDisappear": {
      const c = contexts.get(ctx);
      if (c && c.holdTimer) clearTimeout(c.holdTimer);
      contexts.delete(ctx);
      break;
    }
    case "didReceiveSettings": {
      const c = contexts.get(ctx);
      if (c && kind(c.real) !== "slot") {
        c.settings = payload.settings || {};
        c.image = null;
        render(ctx);
      }
      break;
    }
    case "deviceDidConnect":
      if (m.device) {
        devices.set(m.device, { id: m.device, ...m.deviceInfo || {} });
        for (const c of contexts.values()) if (c.device === m.device && resolveSlot(c)) {
        }
        renderAll();
        reportDevices();
      }
      break;
    case "deviceDidDisconnect":
      if (m.device) {
        devices.delete(m.device);
        reportDevices();
      }
      break;
    case "didReceiveGlobalSettings": {
      const g = payload.settings || {};
      if ((g.address || "") !== (globals.address || "")) {
        base = "";
        status = null;
      }
      globals = { address: "", ...g };
      poll();
      break;
    }
    case "keyDown":
      keyDown(ctx);
      break;
    case "keyUp":
      keyUp(ctx);
      break;
    case "dialRotate": {
      const c = contexts.get(ctx);
      if (!c || kind(c.action) !== "score") break;
      const side = Number((c.settings || {}).side) === 2 ? 2 : 1, ticks = Math.max(-5, Math.min(5, Number(payload.ticks) || 0));
      if (ticks) act({ action: "score", side, delta: ticks });
      break;
    }
    case "dialDown":
    case "touchTap": {
      const c = contexts.get(ctx);
      if (!c || kind(c.action) !== "score") break;
      const side = Number((c.settings || {}).side) === 2 ? 2 : 1;
      act({ action: "score", side, delta: event === "touchTap" && payload.hold ? -1 : 1 });
      break;
    }
    case "propertyInspectorDidAppear": {
      const c = contexts.get(ctx);
      if (c) {
        c.pi = true;
        pushToPI(ctx);
        poll();
      }
      break;
    }
    case "propertyInspectorDidDisappear": {
      const c = contexts.get(ctx);
      if (c) c.pi = false;
      break;
    }
    case "sendToPlugin":
      if (payload.refresh) {
        base = "";
        poll().then(() => pushToPI(ctx));
      }
      if (payload.openApp) send("openUrl", { payload: { url: (base || CANDIDATES[0]) + "/" } });
      break;
    case "systemDidWakeUp":
      base = "";
      poll();
      break;
  }
}
function connect() {
  if (!PORT) {
    console.error("Start this from Stream Deck.");
    process.exit(1);
  }
  ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  ws.on("open", () => {
    send(REGISTER, { uuid: PLUGIN_UUID });
    send("getGlobalSettings", { context: PLUGIN_UUID });
    log("connected");
  });
  ws.on("message", (d) => onMessage(String(d)));
  ws.on("close", () => process.exit(0));
  ws.on("error", () => {
  });
}
connect();
setInterval(poll, 700);
module.exports = { onMessage, contexts, devices, _state: () => ({ base, online, status }) };
