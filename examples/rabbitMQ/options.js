/**
 * options.js - Command-line options parsing module
 *
 * A lightweight wrapper around minimist that provides a more structured API
 * for defining and parsing command-line options.
 */
var minimist = require('minimist');

/**
 * Formats an option definition into a help text string
 */
function describe(optdef) {
    var desc = '    --' + optdef.name;
    if (optdef.alias) desc += ' (-' + optdef.alias + ')';
    if (optdef.describe) desc += ' ' + optdef.describe;
    if (optdef.default) desc += ' (default=' + optdef.default + ')';
    return desc;
}

/**
 * Displays usage information for all options
 */
function usage(options, usage) {
    console.log(usage || 'options:');
    options.map(describe).forEach(function(desc) {
        console.log(desc);
    });
}

/**
 * Converts an options object into an array of option definitions
 * Ensures each option has a name property (derived from the object key or alias)
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
 * If the specified option (default 'help') is present, displays usage and throws an error
 */
Options.prototype.help = function (name) {
    var field = name || 'help';
    if (this.argv[field]) {
        usage(this.options, this.usage_text);
        throw new Error('Help displayed');
    }
    return this;
};

/**
 * Sets custom usage text for help display
 */
Options.prototype.usage = function (usage) {
    this.usage_text = usage;
    return this;
};

module.exports = {
    /**
     * Creates a new Options instance with the specified option definitions
     */
    options: function (options) {
        try {
            return new Options(as_array(options));
        } catch (error) {
            if (error.message === 'Help displayed') {
                // eslint-disable-next-line no-process-exit
                process.exit(0);
            }
            throw error;
        }
    },
};
