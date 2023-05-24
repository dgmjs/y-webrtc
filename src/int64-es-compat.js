export { Uint64BE, Int64BE, Uint64LE, Int64LE }

const Uint64BE = factory("Uint64BE", true, true)
const Int64BE = factory("Int64BE", true, false)
const Uint64LE = factory("Uint64LE", false, true)
const Int64LE = factory("Int64LE", false, false)

let UNDEFINED = "undefined"
let BUFFER = UNDEFINED !== typeof Buffer && Buffer
let UINT8ARRAY = UNDEFINED !== typeof Uint8Array && Uint8Array
let ARRAYBUFFER = UNDEFINED !== typeof ArrayBuffer && ArrayBuffer
let ZERO = [0, 0, 0, 0, 0, 0, 0, 0]
let isArray = Array.isArray || _isArray
let BIT32 = 4294967296
let BIT24 = 16777216

// storage class
let storage // Array;

function factory(name, bigendian, unsigned) {
  let posH = bigendian ? 0 : 4
  let posL = bigendian ? 4 : 0
  let pos0 = bigendian ? 0 : 3
  let pos1 = bigendian ? 1 : 2
  let pos2 = bigendian ? 2 : 1
  let pos3 = bigendian ? 3 : 0
  let fromPositive = bigendian ? fromPositiveBE : fromPositiveLE
  let fromNegative = bigendian ? fromNegativeBE : fromNegativeLE
  let proto = Int64.prototype
  let isName = "is" + name
  let _isInt64 = "_" + isName

  // properties
  proto.buffer = void 0
  proto.offset = 0
  proto[_isInt64] = true

  // methods
  proto.toNumber = toNumber
  proto.toString = toString
  proto.toJSON = toNumber
  proto.toArray = toArray

  // add .toBuffer() method only when Buffer available
  if (BUFFER) proto.toBuffer = toBuffer

  // add .toArrayBuffer() method only when Uint8Array available
  if (UINT8ARRAY) proto.toArrayBuffer = toArrayBuffer

  // isUint64BE, isInt64BE
  Int64[isName] = isInt64

  // CommonJS
  exports[name] = Int64

  return Int64
}
  // constructor
  function Int64(buffer, offset, value, raddix) {
    if (!(this instanceof Int64))
      return new Int64(buffer, offset, value, raddix)
    return init(this, buffer, offset, value, raddix)
  }

  // isUint64BE, isInt64BE
  function isInt64(b) {
    return !!(b && b[_isInt64])
  }

  // initializer
  function init(that, buffer, offset, value, raddix) {
    if (UINT8ARRAY && ARRAYBUFFER) {
      if (buffer instanceof ARRAYBUFFER) buffer = new UINT8ARRAY(buffer)
      if (value instanceof ARRAYBUFFER) value = new UINT8ARRAY(value)
    }

    // Int64BE() style
    if (!buffer && !offset && !value && !storage) {
      // shortcut to initialize with zero
      that.buffer = newArray(ZERO, 0)
      return
    }

    // Int64BE(value, raddix) style
    if (!isValidBuffer(buffer, offset)) {
      let _storage = storage || Array
      raddix = offset
      value = buffer
      offset = 0
      buffer = storage === BUFFER ? BUFFER.alloc(8) : new _storage(8)
    }

    that.buffer = buffer
    that.offset = offset |= 0

    // Int64BE(buffer, offset) style
    if (UNDEFINED === typeof value) return

    // Int64BE(buffer, offset, value, raddix) style
    if ("string" === typeof value) {
      fromString(buffer, offset, value, raddix || 10)
    } else if (isValidBuffer(value, raddix)) {
      fromArray(buffer, offset, value, raddix)
    } else if ("number" === typeof raddix) {
      writeInt32(buffer, offset + posH, value) // high
      writeInt32(buffer, offset + posL, raddix) // low
    } else if (value > 0) {
      fromPositive(buffer, offset, value) // positive
    } else if (value < 0) {
      fromNegative(buffer, offset, value) // negative
    } else {
      fromArray(buffer, offset, ZERO, 0) // zero, NaN and others
    }
  }

  function fromString(buffer, offset, str, raddix) {
    let pos = 0
    let len = str.length
    let high = 0
    let low = 0
    if (str[0] === "-") pos++
    let sign = pos
    while (pos < len) {
      let chr = parseInt(str[pos++], raddix)
      if (!(chr >= 0)) break // NaN
      low = low * raddix + chr
      high = high * raddix + Math.floor(low / BIT32)
      low %= BIT32
    }
    if (sign) {
      high = ~high
      if (low) {
        low = BIT32 - low
      } else {
        high++
      }
    }
    writeInt32(buffer, offset + posH, high)
    writeInt32(buffer, offset + posL, low)
  }

  function toNumber() {
    let buffer = this.buffer
    let offset = this.offset
    let high = readInt32(buffer, offset + posH)
    let low = readInt32(buffer, offset + posL)
    if (!unsigned) high |= 0 // a trick to get signed
    return high ? high * BIT32 + low : low
  }

  function toString(radix) {
    let buffer = this.buffer
    let offset = this.offset
    let high = readInt32(buffer, offset + posH)
    let low = readInt32(buffer, offset + posL)
    let str = ""
    let sign = !unsigned && high & 0x80000000
    if (sign) {
      high = ~high
      low = BIT32 - low
    }
    radix = radix || 10
    while (1) {
      let mod = (high % radix) * BIT32 + low
      high = Math.floor(high / radix)
      low = Math.floor(mod / radix)
      str = (mod % radix).toString(radix) + str
      if (!high && !low) break
    }
    if (sign) {
      str = "-" + str
    }
    return str
  }

  function writeInt32(buffer, offset, value) {
    buffer[offset + pos3] = value & 255
    value = value >> 8
    buffer[offset + pos2] = value & 255
    value = value >> 8
    buffer[offset + pos1] = value & 255
    value = value >> 8
    buffer[offset + pos0] = value & 255
  }

  function readInt32(buffer, offset) {
    return (
      buffer[offset + pos0] * BIT24 +
      (buffer[offset + pos1] << 16) +
      (buffer[offset + pos2] << 8) +
      buffer[offset + pos3]
    )
  }
}

