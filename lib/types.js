/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */
'use strict';

function Typed(type, value) {
    this.type = type;
    this.value = value;
}
Typed.prototype.toString = function() {
    return this.value ? this.value.toString() : null;
}
Typed.prototype.toLocaleString = function() {
    return this.value ? this.value.toLocaleString() : null;
}
Typed.prototype.valueOf = function() {
    return this.value;
}
Typed.prototype.toJSON = function() {
    return this.value && this.value.toJSON ? this.value.toJSON() : this.value;
}

function hex(i) {
    return Number(i).toString(16);
}

var types = {'by_code':{}};
Object.defineProperty(types, 'MAX_UINT', {value: 4294967295, writable: false, configurable: false});
Object.defineProperty(types, 'MAX_USHORT', {value: 65535, writable: false, configurable: false});

function define_type(name, typecode, annotations, empty_value) {
    var subcategory = typecode >>> 4;
    var t;
    if (subcategory === 0x4) {
        // constructors for 'empty' types don't take a value
        t = function () {
            this.type = t;
            this.value = empty_value;
        };
    } else if (subcategory === 0xE || subcategory === 0xF) {
        t = function (v, code, descriptor) {
            this.type = t;
            this.value = v;
            this.array_constructor = {'typecode':code};
            if (descriptor) {
                this.array_constructor.descriptor = descriptor;
            }
        };
    } else {
        t = function (v) {
            this.type = t;
            this.value = v;
        };
    }
    t.typecode = typecode;
    t.prototype = Object.create(Typed.prototype);
    t.toString = function () {
        return name + '#' + hex(typecode);
    };
    switch (subcategory) {
    case 0x4:
        t.width = 0;
        t.category = 'fixed';
        break;
    case 0x5:
        t.width = 1;
        t.category = 'fixed';
        break;
    case 0x6:
        t.width = 2;
        t.category = 'fixed';
        break;
    case 0x7:
        t.width = 4;
        t.category = 'fixed';
        break;
    case 0x8:
        t.width = 8;
        t.category = 'fixed';
        break;
    case 0x9:
        t.width = 16;
        t.category = 'fixed';
        break;
    case 0xA:
        t.width = 1;
        t.category = 'variable';
        break;
    case 0xB:
        t.width = 4;
        t.category = 'variable';
        break;
    case 0xC:
        t.width = 1;
        t.category = 'compound';
        break;
    case 0xD:
        t.width = 4;
        t.category = 'compound';
        break;
    case 0xE:
        t.width = 1;
        t.category = 'array';
        break;
    case 0xF:
        t.width = 4;
        t.category = 'array';
        break;
    }
    if (t.category === 'fixed') {
        t.prototype.encoded_size = function () {
            return this.type.width;
        }
    } else if (t.category === 'variable') {
        t.prototype.encoded_size = function () {
            return this.type.width + this.value.length;
        }
    } else if (t.category === 'compound') {
        t.prototype.encoded_size = function () {
            var s = this.type.width*2;
            for (i in this.value) {
                s += 1/*typecode*/ + i.encoded_size();//what if i is described????
            }
            return s;
        }
    }
    if (annotations) {
        for (var a in annotations) {
            t[a] = annotations[a];
        }
    }
    types.by_code[t.typecode] = t;
    types[name] = t;
    return t;
}

function buffer_ops(name) {
    return {
        'read': function (buffer, offset) { return buffer['read' + name](offset); },
        'write': function (buffer, value, offset) { buffer['write' + name](value, offset); }
    };
}

