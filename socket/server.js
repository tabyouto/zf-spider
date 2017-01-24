'use strict';

var event = require('../event/_event');
var redis = require("redis");
var sio = require('socket.io');
var clients = require('../store/store');

module.exports = function(server) {
    var io = sio.listen(server);

    io.sockets.on('connection', function (socket) {

        event.on('complete', function(obj) {
            clients.clients[obj.id].emit('finishAllDegree',obj.process);
        });
        //socket.emit('customId','')
        socket.emit('finishAllDegree',{process: '100%'});
        //socket.emit('giveSocket',socket); 错误
        console.info('New client connected (id=' + socket.id + ').');
        clients.clients.push(socket);


        socket.on('disconnect', function() {
            var index = clients.clients.indexOf(socket);
            if (index != -1) {
                clients.clients.splice(index, 1);
                console.info('Client gone (id=' + socket.id + ').');
            }
        });


    });
    return io;

};

exports.event = event;