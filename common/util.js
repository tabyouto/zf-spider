/**
 * Created by vicient on 2017/1/12.
 */

'use strict';

var data = "do shash'owania";
var crypto = require('crypto');

var tools = {
    md5: function(str) {
        return crypto.createHash('md5').update(str).digest("hex");

    }
}

module.exports = tools;