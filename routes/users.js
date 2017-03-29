var express = require('express');
var router = express.Router();
var common = require('../common/common');
var async = require('async'); //处理异步回调
var base = require('../action/baseFunc');
var tools = require('../common/util'); //工具函数
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
                action.doLogin(req,callback,next);
            //}
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            // //session 持久化
            // req.session.info || (req.session.info = {
            //     class_number: req.body.class_number,
            //     passwd: req.body.class_passwd,
            //     name: self ? self._info.name : ''
            // });
            if(self._info.scheduleResult.yearOptions) {
                common.showResult(res,200,'',{
                    name: self ? self._info.name : '',
                    yearOptions:self ? self._info.scheduleResult.yearOptions : '',
                    tableHtml: self ? self._info.scheduleResult.tableHtml: ''
                },'success',1);
            }else {
                if(self._info.scoreArr.length==0) {
                    common.showResult(res,200,'',{
                        status: 'init'
                    },'success',1);
                }else {
                    common.showResult(res,200,'',{
                        scoreData: self._info.scoreArr
                    },'success',1);
                }
            }
            console.log('请求结束');
        }]
    });
});

//获取课程表
router.post('/fetchSchedule', function(req, res, next) {
    var self = '';
    async.auto({
        start: function (callback) {
            //if(req.session.info) {
                var action = new base();
                self = action;
                action.fetchSpecificSchedule(req,callback,next);
                //actions.fetchSpecificSchedule(req,callback,next);
            //}else {
            //    next(new Error('1111'));
            //}
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
                action.fetchSpecificScore(req,callback,next);
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


//下发token

router.post('/fen',function (req,res,next) {
    common.showResult(res,200,'',{
        token: tools.md5(new Date().getTime().toString())
    },'success',1);
});

//

module.exports = router;
