/**
 * author: chihaiyue
 * createTime:  2017/1/19.
 */
'use strict';

let superagent = require('superagent'),  //
    cheerio = require('cheerio'),    //转成jquery
    iconv = require("iconv-lite"),  //编码转换
    async = require('async'), //处理异步回调
    querystring = require("querystring"),
    sqlAction = require("./mysql.js"), //mysql 配置文件
    info = require('./_base.js'); //基本配置信息
var event = require('../event/_event');


/**
 * 查询学号是否存在
 * @param xh 学号
 * @param passwd 密码
 */
function haveExited(xh, callback) {
    sqlAction.query("select count(class_number) from class_info where class_number = ?", [xh.toString()], function (err, vals, fields) {
        if (vals[0]['count(class_number)'] > 0) {
            callback && callback(null, '');
            return true;
        }
        callback && callback(null, '');
        return false;
    });
}
function binaryParser(res, callback) { //转换成buffer
    res.setEncoding('binary');
    res.data = '';
    res.on('data', function (chunk) {
        res.data += chunk;
    });
    res.on('end', function () {
        callback(null, new Buffer(res.data, 'binary'));
    });
}
function urlParse (url) {
    return encodeURI(url);
}


function spider() {
    var _self = this;
    this._info = JSON.parse(JSON.stringify(info));
    this._info.courseTempArr = []; //置空
    this.init = function(time, callback, next) {
            var url = 'http://' + _self._info.initUrl;
        time++;
        superagent.get(url).end(function (err, res) {
            if (res !== undefined) {
                var tmp = res.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
                _self._info.middleUrl = tmp.substr(0, tmp.length - 1); //截取中间url
                _self._info.postUrl = 'http://' + _self._info.initUrl + '/(' + _self._info.middleUrl + ')/default2.aspx';
                let $ = cheerio.load(res.text);
                _self._info.loginInfo.__VIEWSTATE = $('[name=__VIEWSTATE]').val(); //获取viewState
                console.log('----初始化获得middleUrl----', _self._info.loginInfo.__VIEWSTATE);
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.init(time, callback, next)
                } else {
                    next('500');
                }
            }
        })
    };
    this.login = function(time, callback, next) {
        console.log('start login');
        time++;
        superagent.post(_self._info.postUrl)
            .set(_self._info.headers)
            .send(_self._info.loginInfo)
            .type('form')
            .redirects(0)
            .end(function (err, res) {
                if (res !== undefined && res.headers.location) {
                    _self._info.redirectUrl = 'http://' + _self._info.initUrl + res.headers.location;  //get 302 url
                    console.log('----跳转url----' + _self._info.redirectUrl);
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        _self.login(time, callback, next)
                    } else {
                        next('error');
                    }
                }
            })
    };
    this.loginFinish = function(time, callback, next) {
        time++;
        superagent.get(_self._info.redirectUrl).buffer().parse(binaryParser).end(function (err, res) { //获取姓名
            if (res && res.body) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text);
                var name = $('#xhxm').text();
                _self._info.name = name.split(' ')[2].slice(0, -2); //获取姓名
                console.log('获取姓名', _self._info.name);
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.loginFinish(time, callback, next);
                } else {
                    next('error');
                }

            }

        })
    };

    this.getDefaultSchedule = function (time, callback, next) {
        time++;
            var url = 'http://' + _self._info.initUrl + '/(' + _self._info.middleUrl + ')/xskbcx.aspx?xh=' + _self._info.loginInfo.TextBox1 + '&xm=' + _self._info.name + '&gnmkdm=N121603';
        url = urlParse(url);
        var headers = _self._info.headers;
        headers.Referer = _self._info.redirectUrl;
        superagent.get(url).set(headers).buffer().parse(binaryParser).end(function (err, res) { //获取姓名
            if (res) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                var table = $('#Table1').html();
                table = table && table.replace(/(width|align)=".*?"/g, '');
                _self._info['scheduleResult']['yearOptions'] = []; //学年下拉框
                _self._info['scheduleResult']['tableHtml'] = table; //当前学年课表html
                $('#xnd option').map(function () {
                    _self._info['scheduleResult']['yearOptions'].push({
                        text: $(this).val(),
                        value: $(this).val()
                    });
                });
                _self._info.scheduleInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.getDefaultSchedule(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    };
    this.getDefaultScore = function (time, callback, next) { // 获取默认课程表
        time++;
        var _self = this,
            url = 'http://' + self._info.initUrl + '/(' + self._info.middleUrl + ')/xscjcx.aspx?xh=' + self._info.loginInfo.TextBox1 + '&xm=' + self._info.name + '&gnmkdm=N121605';
        url = urlParse(url);
        var headers = self._info.headers;
        headers.Referer = self._info.redirectUrl;
        superagent.get(url).set(headers).timeout(5000).buffer().parse(binaryParser).end(function (err, res) { //获取姓名
            if (res) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text, {decodeEntities: false});  //默认是转实体的
                self._info.scheduleInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    _self.getDefaultScore(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    };
    //获取具体课程表
    this.getSpecificSchedule = function (time, callback, next, req) {
        time++;
        //var _params = req.session.info; //从session获取登录信息
           var  url = 'http://' + _self._info.initUrl + '/(' + _self._info.middleUrl + ')/xskbcx.aspx?xh=' + _self._info.loginInfo.TextBox1 + '&xm=' + _self._info.name + '&gnmkdm=N121603';
        url = urlParse(url);
        var _scheduleInfo = _self._info.scheduleInfo;
        _scheduleInfo.xnd = req.body.year; //学年
        _scheduleInfo.xqd = req.body.termSelected;//学期
        var headers = _self._info.headers;
        headers.Referer = url;
        superagent.post(url)
            .set(headers)
            .send(_scheduleInfo)
            .type('form')
            .timeout(5000)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) {
                if (res) {
                    var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                    let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                    var table = $('#Table1').html();
                    table = table.replace(/(width|align)=".*?"/g, '');
                    _self._info['scheduleResult']['tableHtml'] = table; //当前学年课表html
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        _self.getSpecificSchedule(time, callback, next, req)
                    } else {
                        next('error');
                    }
                }
            })
    };
    //获取具体学分
    this.getSpecificScore = function (time, callback, next, req) {
        time++;
        //var _params = req.session.info; //从session获取登录信息
        var _self = this,
            url = 'http://' + self._info.initUrl + '/(' + self._info.middleUrl + ')/xskbcx.aspx?xh=' + self._info.loginInfo.TextBox1 + '&xm=' + self._info.name + '&gnmkdm=N121603';
        url = urlParse(url);
        var _scheduleInfo = self._info.scheduleInfo;
        _scheduleInfo.xnd = req.body.year; //学年
        _scheduleInfo.xqd = req.body.termSelected;//学期
        var headers = self._info.headers;
        headers.Referer = url;
        superagent.post(url)
            .set(headers)
            .send(_scheduleInfo)
            .type('form')
            .timeout(5000)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) {
                if (res) {
                    var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                    let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                    var table = $('#Table1').html();
                    table = table.replace(/(width|align)=".*?"/g, '');
                    store['scheduleResult']['tableHtml'] = table; //当前学年课表html
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        _self.getSpecificSchedule(time, callback, next, req)
                    } else {
                        next('error');
                    }
                }
            })
    };
    //获取所有学位课----进入初始页面
    this.getAllDegreeInitial = function (time, callback, next) {
        time++;
          var   url = 'http://' + _self._info.initUrl + '/(' + _self._info.middleUrl + ')/pyjh.aspx?xh=' + _self._info.loginInfo.TextBox1 + '&xm=' + _self._info.name + '&gnmkdm=N121607';
        url = urlParse(url);
        var headers = _self._info.headers;
        headers.Referer = _self._info.redirectUrl;
        superagent.get(url).set(headers).buffer().parse(binaryParser).end(function (err, res) {
            if (res) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                _self._info.allDegreeInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                console.log('教学计划页面进入成功');
                callback && callback(null, '', next);
            } else {
                if (time < 3) {
                    _self.getAllDegreeInitial(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    };
    this.getAllDegreeResult = function (time, req, callback, next) {
        time++;
            var url = 'http://' + _self._info.initUrl + '/(' + _self._info.middleUrl + ')/pyjh.aspx?xh=' + _self._info.loginInfo.TextBox1 + '&xm=' + _self._info.name + '&gnmkdm=N121607';
        url = urlParse(url);
        var headers = _self._info.headers;
        headers.Referer = url;
        superagent.post(url)
            .set(headers)
            .send(_self._info.allDegreeInfo)
            .type('form')
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) {
                if (res) {
                    var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                    let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                    var number = $('.datelist tr:last-child a').siblings().text();
                    var tmpId,tmpName,tmpScore;
                    $('#DBGrid tr').not('.datelisthead').each(function (e) {
                        if(!$(this).attr('nowrap')) {
                            tmpId = $(this).find('td').eq(0).find('font').text() || $(this).find('td').eq(0).text();
                            tmpName = $(this).find('td').eq(1).find('font').text() || $(this).find('td').eq(1).text();
                            tmpScore = $(this).find('td').eq(2).find('font').text() || $(this).find('td').eq(2).text();
                        }

                        console.log(tmpId,tmpName,tmpScore)

                        if ($(this).find('td:last-child font').text() == '是') {
                            _self._info.courseTempArr.push([tmpId,tmpName,tmpScore,1])
                        }else {
                            _self._info.courseTempArr.push([tmpId,tmpName,tmpScore,0])
                        }
                    });
                    if (number < 6) {
                        _self._info.allDegreeInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                        _self._info.allDegreeInfo.__EVENTTARGET = 'DBGrid:_ctl24:_ctl' + number;
                        event.emit('complete',{progress: number*15+'%'});
                        _self.getAllDegreeResult(0, req, res);
                    } else {
                        //console.log(_self._info.courseTempArr)
                        //sqlAction.insert('INSERT IGNORE  INTO degree_info(course_id,course_name,course_score,is_degree) VALUES ?',[_self._info.courseTempArr],function (err, vals, fields) {});
                        event.emit('complete',{progress:'100%'});
                        console.log('执行数据库操作');
                    }

                } else {
                    if (time < 3) {
                        _self.getAllDegreeResult(time, req, callback, next);
                    }
                }
            })
    };



    this.actions = {
        /**
         * 登录处理
         * @param req
         * @param cb
         * @param next
         */
        doLogin: function (req, cb, next) { //登录后
            if (req.body.type == 'schedule') {
                _self.actions.fetchDefaultSchedule(req, cb, next);
            } else {
                _self.actions.fetchAllScore(req, cb, next);
            }
        },
        /**
         * 获取默认课程表
         * @param req
         * @param cb
         * @param next
         */
        fetchDefaultSchedule: function (req, cb, next) {
            async.auto({
                initSearch: function (callback) {
                    let flag = haveExited(req.body.class_number, callback); //查询表中是否存在
                    _self._info['exitFlag'] = flag;
                },
                init: ['initSearch', function (results, callback) { //return true 自动执行下一步
                    _self._info.loginInfo.TextBox1 = req.body.class_number;
                    _self._info.loginInfo.TextBox2 = req.body.class_passwd;
                    _self.init(0, callback, next); //请求接口
                }],
                login: ['init', function (results, callback) {
                    _self.login(0, callback, next);
                }],
                getName: ['login', function (results, callback) {
                    _self.loginFinish(0, callback, next);
                }],
                getDefaultSchedule: ['getName', function (results, callback) {
                    _self.getDefaultSchedule(0, callback, next);
                }],
                cb: ['getDefaultSchedule', function (results, callback) {
                    cb && cb();
                }]
            }, function (err, results) {
                console.log('err = ', err);
                console.log('results = ', results);
            });
        },
        /**
         * 查询具体课程表
         * @param req
         * @param cb
         * @param next
         */
        fetchSpecificSchedule: function (req, cb, next) {
            var _self = this;
            async.auto({
                init: function (callback) {
                    info.loginInfo.TextBox1 = req.session.info.class_number;
                    info.loginInfo.TextBox2 = req.session.info.passwd;
                    _self.init(0, callback, next); //请求接口
                },
                login: ['init', function (results, callback) {
                    _self.login(0, callback, next);
                }],
                getName: ['login', function (results, callback) {
                    _self.loginFinish(0, callback, next);
                }],
                getDefaultSchedule: ['getName', function (results, callback) {
                    _self.getDefaultSchedule(0, callback, next);
                }],
                search: ['getDefaultSchedule', function (results, callback) {
                    _self.getSpecificSchedule(0, callback, next, req);
                }],
                cb: ['search', function (results, callback) {
                    cb && cb();
                }]
            }, function (err, results) {
                console.log('err = ', err);
                console.log('results = ', results);
            });
        },
        /**
         * 查询具体绩点
         * @param req
         * @param cb
         * @param next
         */
        fetchSpecificScore: function (req, cb, next) {
            var _self = this;
            if (req.body.type || req.body.type == "degree") { //触发查询所有学位课
                console.log(store.flag);
                async.auto({
                    fetchAll: function (callback) {
                        _self.fetchAllScore(req, callback, next);
                    },
                    finish: ['fetchAll', function (results, callback) {
                        cb && cb();
                    }]
                })
            }
        },
        /**
         * 获取所有学位课
         * @param req
         * @param cb
         * @param next
         */
        fetchAllScore: function (req, cb, next) {
            async.auto({
                init: function (callback) {
                    _self._info.loginInfo.TextBox1 = req.body.class_number;
                    _self._info.loginInfo.TextBox2 = req.body.class_passwd;
                    _self.init(0, callback, next); //请求接口
                },
                login: ['init', function (results, callback) {
                    _self.login(0, callback, next);
                }],
                getName: ['login', function (results, callback) {
                    _self.loginFinish(0, callback, next);
                }],
                getAllDegreeInitial: ['getName', function (results, callback) {
                    _self.getAllDegreeInitial(0, callback, next);
                }],
                getAllDegreeResult: ['getAllDegreeInitial', function (results, callback) {
                    _self.getAllDegreeResult(0, req, callback, next);
                    callback && callback();
                }],
                cb: ['getAllDegreeResult', function (results, callback) {
                    cb && cb();
                }]
            }, function (err, results) {
                console.log('获取所有学位课')
                console.log('err = ', err);
                console.log('results = ', results);
            });
        }

    };
}

module.exports = spider;

