/**
 * options.js - Command-line options parsing module
 *
 * A lightweight wrapper around minimist that provides a more structured API
 * for defining and parsing command-line options.
 */
var util = require('util');
var minimist = require('minimist');

/**
 * Formats an option definition into a help text string
 *
 * @param {Object} optdef - Option definition object
 * @returns {String} Formatted description string for the option
 */
function describe(optdef) {
    var desc = '    --' + optdef.name;
    if (optdef.alias) desc += ' (-' + optdef.alias + ')';
    if (optdef.describe) desc += ' ' + optdef.describe;
    if (optdef.default) desc += ' (default=' + optdef.default + ')';
    return desc;
}

/**
 * Simple wrapper for console.log
 *
 * @param {String} s - String to print
 */
function print(s) {
    console.log(s);
}

/**
 * Displays usage information for all options
 *
 * @param {Array} options - Array of option definition objects
 * @param {String} usage - Optional custom usage text
 */
function usage(options, usage) {
    console.log(usage || 'options:');
    options.map(describe).forEach(print);
}

/**
 * Converts an options object into an array of option definitions
 * Ensures each option has a name property (derived from the object key or alias)
 *
 * @param {Object} options - Options definition object
 * @returns {Array} Array of option definition objects
 */
function as_array(options) {
    var out = [];
    for (var o in options) {
        var definition = options[o];
        if (definition.alias) {
            // Choose the longer of the option name or alias as the primary name
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

/**
 * Options constructor - Initializes the options parser
 *
 * @param {Array} options - Array of option definitions
 * @constructor
 */
function Options(options) {
    this.options = options;
    // Configure minimist option format
    var minimist_opts = {
        string: [],
        number: [],
        boolean: [],
        alias: {},
        default: {},
    };

    // Convert our option definitions to minimist format
    this.options.forEach(function (definition) {
    // Set up aliases
        if (definition.alias) {
            minimist_opts.alias[definition.name] = definition.alias;
        }
        // Set up default values
        if (definition.default !== undefined) {
            minimist_opts.default[definition.name] = definition.default;
        }
        // Configure boolean options
        if (definition.type === 'boolean') {
            minimist_opts.boolean.push(definition.name);
        }
    });

    // Parse command line arguments using minimist
    this.argv = minimist(process.argv.slice(2), minimist_opts);
}

/**
 * Adds help functionality
 * If the specified option (default 'help') is present, displays usage and exits
 *
 * @param {String} name - Option name to trigger help (default: 'help')
 * @returns {Options} - This Options instance for chaining
 */
Options.prototype.help = function (name) {
    var field = name || 'help';
    if (this.argv[name]) {
        usage(this.options, this.usage_text);
        process.exit(0);
    }
    return this;
};

/**
 * Sets custom usage text for help display
 *
 * @param {String} usage - Custom usage message
 * @returns {Options} - This Options instance for chaining
 */
Options.prototype.usage = function (usage) {
    this.usage_text = usage;
    return this;
};

/**
 * Module exports
 * Provides a factory function to create Options instances
 */
module.exports = {
    /**
   * Creates a new Options instance with the specified option definitions
   *
   * @param {Object} options - Object containing option definitions
   * @returns {Options} - Configured Options instance
   */
    options: function (options) {
        return new Options(as_array(options));
    },
};