define_type('Null', 0x40, undefined, null);
define_type('Boolean', 0x56, buffer_ops('UInt8'));
define_type('True', 0x41, undefined, true);
define_type('False', 0x42, undefined, false);
define_type('Ubyte', 0x50, buffer_ops('UInt8'));
define_type('Ushort', 0x60, buffer_ops('UInt16BE'));
define_type('Uint', 0x70, buffer_ops('UInt32BE'));
define_type('SmallUint', 0x52, buffer_ops('UInt8'));
define_type('Uint0', 0x43, undefined, 0);
define_type('Ulong', 0x80);//TODO: how to represent 64 bit numbers?
define_type('SmallUlong', 0x53, buffer_ops('UInt8'));
define_type('Ulong0', 0x44, undefined, 0);
define_type('Byte', 0x51, buffer_ops('Int8'));
define_type('Short', 0x61, buffer_ops('Int16BE'));
define_type('Int', 0x71, buffer_ops('Int32BE'));
define_type('SmallInt', 0x54, buffer_ops('Int8'));
define_type('Long', 0x81);//TODO: how to represent 64 bit numbers?
define_type('SmallLong', 0x55, buffer_ops('Int8'));
define_type('Float', 0x72, buffer_ops('Float'));
define_type('Double', 0x82, buffer_ops('Double'));
define_type('Decimal32', 0x74);
define_type('Decimal64', 0x84);
define_type('Decimal128', 0x94);
define_type('CharUTF32', 0x73);
define_type('Timestamp', 0x83);//TODO: convert to/from Date
define_type('Uuid', 0x98);//TODO: convert to/from stringified form
define_type('Vbin8', 0xa0);
define_type('Vbin32', 0xb0);
define_type('Str8', 0xa1, {'encoding':'utf8'});
define_type('Str32', 0xb1, {'encoding':'utf8'});
define_type('Sym8', 0xa3, {'encoding':'ascii'});
define_type('Sym32', 0xb3, {'encoding':'ascii'});
define_type('List0', 0x45, undefined, []);
define_type('List8', 0xc0);
define_type('List32', 0xd0);
define_type('Map8', 0xc1);
define_type('Map32', 0xd1);
define_type('Array8', 0xe0);
define_type('Array32', 0xf0);

function is_one_of(o, typelist) {
    for (var t in typelist) {
        if (o.type.typecode === t.typecode) return true;
    }
    return false;
};
types.is_ulong = function(o) {
    return is_one_of(o, [types.Ulong, types.Ulong0, types.SmallUlong]);
};
types.is_string = function(o) {
    return is_one_of(o, [types.Str8, types.Str32]);
};
types.is_symbol = function(o) {
    return is_one_of(o, [types.Sym8, types.Sym32]);
};
types.is_list = function(o) {
    return is_one_of(o, [types.List0, types.List8, types.List32]);
};
types.is_map = function(o) {
    return is_one_of(o, [types.Map8, types.Map32]);
};

types.wrap_boolean = function(v) {
    return new types.Boolean(v);
};
types.wrap_ulong = function(l) {
    if (l === 0) return new types.Ulong0();
    else return l > 255 ? new types.Ulong(l) : new types.SmallUlong(l);
};
types.wrap_uint = function(l) {
    if (l === 0) return new types.Uint0();
    else return l > 255 ? new types.Uint(l) : new types.SmallUint(l);
};
types.wrap_ushort = function(l) {
    return new types.Ushort(l);
};
types.wrap_ubyte = function(l) {
    return new types.Ubyte(l);
};
types.wrap_long = function(l) {
    return l > 255 ? new types.Long(l) : new types.SmallLong(l);
};
types.wrap_int = function(l) {
    return l > 255 ? new types.Int(l) : new types.SmallInt(l);
};
types.wrap_short = function(l) {
    return new types.Short(l);
};
types.wrap_byte = function(l) {
    return new types.Byte(l);
};
types.wrap_float = function(l) {
    return new types.Float(l);
};
types.wrap_double = function(l) {
    return new types.Double(l);
};
types.wrap_timestamp = function(l) {
    return new types.Timestamp(l);
};
types.wrap_binary = function (s) {
    return s.length > 255 ? new types.Vbin32(s) : new types.Vbin8(s);
};
types.wrap_string = function (s) {
    return s.length > 255 ? new types.Str32(s) : new types.Str8(s);
};
types.wrap_symbol = function (s) {
    return s.length > 255 ? new types.Sym32(s) : new types.Sym8(s);
};
types.wrap_list = function(l) {
    if (l.length === 0) return new types.List0();
    return l.length > 255 ? new types.List32(l) : new types.List8(l);
};
types.wrap_map = function(m, key_wrapper) {
    var items = [];
    for (var k in m) {
        items.push(key_wrapper ? key_wrapper(k) : types.wrap(k));
        items.push(types.wrap(m[k]));
    }
    return items.length > 255 ? new types.Map32(items) : new types.Map8(items);
};
types.wrap_symbolic_map = function(m) {
    return types.wrap_map(m, types.wrap_symbol);
};
types.wrap_array = function(l, code, descriptors) {
    if (code) {
        return l.length > 255 ? new types.Array32(l, code, descriptors) : new types.Array8(l, code, descriptors);
    } else {
        throw Error('An array must specify a type for its elements');
    }
};
types.wrap = function(o) {
    var t = typeof o;
    if (t === "string") {
        return types.wrap_string(o);
    } else if (t == "boolean") {
        return o ? new types.True() : new types.False();
    } else if (t == "number" || o instanceof Number) {
        if (Math.floor(o) !== o) {
            return new Double(o);
        } else if (o > 0) {
            return types.wrap_uint(o);
        } else {
            return types.wrap_int(o);
        }
    } else if (o instanceof Date) {
        //??? TODO ???
    } else if (o instanceof Typed) {
        return o;
    } else if (t == "undefined" || o === null) {
        return new types.Null();
    } else if (Array.isArray(o)) {
        return types.wrap_list(o);
    } else {
        return types.wrap_map(o);
    }
};

