/*
 * Copyright 2024 Red Hat Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from "assert";
import * as rhea from "../";
const types = require("../lib/types");

function be32(value: number): number[] {
    return [
        (value >>> 24) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 8) & 0xff,
        value & 0xff,
    ];
}

function compound_header(typecode: number, size: number, count: number): Buffer {
    return Buffer.from([typecode, ...be32(size), ...be32(count)]);
}

describe('compound decode bounds', function () {
    it('rejects List32 with count 0x7FFFFFFF', function () {
        var buffer = compound_header(0xD0, 0xFFFFFF, 0x7FFFFFFF);
        var reader = new types.Reader(buffer);
        assert.throws(function () { reader.read(); }, /65536/);
    });

    it('rejects Map32 with count 0x7FFFFFFF', function () {
        var buffer = compound_header(0xD1, 0xFFFFFF, 0x7FFFFFFF);
        var reader = new types.Reader(buffer);
        assert.throws(function () { reader.read(); }, /65536/);
    });

    it('rejects Array32 with count 0x7FFFFFFF', function () {
        var buffer = compound_header(0xF0, 0xFFFFFF, 0x7FFFFFFF);
        var reader = new types.Reader(buffer);
        assert.throws(function () { reader.read(); }, /65536/);
    });

    it('accepts compound count equal to the maximum (65536)', function () {
        var buffer = Buffer.from([...be32(0x10), ...be32(65536)]);
        var reader = new types.Reader(buffer);
        var limits = reader.read_size_count(4);
        assert.strictEqual(limits.count, 65536);
        assert.strictEqual(limits.size, 0x10);
    });

    it('rejects compound count one above the maximum (65537)', function () {
        var buffer = Buffer.from([...be32(0x10), ...be32(65537)]);
        var reader = new types.Reader(buffer);
        assert.throws(function () { reader.read_size_count(4); }, /65536/);
    });
});

describe('nesting depth bounds', function () {
    function nested_list(levels: number): Buffer {
        // `levels` nested list8 values, each holding one element; innermost null.
        var parts: number[] = [];
        for (var i = 0; i < levels; i++) parts.push(0xc0, 0x02, 0x01);
        parts.push(0x40);
        return Buffer.from(parts);
    }
    function nested_described(levels: number): Buffer {
        // `levels` nested described types (smallulong descriptor 0); innermost null.
        var parts: number[] = [];
        for (var i = 0; i < levels; i++) parts.push(0x00, 0x53, 0x00);
        parts.push(0x40);
        return Buffer.from(parts);
    }
    function nested_map(levels: number): Buffer {
        // `levels` nested map8 values (null key, nested value); innermost null.
        var parts: number[] = [];
        for (var i = 0; i < levels; i++) parts.push(0xc1, 0x03, 0x02, 0x40);
        parts.push(0x40);
        return Buffer.from(parts);
    }

    it('rejects deeply nested lists', function () {
        assert.throws(function () { new types.Reader(nested_list(20000)).read(); }, /maximum depth/);
    });
    it('rejects deeply nested described types', function () {
        assert.throws(function () { new types.Reader(nested_described(20000)).read(); }, /maximum depth/);
    });
    it('rejects deeply nested maps', function () {
        assert.throws(function () { new types.Reader(nested_map(20000)).read(); }, /maximum depth/);
    });
    it('raises a bounded decode error, not a RangeError, on deep nesting', function () {
        try {
            new types.Reader(nested_list(100000)).read();
            assert.fail('expected a depth error');
        } catch (e) {
            assert.ok(!(e instanceof RangeError), 'should be a bounded decode error, not a stack overflow');
        }
    });
    it('accepts nesting below the limit', function () {
        var value = new types.Reader(nested_list(2)).read();
        assert.strictEqual(JSON.stringify(value), '[[null]]');
    });
});