function toArray(raw) {
  let buffer = this.buffer
  let offset = this.offset
  storage = null // Array

  if (raw !== false && isArray(buffer)) {
    return buffer.length === 8 ? buffer : buffer.slice(offset, offset + 8)
  }

  return newArray(buffer, offset)
}

function toBuffer(raw) {
  let buffer = this.buffer
  let offset = this.offset
  storage = BUFFER

  if (raw !== false && BUFFER.isBuffer(buffer)) {
    return buffer.length === 8 ? buffer : buffer.slice(offset, offset + 8)
  }

  // Buffer.from(arraybuffer) available since Node v4.5.0
  // https://nodejs.org/en/blog/release/v4.5.0/
  return BUFFER.from(toArrayBuffer.call(this, raw))
}

function toArrayBuffer(raw) {
  let buffer = this.buffer
  let offset = this.offset
  let arrbuf = buffer.buffer
  storage = UINT8ARRAY

  // arrbuf.slice() ignores buffer.offset until Node v8.0.0
  if (raw !== false && !buffer.offset && arrbuf instanceof ARRAYBUFFER) {
    return arrbuf.byteLength === 8 ? arrbuf : arrbuf.slice(offset, offset + 8)
  }

  let dest = new UINT8ARRAY(8)
  fromArray(dest, 0, buffer, offset)
  return dest.buffer
}

function isValidBuffer(buffer, offset) {
  let len = buffer && buffer.length
  offset |= 0
  return len && offset + 8 <= len && "string" !== typeof buffer[offset]
}

function fromArray(destbuf, destoff, srcbuf, srcoff) {
  destoff |= 0
  srcoff |= 0
  for (let i = 0; i < 8; i++) {
    destbuf[destoff++] = srcbuf[srcoff++] & 255
  }
}

function newArray(buffer, offset) {
  return Array.prototype.slice.call(buffer, offset, offset + 8)
}

function fromPositiveBE(buffer, offset, value) {
  let pos = offset + 8
  while (pos > offset) {
    buffer[--pos] = value & 255
    value /= 256
  }
}

function fromNegativeBE(buffer, offset, value) {
  let pos = offset + 8
  value++
  while (pos > offset) {
    buffer[--pos] = (-value & 255) ^ 255
    value /= 256
  }
}

function fromPositiveLE(buffer, offset, value) {
  let end = offset + 8
  while (offset < end) {
    buffer[offset++] = value & 255
    value /= 256
  }
}

function fromNegativeLE(buffer, offset, value) {
  let end = offset + 8
  value++
  while (offset < end) {
    buffer[offset++] = (-value & 255) ^ 255
    value /= 256
  }
}

// https://github.com/retrofox/is-array
function _isArray(val) {
  return !!val && "[object Array]" == Object.prototype.toString.call(val)
}
