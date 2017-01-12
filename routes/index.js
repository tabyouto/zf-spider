var express = require('express');
var router = express.Router();
var common = require('../common/common');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.post('search/login', function(req, res, next) {
    console.log('数据接收完毕');
    async.auto({
        start: function (callback) {
            actions.doLogin(req.body,callback,next);
        },
        finish: ['start', function (results, callback) { //return true 自动执行下一步
            common.showResult(res,200,'',{
                yearOptions:store.scheduleResult.yearOptions,
                tableHtml: store.scheduleResult.tableHtml
            },'success',1);
            console.log('finish');
        }]
    });
});



module.exports = router;
