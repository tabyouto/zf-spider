var express = require('express');
var router = express.Router();
var actions = require('../action/index');
var common = require('../common/common');
var async = require('async'); //处理异步回调
var store = require('../action/store');

/* GET users listing. */
router.post('/', function(req, res, next) {
  console.log(res);
  res.send('respond with a resource');
});

router.post('/login', function(req, res, next) {
    console.log('数据接收完毕');
    async.auto({
        start: function (callback) {
            //if(req.session.info) {
            //    console.log('session 存在，不要重复登录');
            //}else {
                actions.doLogin(req.body,callback,next);
            //}
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            req.session.info = {
                class_number: req.body.class_number,
                passwd: req.body.class_passwd,
                name: store.name
            }; //session 持久化
            console.log(req.session.info);
            common.showResult(res,200,'',{
                name: store.name,
                yearOptions:store.scheduleResult.yearOptions,
                tableHtml: store.scheduleResult.tableHtml
            },'success',1);
            console.log('finish');
        }]
    });
});

router.post('/fetchSchedule', function(req, res, next) {
    console.log('查询指定课表');
    async.auto({
        start: function (callback) {
            if(req.session.info) {
                console.log('enter');
                actions.fetchSpecificSchedule(req,callback,next);
            }else {
                next('error');
            }
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            common.showResult(res,200,'',{
                tableHtml: store.scheduleResult.tableHtml
            },'success',1);
            console.log('finish');
        }]
    });
});

module.exports = router;
