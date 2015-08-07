/* jshint node: true */
'use strict';

var path      = require('path');
var checker   = require('ember-cli-version-checker');
var defaults  = require('lodash').defaults;

var CoffeePreprocessor = require('ember-cli-coffeescript/lib/coffee-preprocessor');

module.exports = {
  name: 'ella-sparse-array',

  shouldSetupRegistryInIncluded: function() {
    return !checker.isAbove(this, '0.2.0');
  },

  getConfig: function() {
    var brocfileConfig = {};
    var coffeeOptions = defaults(this.project.config(process.env.EMBER_ENV).coffeeOptions || {},
      brocfileConfig, {
        blueprints: true
      });

    return coffeeOptions;
  },

  blueprintsPath: function() {
    if (this.getConfig().blueprints) {
      return path.join(__dirname, 'blueprints');
    }
  },

  setupPreprocessorRegistry: function(type, registry) {
    var plugin = new CoffeePreprocessor(this.getConfig());

    registry.add('js', plugin);
  },

  included: function(app, parentAddon) {
    var target = (parentAddon || app);
    if (this.shouldSetupRegistryInIncluded()) {
      this.setupPreprocessorRegistry('parent', target.registry);
    }
  }
};