types.wrap_message_id = function(o) {
    var t = typeof o
    if (t === "string") {
        return types.wrap_string(o);
    } else if (t == "number" || o instanceof Number) {
        return types.wrap_uint(o);
    } else {
        //TODO handle uuids
        throw Error('invalid message id:' + o);
    }
};
types.wrap_delivery_state = function(o) {
    //TODO
    return new Null;
};

types.unwrap = function(o) {
    if (o instanceof Typed) {
        return types.unwrap(o.value);
    } else if (Array.isArray(o)) {
        return o.map(types.unwrap);
    } else {
        return o;
    }
};

types.described = function (descriptor, typedvalue) {
    var o = Object.create(typedvalue);
    if (descriptor.length) {
        o.descriptor = descriptor.shift();
        return described(descriptor, o);
    } else {
        o.descriptor = descriptor;
        return o;
    }
}

function get_type(code) {
    var type = types.by_code[code];
    if (!type) {
        throw Error('Unrecognised typecode: ' + hex(code));
    }
    return type;
}

types.Reader = function (buffer) {
    this.buffer = buffer;
    this.position = 0;
}

types.Reader.prototype.read_typecode = function () {
    return this.read_uint(1);
}

types.Reader.prototype.read_uint = function (width) {
    var current = this.position;
    this.position += width;
    var name = width > 1 ? 'readUInt' + (width * 8) + 'BE' : 'readUInt' + 8;
    return this.buffer[name](current);
}

types.Reader.prototype.read_fixed_width = function (type) {
    var current = this.position;
    this.position += type.width;
    if (type.read) {
        return type.read(this.buffer, current);
    } else {
        return this.buffer.slice(current, this.position);
    }
}

types.Reader.prototype.read_variable_width = function (type) {
    var size = this.read_uint(type.width);
    var slice = this.read_bytes(size);
    return type.encoding ? slice.toString(type.encoding) : slice;
}

types.Reader.prototype.read = function () {
    var constructor = this.read_constructor();
    var value = this.read_value(get_type(constructor.typecode));
    return constructor.descriptor ? types.described(constructor.descriptor, value) : value;
}

types.Reader.prototype.read_constructor = function () {
    var code = this.read_typecode();
    if (code === 0x00) {
        var d = [];
        d.push(this.read());
        var c = this.read_constructor();
        while (c.descriptor) {
            d.push(c.descriptor);
            c = this.read_constructor();
        }
        return {'typecode': c.typecode, 'descriptor':  d.length == 1 ? d[0] : d};
    } else {
        return {'typecode': code};
    }
}

types.Reader.prototype.read_value = function (type) {
    if (type.width === 0) {
        return new type();
    //TODO: use enumeration rather than string for category
    } else if (type.category === 'fixed') {
        return new type(this.read_fixed_width(type));
    } else if (type.category === 'variable') {
        return new type(this.read_variable_width(type));
    } else if (type.category === 'compound') {
        return this.read_compound(type);
    } else if (type.category === 'array') {
        return this.read_array(type);
    } else {
        throw Error('Invalid category for type: ' + type);
    }
}

