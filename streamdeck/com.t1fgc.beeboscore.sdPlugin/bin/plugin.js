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
    function push(dest, name, elem) {
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
              push(offers, name, params);
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
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
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
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
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
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
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

// src/art.js
var require_art = __commonJS({
  "src/art.js"(exports2, module2) {
    "use strict";
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
    function frame(inner, { bg = INK, accent = null, dim = false } = {}) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="${bg}"/>` + (accent ? `<rect width="144" height="10" fill="${accent}"/>` : "") + inner + (dim ? `<rect width="144" height="144" fill="rgba(0,0,0,.6)"/><text x="72" y="134" ${FONT} font-size="15" font-weight="800" fill="#ff8a8a" text-anchor="middle" letter-spacing="1">APP OFFLINE</text>` : "") + `</svg>`;
    }
    var label = (t, y = 128, size = 17, fill = "#fff", ls = 1.5) => `<text x="72" y="${y}" ${FONT} font-size="${size}" font-weight="800" fill="${fill}" text-anchor="middle" letter-spacing="${ls}">${esc(t)}</text>`;
    var ICONS = {
      speaker: (c, on = true) => `<path d="M26 56h20l28-24v80L46 88H26z" fill="${c}" stroke="${c}" stroke-width="4" stroke-linejoin="round"/>` + (on ? `<g fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"><path d="M90 54a24 24 0 0 1 0 36"/><path d="M102 40a44 44 0 0 1 0 64"/></g>` : `<path d="M92 56l28 32M120 56l-28 32" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`),
      reset: (c) => `<path d="M72 34a38 38 0 1 1-36.6 27.8" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M28 30l9 34 30-14z" fill="${c}"/>`,
      swap: (c) => `<path d="M30 54h72" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M90 36l24 18-24 18z" fill="${c}"/><path d="M114 90H42" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M54 72L30 90l24 18z" fill="${c}"/>`,
      undo: (c) => `<path d="M46 62h44a24 24 0 0 1 0 48H58" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M52 36L24 62l28 26z" fill="${c}"/>`,
      next: (c) => `<path d="M30 30l52 42-52 42z" fill="${c}"/><rect x="92" y="30" width="16" height="84" rx="4" fill="${c}"/>`,
      clear: (c) => `<path d="M38 38l68 68M106 38l-68 68" stroke="${c}" stroke-width="12" stroke-linecap="round"/>`,
      layout: (c) => `<rect x="26" y="26" width="92" height="22" rx="5" fill="${c}"/><rect x="26" y="56" width="42" height="56" rx="5" fill="${c}" opacity=".8"/><rect x="76" y="56" width="42" height="56" rx="5" fill="${c}" opacity=".55"/>`,
      bracket: (c) => `<g fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 26H42V50H14M42 38H66"/><path d="M14 94H42V118H14M42 106H66"/><path d="M66 38V106M66 72H88"/></g><path d="M94 50h38v10a19 19 0 0 1-38 0z" fill="${c}"/><path d="M95 54h-8a10 10 0 0 0 10 13M131 54h8a10 10 0 0 1-10 13" fill="none" stroke="${c}" stroke-width="5"/><rect x="108" y="78" width="10" height="12" fill="${c}"/><rect x="99" y="89" width="28" height="7" rx="2" fill="${c}"/>`,
      refresh: (c) => `<path d="M104 40a46 46 0 1 0 12 30" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/><path d="M118 18v34H84z" fill="${c}"/>`,
      // download-into-tray: "pull the latest results" (deliberately nothing like the round Reset arrow)
      pull: (c) => `<path d="M72 14v62" stroke="${c}" stroke-width="13" stroke-linecap="round"/><path d="M40 58l32 34 32-34z" fill="${c}" stroke="${c}" stroke-width="6" stroke-linejoin="round"/><path d="M22 92v24a8 8 0 0 0 8 8h84a8 8 0 0 0 8-8V92" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
      eye: (c) => `<path d="M12 72C30 40 50 28 72 28s42 12 60 44c-18 32-38 44-60 44S30 104 12 72z" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round"/><circle cx="72" cy="72" r="19" fill="${c}"/>`,
      bolt: (c) => `<path d="M104 18 L86 58 L100 60 L84 98 L118 50 L103 48 L116 18z" fill="${c}"/>`,
      trophy: (c) => `<path d="M40 22h64v22a32 32 0 0 1-64 0z" fill="${c}"/><path d="M40 30H22v8a20 20 0 0 0 20 20M104 30h18v8a20 20 0 0 1-20 20" fill="none" stroke="${c}" stroke-width="8"/><rect x="64" y="74" width="16" height="20" fill="${c}"/><rect x="46" y="94" width="52" height="12" rx="3" fill="${c}"/>`,
      twitch: (c) => `<path transform="scale(6)" fill="${c}" d="M4.3 2 3 5.4v13.4h4.6V21h2.6l2.4-2.3h3.6L21 14V2zm15 11.2-2.7 2.7h-4.3l-2.4 2.3v-2.3H6.3V3.6h13zM16.6 6.8v4.7h-1.7V6.8zm-4.6 0v4.7h-1.7V6.8z"/>`,
      person: (c) => `<circle cx="72" cy="52" r="22" fill="${c}"/><path d="M28 112c4-28 22-42 44-42s40 14 44 42z" fill="${c}"/>`
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
      reset: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.reset("#fff")}</g>` + label("RESET"), { accent: BEE, dim: offline }),
      swap: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.swap("#fff")}</g>` + label("SWAP"), { accent: BEE, dim: offline }),
      undo: ({ offline } = {}) => frame(`<g transform="translate(18,8) scale(.75)">${ICONS.undo("#fff")}</g>` + label("UNDO"), { accent: BEE, dim: offline }),
      nextmatch: ({ offline, label: l } = {}) => frame(`<g transform="translate(6,-12) scale(.92)">${ICONS.next(BEE)}</g>` + label(l || "NEXT MATCH", 130, 15), { dim: offline }),
      clear: ({ offline } = {}) => frame(`<g transform="translate(14,2) scale(.8)">${ICONS.clear("#fff")}</g>` + label("NEXT SET", 130, 16), { accent: BEE, dim: offline }),
      vs({ on = false, offline = false } = {}) {
        return on ? frame(`<text x="72" y="92" ${FONT} font-size="74" font-weight="900" font-style="italic" fill="${INK}" text-anchor="middle">VS</text>` + label("ON AIR", 128, 16, INK, 3), { bg: BEE, dim: offline }) : frame(`<text x="72" y="92" ${FONT} font-size="74" font-weight="900" font-style="italic" fill="none" stroke="#fff" stroke-width="3" text-anchor="middle">VS</text>` + label("VS SPLASH", 128, 15, "rgba(255,255,255,.7)", 2), { dim: offline });
      },
      player({ side = 1, name = "", offline = false } = {}) {
        const c = sideColor(side), n = short(name || "Set name", 12);
        return frame(`<g transform="translate(36,14) scale(.5)">${ICONS.person("#fff")}</g><text x="72" y="104" ${FONT} font-size="${fit(n, 8, 22, 13)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(n)}</text>` + label(`PLAYER ${side} \u270E`, 132, 13, "rgba(255,255,255,.7)", 1.5), { accent: c, dim: offline });
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
        const bubble = `<path d="M24 30h96a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H62l-22 18v-18H24a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" fill="${flash ? "#fff" : ready ? C : "#2b2d36"}"/>`;
        const link = `<g fill="none" stroke="${flash ? C : "#fff"}" stroke-width="7" stroke-linecap="round"><path d="M60 70l24-24"/><path d="M52 62l-6 6a10 10 0 0 0 14 14l6-6"/><path d="M92 54l6-6a10 10 0 0 0-14-14l-6 6"/></g>`;
        return frame(bubble + link + label(flash ? "POSTED" : ready ? "POST LINK" : "NOT SHARED", 132, ready ? 15 : 12, ready || flash ? "#fff" : "rgba(255,255,255,.45)", 1.5), { bg: "#0a0a0e", accent: ready ? C : null, dim: offline });
      },
      sggReport({ ready = false, sent = false, mode = "ask", offline = false, flash = false } = {}) {
        const C = "#3f8cff", on = ready || sent;
        const arrow = `<g fill="none" stroke="${flash || sent ? "#fff" : on ? C : "rgba(255,255,255,.4)"}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M72 84V30"/><path d="M50 52l22-22 22 22"/><path d="M34 76v20h76V76"/></g>`;
        return frame(arrow + label(flash ? "SENT!" : sent ? "REPORTED" : ready ? "REPORT" : mode === "off" ? "REPORTS OFF" : "NO RESULT", 132, on ? 15 : 12, on ? "#fff" : "rgba(255,255,255,.45)", 1.5), { bg: sent ? "#1c4fa8" : "#0a0a0e", accent: ready && !sent ? C : null, dim: offline });
      },
      standings({ on = false, ready = false, offline = false } = {}) {
        const GOLD = "#f2c14e";
        const bars = [[52, 40, 1], [16, 62, 2], [88, 74, 3]].map(([x, y, n]) => `<rect x="${x}" y="${y}" width="36" height="${108 - y}" fill="${on ? "#fff" : n === 1 ? GOLD : "#3a3d48"}" opacity="${on ? n === 1 ? 1 : 0.7 : 1}"/><text x="${x + 18}" y="${y + 26}" ${FONT} font-size="22" font-weight="900" fill="${on ? "#5a0812" : n === 1 ? "#2a1a04" : "#fff"}" text-anchor="middle">${n}</text>`).join("");
        return frame(
          bars + label(on ? "ON AIR" : ready ? "STANDINGS" : "NO RESULTS", 132, ready || on ? 15 : 12, on ? "#fff" : ready ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.45)", 1.5),
          { bg: on ? "#c3132d" : "#0a0a0e", accent: on ? null : GOLD, dim: offline }
        );
      },
      top8({ on = false, offline = false, label: l } = {}) {
        const CR = "#e0263f";
        const body = `<g transform="translate(30,34) scale(.8)" opacity="${on ? 0.4 : 0.95}">${ICONS.bolt(on ? "#fff" : "#c9d4ff")}</g><text x="58" y="44" ${FONT} font-size="26" font-weight="900" font-style="italic" fill="${on ? "#fff" : "#e8eaf0"}" text-anchor="middle" letter-spacing="3">TOP</text><text x="58" y="108" ${FONT} font-size="76" font-weight="900" font-style="italic" fill="${on ? "#fff" : CR}" text-anchor="middle">8</text>` + label(on ? "ON AIR" : l || "SPLASH", 132, l && !on ? 13 : 16, on ? "#fff" : "rgba(255,255,255,.7)", on ? 3 : l ? 1 : 2);
        const bg = on ? "" : `<defs><radialGradient id="t8g" cx=".5" cy="1" r=".9"><stop offset="0" stop-color="#5a0812"/><stop offset="1" stop-color="#0a0a0e"/></radialGradient></defs><rect width="144" height="144" fill="url(#t8g)"/>`;
        return frame(bg + body, { bg: on ? CR : "#0a0a0e", accent: on ? null : CR, dim: offline });
      },
      loser({ side = 1, on = false, offline = false } = {}) {
        const c = sideColor(side);
        return frame(`<text x="72" y="90" ${FONT} font-size="66" font-weight="900" fill="${on ? INK : "#fff"}" text-anchor="middle">[L]</text>` + label(`PLAYER ${side}`, 128, 15, on ? INK : "rgba(255,255,255,.7)", 2), { bg: on ? c : INK, accent: on ? null : c, dim: offline });
      },
      // ---- viewer matches (Twitch Stuff)
      viewerNext({ next = "", count = 0, busy = false, offline = false } = {}) {
        const n = short(next || "", 12);
        return frame(`<g transform="translate(10,22) scale(.22)">${ICONS.twitch(TW2)}</g><text x="132" y="44" ${FONT} font-size="26" font-weight="900" fill="#fff" text-anchor="end">${count}</text><g transform="translate(46,40) scale(.36)">${ICONS.next("#fff")}</g><text x="72" y="110" ${FONT} font-size="${n ? fit(n, 9, 19, 12) : 14}" font-weight="800" fill="${n ? "#fff" : "rgba(255,255,255,.55)"}" text-anchor="middle">${esc(n || "QUEUE EMPTY")}</text>` + label(busy ? "LOADING\u2026" : "NEXT VIEWER", 132, 13, TW2, 1.5), { accent: TW, dim: offline });
      },
      viewerResult({ who = "streamer", s = 0, v = 0, playing = true, offline = false } = {}) {
        const me = who !== "viewer", col = me ? OKG : TW2;
        return frame(`<rect y="10" width="144" height="134" fill="${me ? OKG : TW}" opacity=".12"/><text x="72" y="44" ${FONT} font-size="17" font-weight="800" fill="${col}" text-anchor="middle" letter-spacing="1.5">${me ? "I WON" : "THEY WON"}</text><text x="72" y="100" ${FONT} font-size="${playing ? 48 : 26}" font-weight="900" fill="#fff" text-anchor="middle">${playing ? `${s}\u2013${v}` : "NO MATCH"}</text>` + label("TAP +1 \xB7 HOLD \u22121", 132, 11, "rgba(255,255,255,.7)", 0), { accent: col, dim: offline });
      },
      viewerQueue({ open = false, count = 0, offline = false } = {}) {
        return open ? frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="${INK}" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="44" font-weight="900" fill="${INK}" text-anchor="middle">OPEN</text>` + label(`${count} WAITING`, 130, 14, INK, 1.5), { bg: OKG, dim: offline }) : frame(`<text x="72" y="52" ${FONT} font-size="22" font-weight="900" fill="rgba(255,255,255,.7)" text-anchor="middle" letter-spacing="2">QUEUE</text><text x="72" y="100" ${FONT} font-size="38" font-weight="900" fill="#fff" text-anchor="middle">CLOSED</text>` + label(count ? `${count} WAITING` : "TAP TO OPEN", 130, 13, "rgba(255,255,255,.6)", 1.5), { accent: TW, dim: offline });
      },
      // ---- Autoscore (experimental)
      autoscore({ on = false, state = "off", pending = null, offline = false } = {}) {
        const eye = (c) => `<circle cx="72" cy="56" r="30" fill="none" stroke="${c}" stroke-width="7"/><circle cx="72" cy="56" r="11" fill="${c}"/>`;
        if (!on) return frame(eye("rgba(255,160,160,.75)") + label("AUTO OFF", 116, 16, "#ffb3b3", 2) + label("EXPERIMENTAL", 134, 10, "rgba(255,200,200,.6)", 1.5), { bg: "#4a0d14", dim: offline });
        if (pending) return frame(eye(INK) + label("CONFIRM?", 116, 17, INK, 2) + label(short(pending.name, 12).toUpperCase(), 134, 11, INK, 1), { bg: BEE, dim: offline });
        const armed = state === "armed";
        return frame(eye(armed ? INK : "#fff") + label(armed ? "WATCHING" : state === "waiting" ? "WAIT 0\u20130" : "STARTING", 116, 15, armed ? INK : "#fff", 1.5) + label("AUTO ON", 134, 11, armed ? INK : OKG, 2), { bg: armed ? OKG : "#0f3b24", dim: offline });
      },
      autoscoreUndo({ ready = false, offline = false } = {}) {
        return frame(`<g transform="translate(18,6) scale(.75)" opacity="${ready ? 1 : 0.4}">${ICONS.undo("#fff")}</g>` + label("UNDO AUTO", 126, 14, ready ? "#fff" : "rgba(255,255,255,.5)", 1.5), { accent: OKG, dim: offline });
      },
      autoscoreConfirm({ pending = null, offline = false } = {}) {
        return pending ? frame(`<text x="72" y="74" ${FONT} font-size="54" font-weight="900" fill="${INK}" text-anchor="middle">+1</text>` + label(short(pending.name, 11).toUpperCase(), 108, 15, INK, 1) + label("TAP TO ADD", 132, 12, INK, 1.5), { bg: BEE, dim: offline }) : frame(`<text x="72" y="80" ${FONT} font-size="54" font-weight="900" fill="rgba(255,255,255,.35)" text-anchor="middle">+1</text>` + label("NOTHING TO OK", 126, 12, "rgba(255,255,255,.55)", 1), { accent: BEE, dim: offline });
      },
      autoscoreResync({ offline = false } = {}) {
        return frame(`<g transform="translate(22,4) scale(.7)">${ICONS.refresh("#fff")}</g>` + label("RESYNC", 126, 15, "#fff", 2), { accent: OKG, dim: offline });
      },
      viewerSidebar({ on = true, offline = false } = {}) {
        const bar = (c) => `<rect x="30" y="22" width="26" height="76" rx="3" fill="${c}"/><rect x="62" y="30" width="54" height="10" rx="3" fill="${c}" opacity=".5"/><rect x="62" y="48" width="54" height="10" rx="3" fill="${c}" opacity=".5"/><rect x="62" y="66" width="54" height="10" rx="3" fill="${c}" opacity=".5"/>`;
        return on ? frame(bar("#fff") + label("ON SCREEN", 128, 15, "#fff", 2), { bg: TW, dim: offline }) : frame(`<g opacity=".45">${bar("#fff")}</g>` + label("SIDEBAR OFF", 128, 13, "rgba(255,255,255,.7)", 1.5), { accent: TW, dim: offline });
      },
      viewerSplash({ on = false, ready = true, offline = false } = {}) {
        return on ? frame(`<text x="72" y="92" ${FONT} font-size="70" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>` + label("ON AIR", 128, 16, "#fff", 3), { bg: TW, dim: offline }) : frame(`<text x="72" y="92" ${FONT} font-size="70" font-weight="900" font-style="italic" fill="none" stroke="${ready ? TW2 : "rgba(255,255,255,.35)"}" stroke-width="3" text-anchor="middle">VS</text>` + label(ready ? "VIEWER VS" : "NO MATCH", 128, 14, "rgba(255,255,255,.7)", 2), { accent: TW, dim: offline });
      },
      // game formats: the confirm key shows the score of the battle and lights up green when a result is waiting
      formatNext({ score = "", label: l = "", pending = false, done = false, none = false, offline = false } = {}) {
        const t = none ? "NO FORMAT" : done ? "FINISHED" : short(score || "\u2014", 9);
        return frame(`<text x="72" y="${none || done ? 74 : 80}" ${FONT} font-size="${none || done ? 20 : fit(t, 5, 44, 22)}" font-weight="900" fill="${pending ? INK : "#fff"}" text-anchor="middle">${esc(t)}</text>` + (l ? `<text x="72" y="30" ${FONT} font-size="13" font-weight="700" fill="${pending ? INK : "rgba(255,255,255,.6)"}" text-anchor="middle">${esc(short(l, 18))}</text>` : "") + label(pending ? "CONFIRM \u203A" : "NEXT MATCH", 128, 15, pending ? INK : "rgba(255,255,255,.7)", 1.5), { bg: pending ? OKG : void 0, dim: offline });
      },
      formatUndo({ ready = false, offline = false } = {}) {
        return frame(`<g transform="translate(36,26) scale(.5)">${ICONS.undo(ready ? BEE : "#5d616c")}</g>` + label("UNDO", 110, 18, ready ? "#fff" : "#8d919d") + label("RESULT", 130, 13, "rgba(255,255,255,.6)"), { dim: offline });
      },
      formatSplash({ kind: kind2 = "fboard", on = false, offline = false } = {}) {
        const t = { fvs: "TEAM VS", fboard: "BOARD", fwin: "CHAMPION" }[kind2] || "BOARD", ic = { fvs: "\u2694", fboard: "\u2630", fwin: "\u{1F3C6}" }[kind2] || "\u2630";
        return frame(`<text x="72" y="82" ${FONT} font-size="54" font-weight="900" fill="${on ? INK : BEE}" text-anchor="middle">${ic}</text>` + label(on ? "ON AIR" : t, 128, on ? 16 : 15, on ? INK : "#fff", 2), { bg: on ? BEE : void 0, dim: offline });
      },
      // the format bar along the bottom of the layout (teams, survivors, challengers, standings): lit while on stream
      overlay({ hidden = false, offline = false } = {}) {
        const eye = `<path d="M72 34C46 34 28 54 22 64c6 10 24 30 50 30s44-20 50-30C116 54 98 34 72 34z" fill="none" stroke="${hidden ? "#fff" : BEE}" stroke-width="7" stroke-linejoin="round"/>` + (hidden ? `<path d="M30 26l84 76" stroke="#fff" stroke-width="8" stroke-linecap="round"/>` : `<circle cx="72" cy="64" r="16" fill="${BEE}"/>`);
        return frame(eye + label(hidden ? "HIDDEN" : "OVERLAY ON", 128, hidden ? 18 : 14, "#fff", 2), { bg: hidden ? "#c2302b" : void 0, dim: offline });
      },
      formatBar({ on = false, kind: kind2 = "", offline = false } = {}) {
        const t = { teams: "TEAM BAR", elim: "SURVIVORS", koth: "CHALLENGERS", league: "STANDINGS" }[kind2] || "FORMAT BAR";
        const c = on ? INK : BEE;
        const bars = `<rect x="22" y="78" width="100" height="18" rx="2" fill="${c}"/><rect x="50" y="64" width="44" height="32" rx="2" fill="${c}"/><rect x="26" y="81" width="18" height="12" fill="${on ? BEE : "#111"}"/><rect x="100" y="81" width="18" height="12" fill="${on ? BEE : "#111"}"/><path d="M58 28h28l-14 22z" fill="${on ? INK : "#fff"}" transform="${on ? "rotate(180 72 39)" : ""}"/>`;
        return frame(bars + label(on ? "ON AIR" : t, 126, on ? 16 : 14, on ? INK : "#fff", 2), { bg: on ? BEE : void 0, dim: offline });
      },
      // viewer tournament: signups (lit while open, with the count) and confirm & next match (green when a match is won)
      vtSignup({ open = false, count = 0, started = false, offline = false } = {}) {
        return frame(`<text x="72" y="66" ${FONT} font-size="44" font-weight="900" fill="${open ? INK : BEE}" text-anchor="middle">${started ? "\u{1F3C6}" : count}</text>` + label(started ? "BRACKET ON" : open ? "SIGNUPS OPEN" : "SIGNUPS", 104, 13, open ? INK : "#fff", 1.5) + label("!enter", 128, 13, open ? INK : "rgba(255,255,255,.55)"), { bg: open ? BEE : void 0, dim: offline });
      },
      vtNext({ now = "", won = false, done = false, champion = "", offline = false } = {}) {
        const bg = won ? "#1f9d55" : void 0;
        return frame(done ? `<text x="72" y="70" ${FONT} font-size="46" font-weight="900" fill="${BEE}" text-anchor="middle">\u{1F3C6}</text>` + label(champion || "CHAMPION", 112, 15, "#fff") : ICONS.next(won ? "#fff" : BEE) + label(won ? "CONFIRM" : "NEXT", 112, 15, "#fff") + label(now || "VIEWER MATCH", 132, 11, "rgba(255,255,255,.7)"), { bg, dim: offline });
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
        return frame(`<g transform="translate(44,14) scale(.39)">${ICONS.layout(on ? INK : BEE)}</g>` + ls.map((l, i) => `<text x="72" y="${ls.length === 1 ? 100 : 90 + i * 22}" ${FONT} font-size="${fit(l, 9, 20, 13)}" font-weight="800" fill="${ink}" text-anchor="middle">${esc(l)}</text>`).join("") + label(missing ? "NOT IN LAYOUT" : on ? "ON AIR" : "SCREEN", 134, 12, on ? INK : "rgba(255,255,255,.65)", 1.5), { bg: on ? BEE : void 0, dim: offline || missing });
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
    var listIcon = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 144 144">${inner}</svg>`;
    var LIST = {
      score: listIcon(`<text x="72" y="104" ${FONT} font-size="88" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
      reset: listIcon(ICONS.reset("#fff")),
      swap: listIcon(ICONS.swap("#fff")),
      undo: listIcon(ICONS.undo("#fff")),
      nextmatch: listIcon(ICONS.next("#fff")),
      clear: listIcon(ICONS.clear("#fff")),
      layout: listIcon(ICONS.layout("#fff")),
      screen: listIcon(ICONS.layout("#fff") + `<circle cx="112" cy="112" r="18" fill="#fff"/>`),
      fnext: listIcon(ICONS.next("#fff")),
      fundo: listIcon(ICONS.undo("#fff")),
      fsplash: listIcon(`<text x="72" y="104" ${FONT} font-size="84" font-weight="900" fill="#fff" text-anchor="middle">\u2694</text>`),
      player: listIcon(ICONS.person("#fff")),
      vtopen: listIcon(ICONS.person("#fff") + `<text x="112" y="130" ${FONT} font-size="44" font-weight="900" fill="#fff" text-anchor="middle">+</text>`),
      vtnext: listIcon(ICONS.next("#fff")),
      sound: listIcon(ICONS.speaker("#fff")),
      fbar: listIcon('<rect x="18" y="84" width="108" height="26" rx="3" fill="#fff"/><rect x="48" y="64" width="48" height="46" rx="3" fill="#fff"/>'),
      bracket: listIcon(ICONS.bracket("#fff")),
      bracketrefresh: listIcon(ICONS.pull("#fff")),
      victory: listIcon(ICONS.trophy("#fff")),
      bracketside: listIcon(`<rect x="10" y="34" width="56" height="76" rx="8" fill="#fff"/><text x="38" y="88" ${FONT} font-size="46" font-weight="900" font-style="italic" fill="#000" text-anchor="middle">W</text><rect x="78" y="34" width="56" height="76" rx="8" fill="none" stroke="#fff" stroke-width="8"/><text x="106" y="88" ${FONT} font-size="46" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">L</text>`),
      latency: listIcon(ICONS.eye("#fff")),
      viewernext: listIcon(`<g transform="translate(0,0) scale(.55)">${ICONS.twitch("#fff")}</g><g transform="translate(52,40) scale(.62)">${ICONS.next("#fff")}</g>`),
      viewerresult: listIcon(`<text x="72" y="104" ${FONT} font-size="76" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
      viewerqueue: listIcon(`<rect x="24" y="30" width="96" height="18" rx="5" fill="#fff"/><rect x="24" y="63" width="96" height="18" rx="5" fill="#fff" opacity=".75"/><rect x="24" y="96" width="96" height="18" rx="5" fill="#fff" opacity=".5"/>`),
      autoscore: listIcon(`<circle cx="72" cy="72" r="40" fill="none" stroke="#fff" stroke-width="10"/><circle cx="72" cy="72" r="15" fill="#fff"/>`),
      autoscoreundo: listIcon(ICONS.undo("#fff")),
      autoscoreconfirm: listIcon(`<text x="72" y="100" ${FONT} font-size="76" font-weight="900" fill="#fff" text-anchor="middle">+1</text>`),
      autoscoreresync: listIcon(ICONS.refresh("#fff")),
      viewersidebar: listIcon(`<rect x="26" y="24" width="34" height="96" rx="5" fill="#fff"/><rect x="70" y="34" width="50" height="14" rx="4" fill="#fff" opacity=".6"/><rect x="70" y="60" width="50" height="14" rx="4" fill="#fff" opacity=".6"/><rect x="70" y="86" width="50" height="14" rx="4" fill="#fff" opacity=".6"/>`),
      viewersplash: listIcon(`<text x="72" y="100" ${FONT} font-size="76" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>`),
      sggreport: listIcon('<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M72 88V28"/><path d="M48 52l24-24 24 24"/><path d="M30 80v24h84V80"/></g>'),
      overlay: listIcon('<path d="M72 34C46 34 28 54 22 64c6 10 24 30 50 30s44-20 50-30C116 54 98 34 72 34z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="72" cy="64" r="15" fill="#fff"/>'),
      postlink: listIcon('<path d="M24 30h96a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H62l-22 18v-18H24a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" fill="#fff"/>'),
      standings: listIcon('<rect x="54" y="34" width="36" height="76" fill="#fff"/><rect x="14" y="58" width="36" height="52" fill="#fff" opacity=".7"/><rect x="94" y="72" width="36" height="38" fill="#fff" opacity=".5"/>'),
      top8: listIcon(ICONS.bolt("#fff") + `<text x="66" y="100" ${FONT} font-size="62" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">8</text>`),
      vs: listIcon(`<text x="72" y="100" ${FONT} font-size="80" font-weight="900" font-style="italic" fill="#fff" text-anchor="middle">VS</text>`),
      loser: listIcon(`<text x="72" y="100" ${FONT} font-size="72" font-weight="900" fill="#fff" text-anchor="middle">[L]</text>`)
    };
    var dataUrl2 = (svg) => "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg);
    module2.exports = { art: art2, LIST, dataUrl: dataUrl2, P1, P2, BEE };
  }
});

// src/plugin.js
var WebSocket = require_ws();
var { art, dataUrl } = require_art();
var argv = process.argv.slice(2);
var arg = (k) => {
  const i = argv.indexOf("-" + k);
  return i >= 0 ? argv[i + 1] : "";
};
var PORT = arg("port");
var PLUGIN_UUID = arg("pluginUUID");
var REGISTER = arg("registerEvent");
var PREFIX = "com.t1fgc.beeboscore.";
var INFO = (() => {
  try {
    return JSON.parse(arg("info") || "{}");
  } catch {
    return {};
  }
})();
var VERSIONS = { plugin: INFO.plugin && INFO.plugin.version || (true ? "1.1.1.0" : ""), app: INFO.application && INFO.application.version || "" };
var CANDIDATES = ["http://127.0.0.1:3300", "http://127.0.0.1:3301", "http://127.0.0.1:3302"];
var ws = null;
var globals = { address: "" };
var base = "";
var status = null;
var online = false;
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
  status = d;
  if (changed) {
    renderAll();
    for (const [ctx, c] of contexts) if (c.pi) pushToPI(ctx);
  }
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
    case "reset":
      svg = art.reset({ offline: off });
      break;
    case "swap":
      svg = art.swap({ offline: off });
      break;
    case "undo":
      svg = art.undo({ offline: off });
      break;
    case "clear":
      svg = art.clear({ offline: off });
      break;
    case "nextmatch":
      svg = art.nextmatch({ offline: off, label: c.busy ? "LOADING\u2026" : status && !status.startgg ? "NO START.GG" : "" });
      break;
    case "vs": {
      const on = !!(status && status.vs);
      svg = art.vs({ on, offline: off });
      state = on ? 1 : 0;
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
    case "autoscore": {
      const a = status && status.autoscore || {};
      svg = art.autoscore({ on: !!a.enabled, state: a.state, pending: a.pending, offline: off });
      state = a.enabled ? 1 : 0;
      break;
    }
    case "autoscoreundo": {
      const a = status && status.autoscore || {};
      svg = art.autoscoreUndo({ ready: !!a.canUndo, offline: off });
      break;
    }
    case "autoscoreconfirm": {
      const a = status && status.autoscore || {};
      svg = art.autoscoreConfirm({ pending: a.pending, offline: off });
      break;
    }
    case "autoscoreresync":
      svg = art.autoscoreResync({ offline: off });
      break;
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
    case "vtnext": {
      const v = status && status.vt;
      svg = art.vtNext({ now: v ? v.now : "", won: !!(v && v.winner), done: !!(v && v.status === "done"), champion: v ? v.champion : "", offline: off });
      break;
    }
    case "overlay": {
      const h = !!(status && status.hidden);
      svg = art.overlay({ hidden: h, offline: off });
      state = h ? 1 : 0;
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
    default:
      return;
  }
  if (state !== null && c.state !== state) {
    c.state = state;
    send("setState", { context: ctx, payload: { state } });
  }
  const img = dataUrl(svg);
  if (img !== c.image) {
    c.image = img;
    send("setImage", { context: ctx, payload: { image: img, target: 0 } });
  }
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
function pushToPI(ctx) {
  const c = contexts.get(ctx);
  if (!c) return;
  send("sendToPropertyInspector", { action: c.action, context: ctx, payload: {
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
      if (s.hold) {
        c.held = false;
        c.holdTimer = setTimeout(() => {
          c.held = true;
          act({ action: "reset" }, ctx, true);
        }, 700);
        return;
      }
      return act({ action: "reset" });
    case "swap":
      return act({ action: "swap" });
    case "undo":
      return act({ action: "undo" }, ctx);
    case "clear":
      return act({ action: "clear" }, ctx, true);
    case "vs":
      return act({ action: "vs", show: "toggle" }, ctx);
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
    case "sound":
      return act(s.smode === "up" || s.smode === "down" ? { action: "sound", step: s.smode === "up" ? 10 : -10 } : { action: "sound", on: "toggle" }, ctx);
    case "vtopen":
      return act({ action: "vt", do: "open", open: "toggle" }, ctx);
    case "vtnext":
      return act({ action: "vt", do: "next" }, ctx);
    case "fbar":
      return act({ action: "fbar", show: "toggle" }, ctx);
    case "overlay":
      return act({ action: "overlay", show: "toggle" }, ctx);
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
    case "autoscore": {
      const a = status && status.autoscore || {};
      return act(a.pending ? { action: "autoscoreConfirm" } : { action: "autoscoreToggle" }, ctx);
    }
    case "autoscoreundo":
      return act({ action: "autoscoreUndo" }, ctx, true);
    case "autoscoreconfirm":
      return act({ action: "autoscoreConfirm" }, ctx, true);
    case "autoscoreresync":
      return act({ action: "autoscoreResync" }, ctx, true);
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
  }
}
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
  if (!c.held && kind(c.action) === "reset" && s.hold) send("showAlert", { context: ctx });
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
      contexts.set(ctx, { action, settings: payload.settings || {}, controller: payload.controller || "Keypad", image: null, title: null, state: payload.state, feedback: null });
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
      if (c) {
        c.settings = payload.settings || {};
        c.image = null;
        render(ctx);
      }
      break;
    }
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
module.exports = { onMessage, contexts, _state: () => ({ base, online, status }) };
