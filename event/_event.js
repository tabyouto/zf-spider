/**
 * author: chihaiyue
 * createTime:  2017/1/23.
 */
'use strict';

var EventEmitter = require('events').EventEmitter;
var event = new EventEmitter();



// for(var i=0;i<6;i++) {
//     event.on('test',function() {
//         console.log('绑定了一次而已');
//     })
// }
//
// console.log(event._events['test'].length)
//
// event.emit('test');
module.exports = event;