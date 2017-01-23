var express = require('express');
var router = express.Router();
var common = require('../common/common');
var async = require('async'); //处理异步回调
var base = require('../action/baseFunc');
/* GET users listing. */





router.post('/', function(req, res, next) {
  console.log(res);
  res.send('respond with a resource');
});

//登录
router.post('/login', function(req, res, next) {
    var self = '';
    async.auto({
        start: function (callback) {
            //if(req.session.info) {
            //    console.log('session 存在，不要重复登录');
            //}else {
                var action = new base();
                self = action;
                action.actions.doLogin(req,callback,next);
            //}
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            //session 持久化
            req.session.info || (req.session.info = {
                class_number: req.body.class_number,
                passwd: req.body.class_passwd,
                name: self ? self._info.name : ''
            });
            common.showResult(res,200,'',{
                name: self ? self._info.name : '',
                yearOptions:self ? self._info.scheduleResult.yearOptions : '',
                tableHtml: self ? self._info.scheduleResult.tableHtml: ''
            },'success',1);
            console.log('请求结束');
        }]
    });
});

//获取课程表
router.post('/fetchSchedule', function(req, res, next) {
    var self = '';
    async.auto({
        start: function (callback) {
            if(req.session.info) {
                var action = new base();
                self = action;
                action.actions.fetchSpecificSchedule(req,callback,next);
                //actions.fetchSpecificSchedule(req,callback,next);
            }else {
                next(new Error('1111'));
            }
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            common.showResult(res,200,'',{
                tableHtml: self ? self._info.scheduleResult.tableHtml : ''
            },'success',1);
            console.log('finish');
        }]
    });
});

//获取绩点
router.post('/fetchScore', function(req, res, next) {
    var self = ''
    async.auto({
        start: function (callback) {
            //if(req.session.info) {
                var action = new base();
                self = action;
                action.actions.fetchSpecificScore(req,callback,next);
            //}else {
            //    next(new Error('1111'));
            //}
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            common.showResult(res,200,'',{
                score: self._info.score
            },'success',1);
            console.log('finish');
        }]
    });
});



//

module.exports = router;