types.Reader.prototype.read_multiple = function (n, f) {
    var read_fn = f ? f : this.read.bind(this);
    var items = [];
    while (items.length < n) {
        items.push(read_fn.apply(this));
    }
    return items;
}

types.Reader.prototype.read_size_count = function (width) {
    return {'size': this.read_uint(width), 'count': this.read_uint(width)};
}

types.Reader.prototype.read_compound = function (type) {
    var limits = this.read_size_count(type.width);
    return new type(this.read_multiple(limits.count));
}

types.Reader.prototype.read_array = function (type) {
    var limits = this.read_size_count(type.width);
    var constructor = this.read_constructor();
    var value = new type(this.read_multiple(limits.count, this.read_value.bind(this, get_type(constructor.typecode))), constructor.typecode, constructor.descriptor);
    return value;
}

types.Reader.prototype.toString = function () {
    var s = 'buffer@' + this.position;
    if (this.position) s += ': ';
    for (var i = this.position; i < this.buffer.length; i++) {
        if (i > 0) s+= ',';
        s += '0x' + Number(this.buffer[i]).toString(16);
    }
    return s;
}

types.Reader.prototype.reset = function () {
    this.position = 0;
}

types.Reader.prototype.skip = function (bytes) {
    this.position += bytes;
}

types.Reader.prototype.read_bytes = function (bytes) {
    var current = this.position;
    this.position += bytes;
    return this.buffer.slice(current, this.position);
}

types.Reader.prototype.remaining = function () {
    return this.buffer.length - this.position;
}

types.Writer = function (buffer) {
    this.buffer = buffer;
    this.position = 0;
}

types.Writer.prototype.write_typecode = function (code) {
    this.write_uint(code, 1);
}

types.Writer.prototype.write_uint = function (value, width) {
    var current = this.position;
    this.position += width;
    var name = width > 1 ? 'writeUInt' + (width * 8) + 'BE' : 'writeUInt' + 8;
    if (!this.buffer[name]) {
        throw Error("Buffer doesn't define " + name);
    }
    return this.buffer[name](value, current);
}


types.Writer.prototype.write_fixed_width = function (type, value) {
    var current = this.position;
    this.position += type.width;
    if (type.write) {
        type.write(this.buffer, value, current);
    } else if (value.copy) {
        value.copy(this.buffer, current);
    } else {
        this.buffer.fill(0x00, current, current + type.width);
    }
}

types.Writer.prototype.write_variable_width = function (type, value) {
    var source = type.encoding ? new Buffer(value, type.encoding) : new Buffer(value);
    this.write_uint(source.length, type.width);
    this.write_bytes(source);
}

types.Writer.prototype.write_bytes = function (source) {
    var current = this.position;
    this.position += source.length;
    source.copy(this.buffer, current);
}

types.Writer.prototype.write_constructor = function (typecode, descriptor) {
    if (descriptor) {
        this.write_typecode(0x00);
        this.write(descriptor);
    }
    this.write_typecode(typecode);
}

types.Writer.prototype.write = function (o) {
    if (!(o instanceof Typed)) {
        throw Error("Can't write " + JSON.stringify(o));
    }
    this.write_constructor(o.type.typecode, o.descriptor);
    this.write_value(o.type, o.value, o.array_constructor);
}

types.Writer.prototype.write_value = function (type, value, constructor/*for arrays only*/) {
    if (type.width === 0) {
        return;//nothing further to do
    //TODO: use enumeration rather than string for category
    } else if (type.category === 'fixed') {
        this.write_fixed_width(type, value);
    } else if (type.category === 'variable') {
        this.write_variable_width(type, value);
    } else if (type.category === 'compound') {
        this.write_compound(type, value);
    } else if (type.category === 'array') {
        this.write_array(type, value, constructor);
    } else {
        throw Error('Invalid category ' + type.category + ' for type: ' + type);
    }
}

