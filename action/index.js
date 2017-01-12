/**
 * Created by vicient on 2017/1/10.
 */

'use strict';

var superagent = require('superagent'),  //
    cheerio = require('cheerio'),    //转成jquery
    iconv = require("iconv-lite"),  //编码转换
    fs = require('fs'),
    path = require('path'),
    async = require('async'), //处理异步回调
    http = require('http'),
    server = http.createServer(), //创建server
    querystring = require("querystring"),
    url = require('url'),
    query = require("./mysql.js"), //mysql 配置文件
    store = require('./store.js');
//require('superagent-retry')(superagent);


//原始信息+方法
let info = {
    initUrl: '218.25.35.27:8080',
    middleUrl: '', //类cookie
    postUrl: '',//提交请求的url
    redirectUrl: '', //重定向url 跳转到首页
    name: '',
    loginInfo: {
        '__VIEWSTATE': '',  //隐藏域
        'TextBox1': '',  //学号
        'TextBox2': '',    //密码
        'RadioButtonList1': iconv.encode('学生', 'gbk').toString('binary'),   //登录类型
        'Button1': '',
        'lbLanguage': ''
    }, //登录信息
    scheduleInfo: {
        __EVENTTARGET: 'xnd',
        __EVENTARGUMENT: '',
        __VIEWSTATE: '', //隐藏域
        xnd: '', //学年
        xqd: ''//学期
    },
    headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
        'Host': '218.25.35.27:8080',
        'Referer': '218.25.35.27:8080',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36'
    },
    binaryParser: function (res, callback) { //转换成buffer
        res.setEncoding('binary');
        res.data = '';
        res.on('data', function (chunk) {
            res.data += chunk;
        });
        res.on('end', function () {
            callback(null, new Buffer(res.data, 'binary'));
        });
    },
    //urlEncode
    urlParse: function (url) {
        return encodeURI(url);
    },
};


