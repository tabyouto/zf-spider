/**
 * Created by vicient on 2017/1/12.
 */
var data = "do shash'owania";
var crypto = require('crypto');
crypto.createHash('md5').update(data).digest("hex");