types.Writer.prototype.backfill_size = function (width, saved) {
    var gap = this.position - saved;
    this.position = saved;
    this.write_uint(gap - width, width);
    this.position += (gap - width);
}

types.Writer.prototype.write_compound = function (type, value) {
    var saved = this.position;
    this.position += type.width;//skip size field
    this.write_uint(value.length, type.width);//count field
    for (var i = 0; i < value.length; i++) {
        if (value[i] === undefined || value[i] === null) {
            this.write(new types.Null);
        } else {
            this.write(value[i]);
        }
    }
    this.backfill_size(type.width, saved);
}

types.Writer.prototype.write_array = function (type, value, constructor) {
    var saved = this.position;
    this.position += type.width;//skip size field
    this.write_uint(value.length, type.width);//count field
    this.write_constructor(constructor.typecode, constructor.descriptor);
    var type = get_type(constructor.typecode);
    for (var i = 0; i < value.length; i++) {
        this.write_value(type, value[i]);
    }
    this.backfill_size(type.width, saved);
}

types.Writer.prototype.toString = function () {
    var s = 'buffer@' + this.position;
    if (this.position) s += ': ';
    for (var i = 0; i < this.position; i++) {
        if (i > 0) s+= ',';
        s += '0x' + Number(this.buffer[i]).toString(16);
    }
    return s;
}

types.Writer.prototype.skip = function (bytes) {
    this.position += bytes;
}

types.Writer.prototype.clear = function () {
    this.buffer.fill(0x00);
    this.position = 0;
}

types.Writer.prototype.remaining = function () {
    return this.buffer.length - this.position;
}


function get_constructor(typename) {
    if (typename === 'symbol') {
        return {typecode:types.Sym8.typecode};
    }
    throw Error('TODO: Array of type ' + typename + ' not yet supported');
};

function wrap_field(definition, instance) {
    if (instance !== undefined && instance !== null) {
        if (Array.isArray(instance)) {
            if (!definition.multiple) {
                throw Error('Field ' + definition.name + ' does not support multiple values, got ' + JSON.stringify(instance));
            }
            var constructor = get_constructor(definition.type);
            return types.wrap_array(instance, constructor.typecode, constructor.descriptor);
        } else if (definition.type === '*') {
            return instance;
        } else {
            var wrapper = types['wrap_' + definition.type];
            if (wrapper) {
                return wrapper(instance);
            } else {
                throw Error('No wrapper for field ' + definition.name + ' of type ' + definition.type);
            }
        }
    } else if (definition.mandatory) {
        throw Error('Field ' + definition.name + ' is mandatory');
    } else {
        return new types.Null();
    }
};

function get_accessors(index, field_definition) {
    var getter = function() { return field_definition.type === '*' ? this.value[index] : types.unwrap(this.value[index])};
    var setter = function(o) { this.value[index] = wrap_field(field_definition, o); }
    return {'get': getter, 'set': setter, 'enumerable':true, 'configurable':false};
}

types.define_composite = function(def) {
    var c = function(fields) {
        this.value = fields ? fields : [];
    }
    c.descriptor = {
        numeric: def.code,
        symbolic: 'amqp:' + def.name + ':list'
    };
    c.prototype.dispatch = function (target, frame) {
        target['on_' + def.name](frame);
    };
    //c.prototype.descriptor = c.descriptor.numeric;
    //c.prototype = Object.create(types.List8.prototype);
    for (var i = 0; i < def.fields.length; i++) {
        var f = def.fields[i];
        Object.defineProperty(c.prototype, f.name, get_accessors(i, f));
    }
    c.toString = function() {
        return def.name + '#' + Number(def.code).toString(16);
    };
    c.prototype.toJSON = function() {
        var o = {};
        for (var f in this) {
            if (f !== 'value' && this[f]) {
                o[f] = this[f];
            }
        }
        return o;
    };
    c.create = function(fields) {
        var o = new c;
        for (var f in fields) {
            o[f] = fields[f];
        }
        return o;
    }
    c.prototype.described = function(fields) {
        return types.described(types.wrap_ulong(c.descriptor.numeric), types.wrap_list(this.value));
    };
    return c;
}

module.exports = types;