//原子操作
var actionsStep = {
    init: function (time, callback, next) {
        var _self = this,
            url = 'http://' + info.initUrl;
        time++;
        superagent.get(url).timeout(3000).end(function (err, res) {
            if (res !== undefined) {
                var tmp = res.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
                info.middleUrl = tmp.substr(0, tmp.length - 1); //截取中间url
                store.middleUrl = info.middleUrl;
                info.postUrl = 'http://' + info.initUrl + '/(' + info.middleUrl + ')/default2.aspx';
                let $ = cheerio.load(res.text);
                info.loginInfo.__VIEWSTATE = $('[name=__VIEWSTATE]').val(); //获取viewState
                console.log('----初始化获得middleUrl----', info.loginInfo.__VIEWSTATE);
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.init(time, callback, next)
                } else {
                    next('500');
                }
            }
        })
    },
    login: function (time, callback, next) {
        console.log('start login');
        var _self = this;
        time++;
        superagent.post(info.postUrl)
            .set(info.headers)
            .send(info.loginInfo)
            .type('form')
            .redirects(0)
            .timeout(3000)
            .end(function (err, res) {
                if (res !== undefined && res.headers.location) {
                    info.redirectUrl = 'http://' + info.initUrl + res.headers.location;  //get 302 url
                    console.log('----跳转url----' + info.redirectUrl);
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        _self.login(time, callback, next)
                    } else {
                        next('error');
                    }
                }
            })
    },
    getName: function (time, callback, next) { //进入登录页
        var _self = this;
        time++;
        superagent.get(info.redirectUrl).buffer().parse(info.binaryParser).end(function (err, res) { //获取姓名
            if (res && res.body) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text);
                var name = $('#xhxm').text();
                store.name = name.split(' ')[2].slice(0, -2); //获取姓名
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.getName(time, callback, next);
                } else {
                    next('error');
                }

            }

        })
    },//重定向进入成功页面
    getSchedule: function (time, callback, next) { // 获取默认课程表
        time++;
        var _self = this,
            url = 'http://' + info.initUrl + '/(' + info.middleUrl + ')/xskbcx.aspx?xh=' + info.loginInfo.TextBox1 + '&xm=' + info.name + '&gnmkdm=N121603';
        url = info.urlParse(url);
        var headers = info.headers;
        headers.Referer = info.redirectUrl;
        superagent.get(url).set(headers).timeout(3000).buffer().parse(info.binaryParser).end(function (err, res) { //获取姓名
            if (res) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                var table = $('#Table1').html();
                table = table.replace(/(width|align)=".*?"/g, '');
                store['scheduleResult']['yearOptions'] = []; //学年下拉框
                store['scheduleResult']['tableHtml'] = table; //当前学年课表html
                $('#xnd option').map(function () {
                    store['scheduleResult']['yearOptions'].push({
                        text: $(this).val(),
                        value: $(this).val()
                    });
                });

                info.scheduleInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.getSchedule(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    },
    getSpecificSchedule: function (time, callback, next, req) { //获取具体课程表
        time++;
        var _params = req.session.info; //从session获取登录信息
        var _self = this,
            url = 'http://' + info.initUrl + '/(' + info.middleUrl + ')/xskbcx.aspx?xh=' + _params.class_number + '&xm=' + _params.name + '&gnmkdm=N121603';
        url = info.urlParse(url);
        var _scheduleInfo = info.scheduleInfo;
        _scheduleInfo.xnd = req.body.year; //学年
        _scheduleInfo.xqd = req.body.termSelected;//学期
        var headers = info.headers;
        console.log(_scheduleInfo);
        headers.Referer = url;
        console.log(headers);
        superagent.post(url)
            .set(headers)
            .send(_scheduleInfo)
            .type('form')
            .timeout(5000)
            .buffer()
            .parse(info.binaryParser)
            .end(function (err, res) {
                if (res) {
                    var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                    let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                    console.log(text);
                    //var table = $('#Table1').html();
                    //table = table.replace(/(width|align)=".*?"/g, '');
                    //store['scheduleResult']['tableHtml'] = table; //当前学年课表html
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        _self.getSpecificSchedule(time, callback, next, req)
                    } else {
                        next('error');
                    }
                }
            })
    },
};

/**
 * 查询学号是否存在
 * @param xh 学号
 * @param passwd 密码
 */
function haveExited(xh, callback) {
    query("select count(class_number) from class_info where class_number = ?", [xh.toString()], function (err, vals, fields) {
        if (vals[0]['count(class_number)'] > 0) {
            callback && callback(null, '');
            return true;
        }
        callback && callback(null, '');
        return false;
    });
}

var actions = {
    doLogin: function (params, cb, next) { //登录后
        async.auto({
            initSearch: function (callback) {
                let flag = haveExited(params.class_number, callback); //查询表中是否存在
                store['exitFlag'] = flag;
            },
            init: ['initSearch', function (results, callback) { //return true 自动执行下一步
                info.loginInfo.TextBox1 = params.class_number;
                info.loginInfo.TextBox2 = params.class_passwd;
                actionsStep.init(0, callback, next); //请求接口
            }],
            login: ['init', function (results, callback) {
                actionsStep.login(0, callback, next);
            }],
            getName: ['login', function (results, callback) {
                actionsStep.getName(0, callback, next);
            }],
            switchType: ['getName', function (results, callback) {
                switch (params.type) {
                    case 'schedule' :
                        actionsStep.getSchedule(0, callback, next);
                        break;
                    case 'score':
                        console.log('查绩点');
                        break;
                }
            }],
            cb: ['switchType', function (results, callback) {
                cb && cb();
            }]
        }, function (err, results) {
            console.log('err = ', err);
            console.log('results = ', results);
        });
    },
    fetchSpecificSchedule: function (req, cb, next) { //查询具体课程表
        async.auto({
            init: function (callback) { //return true 自动执行下一步
                info.loginInfo.TextBox1 = req.body.class_number;
                info.loginInfo.TextBox2 = req.body.class_passwd;
                actionsStep.init(0, callback, next); //请求接口
            },
            login: ['init', function (results, callback) {
                actionsStep.login(0, callback, next);
            }],
            getName: ['login', function (results, callback) {
                actionsStep.getName(0, callback, next);
            }],
            getDefaultSchedule: ['getName', function (results, callback) {
                actionsStep.getSchedule(0, callback, next);
            }],
            search: ['getDefaultSchedule',function (results,callback) {
                actionsStep.getSpecificSchedule(0, callback, next, req);
            }],
            cb: ['search', function (results, callback) {
                cb && cb();
            }]
        }, function (err, results) {
            console.log('err = ', err);
            console.log('results = ', results);
        });
    },
    fetchSpecificScore: function (params, cb, next) { //查询具体几点

    }
}


module.exports = actions;