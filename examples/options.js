/*
 * Copyright 2015 Red Hat Inc.
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

var util = require('util');
var minimist = require('minimist');

function describe (optdef) {
    var desc = '    --' + optdef.name;
    if (optdef.alias) desc += ' (-' + optdef.alias + ')';
    if (optdef.describe) desc += ' ' + optdef.describe;
    if (optdef.default) desc += ' (default=' + optdef.default +')';
    return desc;
}

function print (s) {
    console.log(s);
}

function usage (options, usage) {
    console.log(usage || 'options:');
    options.map(describe).forEach(print);
}

function as_array (options) {
    var out = [];
    for (var o in options) {
        var definition = options[o];
        if (definition.alias) {
            if (definition.alias.length > o.length) {
                definition.name = definition.alias;
                definition.alias = o;
            } else {
                definition.name = o;
            }
        } else {
            definition.name = o;
        }
        out.push(definition);
    }
    return out;
}

function get_type(o) {
    if (typeof o == 'number' || o instanceof Number) {
        return 'number';
    } else if (util.isArray(o)) {
        return get_type(o[0]);
    } else {
        return 'string';
    }

}

function Options (options) {
    this.options = options;
    var minimist_opts = {
        'string': [],
        'number': [],
        'boolean': [],
        'alias': {},
        'default' : {}
    };
    this.options.forEach(function (definition) {
        if (definition.alias) {
            minimist_opts.alias[definition.name] = definition.alias;
        }
        if (definition.default !== undefined) {
            minimist_opts.default[definition.name] = definition.default;
        }
        if (definition.type === 'boolean') {
            minimist_opts.boolean.push(definition.name);
        } else if (definition.default !== undefined) {
            minimist_opts[get_type(definition.default)].push(definition.name);
        }
    });
    this.argv = minimist(process.argv.slice(2), minimist_opts);
}

Options.prototype.help = function (name) {
    var field = name || 'help';
    if (this.argv[name]) {
        usage(this.options, this.usage_text);
        process.exit(0);
    }
    return this;
}

Options.prototype.usage = function (usage) {
    this.usage_text = usage;
    return this;
}

module.exports = {
    options : function (options) {
        return new Options(as_array(options));
    }
};
