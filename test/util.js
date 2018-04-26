/*
 * Copyright 2018 Red Hat Inc.
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
'use strict';

var assert = require('assert');
var util = require('../lib/util.js');

describe('uuid', function() {
    it('converts uuid string to buffer', function(done) {
        var uuid = util.uuid4();
        var uuid_string = util.uuid_to_string(uuid);
        var uuid_bytes = util.string_to_uuid(uuid_string);
        assert(uuid.equals(uuid_bytes));

        var valid = [
            '8ce9bb92-6d10-1740-a7c1-812d5c153c54',
            '8CE9BB92-6D10-1740-A7C1-812D5C153C54'
        ];
        valid.forEach(function (s) {
            var bytes = util.string_to_uuid(s);
            assert.equal(s.toLowerCase(), util.uuid_to_string(bytes));
        });
        done();
    });
    it('rejects invalid uuid string', function(done) {
        var invalid = [
            '00000000-0000-0000-0000-000-00000000',
            '00000000-0000-0000-0000-000G00000000',
            '8xe9bb92-6d10-1740-a7c1-812d5c153c54',
            '8be9bb92-6d10-1740-a7c1-812d5c153c548be9bb92-6d10-1740-a7c1-812d5c153c54',
            '000000-000000-0000-0000-000000000000'
        ];
        invalid.forEach(function (s) {
            var failed;
            try {
                util.string_to_uuid(s);
                failed = false;
            } catch(e) {
                failed = true;
                assert.equal(e.name, 'TypeError');
            }
            if (!failed) assert.fail('did not reject invalid uuid: ' + s);
        });
        done();
    });
});
