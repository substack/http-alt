var Writable = require('stream').Writable;
var inherits = require('util').inherits;

inherits(Response, Writable);
module.exports = Response;

function Response (req) {
    Writable.call(this);
    this.statusCode = 200;
    this._request = req;
    this._headers = {};
    this._headerKeys = {};
    
    this.setHeader('Date', new Date().toGMTString());
    
    // todo: check the req.headers and req.httpVersion first
    this.setHeader('Connection', 'keep-alive');
    this.setHeader('Transfer-Encoding', 'chunked');
    
    this.on('finish', this._finishEncode);
}

Response.prototype.setHeader = function (key, value) {
    var lkey = key.toLowerCase();
    this._headers[lkey] = value;
    this._headerKeys[lkey] = key;
};

Response.prototype.removeHeader = function (key) {
    var lkey = key.toLowerCase();
    delete this._headers[lkey];
    delete this._headerKeys[lkey];
};

Response.prototype._getHeader = function (key) {
    var lkey = key.toLowerCase();
    return this._headers[lkey];
};

Response.prototype._getHeaderBuffer = function () {
    var req = this._request;
    var keys = Object.keys(this._headers);
    var code = parseInt(this.statusCode);
    var ok = code >= 200 && code < 300;
    
    var lines = [ 'HTTP/' + req.httpVersion + ' ' + code + (ok ? ' OK' : '') ];
    
    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        lines.push(this._headerKeys[key] + ': ' + this._headers[key]);
    }
    
    return Buffer(lines.join('\r\n') + '\r\n\r\n');
}

Response.prototype._write = function (buf, enc, next) {
    this._buffer = this._encode(buf);
    this._next = next;
    
    if (this._ondata) {
        this._ondata();
        this._ondata = null;
    }
};

Response.prototype._encode = function (buf) {
    var enc = this._getHeader('transfer-encoding');
    if (enc === 'chunked') {
        var pre = buf.length.toString(16) + '\r\n';
        var len = pre.length + buf.length + 2;
        var b = new Buffer(len);
        for (var i = 0; i < pre.length; i++) {
            b[i] = pre.charCodeAt(i);
        }
        b[len-2] = 0x0d;
        b[len-1] = 0x0a;
        buf.copy(b, pre.length);
        return b;
    }
    return buf;
};

Response.prototype._finishEncode = function () {
    var enc = this._getHeader('transfer-encoding');
    this._finished = true;
    
    if (enc !== 'chunked') return;
    
    var trailing = Buffer('0\r\n\r\n');
    if (this._buffer) {
        // does this case ever happen?
        this._buffer = Buffer.concat([ this._buffer, trailing ]);
    }
    else {
        this._buffer = trailing;
    }
    if (this._ondata) this._ondata();
};
