'use strict';

var event = require('../event/_event');
var redis = require("redis");
var sio = require('socket.io');

module.exports = function(server,redisClient) {
    var io = sio.listen(server);

    io.sockets.on('connection', function (socket) {

        //通知客户端进度
        if(!event._events['finished']) { //如果没有注册则注册
            event.on('finished', function(obj) {
                console.log('event 通知');
                redisClient.get(obj.token,function(err,reply) {
                    console.log('最新socket-id',reply);
                    io.to(reply).emit('finishAllDegree',obj.progress); //获取token 对应的 socketId
                });
                // obj.emit('finishAllDegree',obj.progress);
            });
        }


        //客户端获取token 绑定socket id 通知服务端保存
        socket.on('setConnect',function(obj) {
            console.log(socket.id,obj.token);
            redisClient.set(obj.token, socket.id); //存入 token ： socketId
        });


        // socket.emit('finishAllDegree',{progress: '100%'});

        //socket.emit('giveSocket',socket); 错误


        console.info('New client connected (id=' + socket.id + ').');



        socket.on('disconnect', function() {
            //var index = clients.clients.indexOf(socket);
            //if (index != -1) {
            //    clients.clients.splice(index, 1);
            //    console.info('Client gone (id=' + socket.id + ').');
            //    console.info(clients);
            //}
        });


    });
    return io;

};

exports.event = event;