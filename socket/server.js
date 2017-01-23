'use strict';

var event = require('../event/_event');



module.exports = function(server) {
    var io = require('socket.io').listen(server);
    io.sockets.on('connection', function (socket) {
        console.log('a user connect');
        event.on('complete', function(process) {
            socket.emit('finishAllDegree',process);
        });
        socket.emit('finishAllDegree',{process: '100%'})
        //socket.emit('giveSocket',socket); 错误

    });
    return io;

};

exports.event = event;