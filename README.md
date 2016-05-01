# NeutriumJS.utilities

## Introduction

NeutriumJS.utilities is a collection of general purpose utility objects for use throughout the NeutriumJS library.

## Getting Started

### Installing

The utilities module can be installed using npm as follows:

    npm install --save "@neutriumjs/utilities"

#### Typescript

You can include the module using an import statement in typescript:

    import {NestedMap} from "@neutriumjs/utilities"

    var map = new NestedMap();

This module is built with the declaration files so type hinting should work once the module has been imported.

#### Node

    var utilities = require("@neutriumjs/utilities");

    var map = new utilities.NestedMap();

#### Browsers

Since version 2.0.0 NeutriumJS.utilitites has been converted to a commonjs (node) package. To use it in a browser environment you will need to use a tool like [browserify](http://browserify.org) to convert it to a web bunble and expose the Quantity object.

## Donations

NeutriumJS is free software, but you can support the developers by [donating here](https://neutrium.net/donate/).

## Release Notes

| Version | Notes |
|:-------:|:------|
| 1.0.0	  | Initial Release |
| 2.0.0   | Rename package, switch to Typescript and convert to npm module |

## License

[Creative Commons Attribution 4.0 International](http://creativecommons.org/licenses/by/4.0/legalcode)
