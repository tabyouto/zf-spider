/**
 * author: chihaiyue
 * createTime:  2017/1/19.
 */
'use strict';

let superagent  = require('superagent'),  //
    cheerio     = require('cheerio'),    //转成jquery
    iconv       = require("iconv-lite"),  //编码转换
    async       = require('async'), //处理异步回调
    querystring = require("querystring"),
    sqlAction   = require("./mysql.js"), //mysql 配置文件
    info        = require('./_base.js'), //基本配置信息
    event       = require('../event/_event'),
    tools       = require('../common/util');

var error = new Error('spider failed');
error.status = 1112;


/**
 * 查询学号是否存在
 * @param xh 学号
 * @param passwd 密码
 */
function haveExited(xh, callback,req, cb, next,nextFun) {
    sqlAction.query("select degree_score from class_info where class_number = ?", [xh.toString()], function (err, vals, fields) {
        console.log(vals);
        if(vals.length>0) {
            if (vals[0]['degree_score']) {

            }else {
                callback && callback(req, cb, next); //数据库里没有数据执行获取所有学位课操作
            }
        }else {
            var obj = {
                class_number:req.body.class_number,
                class_passwd: req.body.class_passwd
            };
            callback && callback(req, cb, next); //数据库里没有数据执行获取所有学位课操作
            sqlAction.insert('INSERT INTO class_info SET ?',obj,function (err, vals, fields) {});
        }
        nextFun && nextFun(null,'',next);
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
/**
 * 处理抓取的 html
 * @param data
 * @returns {void|*|String}
 */
function parseHtml(data) {
    var text = iconv.decode(data, 'GBK'); //编码成正确的gbk
    return  cheerio.load(text, {decodeEntities: false});  //默认是转实体的
}


function Spider() {
    this._info = JSON.parse(JSON.stringify(info));
    this._info.courseTempArr = []; //置空
}

Spider.prototype = {
    construct: Spider,
    init: function(time, callback, next) {
    let url = 'http://' + this._info.initUrl;
    let that = this;
    time++;
    superagent.get(url).end(function (err, res) {
        if (res !== undefined) {
            var tmp = res.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
            that._info.middleUrl = tmp.substr(0, tmp.length - 1); //截取中间url
            that._info.postUrl = 'http://' + that._info.initUrl + '/(' + that._info.middleUrl + ')/default2.aspx';
            let $ = cheerio.load(res.text);
            that._info.loginInfo.__VIEWSTATE = $('[name=__VIEWSTATE]').val(); //获取viewState
            console.log('----初始化获得middleUrl----', that._info.loginInfo.__VIEWSTATE);
            callback && callback(null, '', next);
        } else {
            if (time < 2) {
                that.init(time, callback, next)
            } else {
                next(error);
            }
        }
    })
},
    login: function(time, callback, next) {
        console.log('start login');
        let that = this;
        time++;
        superagent
            .post(this._info.postUrl)
            .set(this._info.headers)
            .send(this._info.loginInfo)
            .type('form')
            .redirects(0)
            .end(function (err, res) {
                if (res !== undefined && res.headers.location) {
                    that._info.redirectUrl = 'http://' + that._info.initUrl + res.headers.location;  //get 302 url
                    console.log('----跳转url----' + that._info.redirectUrl);
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        that.login(time, callback, next)
                    } else {
                        next(error);
                    }
                }
            })
    },
    loginFinish: function(time, callback, next) {
        time++;
        let that = this;
        superagent
            .get(this._info.redirectUrl)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) { //获取姓名
                if (res && res.body) {

                    var $ = parseHtml(res.body);
                    var name = $('#xhxm').text();
                    that._info.name = name.split(' ')[2].slice(0, -2); //获取姓名
                    console.log('获取姓名', that._info.name);
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        that.loginFinish(time, callback, next);
                    } else {
                        next(error);
                    }

                }

            })
    },
    /**
     * 获取默认课程表
     * @param time
     * @param callback
     * @param next
     */
    getDefaultSchedule: function (time, callback, next) {
        time++;
        let that = this;
        var url = 'http://' + that._info.initUrl + '/(' + that._info.middleUrl + ')/xskbcx.aspx?xh=' + that._info.loginInfo.TextBox1 + '&xm=' + that._info.name + '&gnmkdm=N121603';
        url = urlParse(url);
        let headers = this._info.headers;
        headers.Referer = this._info.redirectUrl;
        superagent
            .get(url)
            .set(headers)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) { //获取姓名
            if (res) {
                let $ = parseHtml(res.body);
                let table = $('#Table1').html();
                table = table && table.replace(/(width|align)=".*?"/g, '');
                that._info['scheduleResult']['yearOptions'] = []; //学年下拉框
                that._info['scheduleResult']['tableHtml'] = table; //当前学年课表html
                $('#xnd option').map(function () {
                    that._info['scheduleResult']['yearOptions'].push({
                        text: $(this).val(),
                        value: $(this).val()
                    });
                });
                that._info.scheduleInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                callback && callback(null, '', next);
            } else {
                if (time < 2) {
                    that.getDefaultSchedule(time, callback, next);
                } else {
                    next(error);
                }
            }
        })
    },
    //获取所有成绩入口
    getDefaultScoreInit: function (time, callback, next) { // 获取所有成绩入口
        time++;
        let that = this;
        let url = 'http://' + this._info.initUrl + '/(' + this._info.middleUrl + ')/xscjcx.aspx?xh=' + this._info.loginInfo.TextBox1 + '&xm=' + this._info.name + '&gnmkdm=N121605';
        url = urlParse(url);
        let headers = this._info.headers;
        headers.Referer = this._info.redirectUrl;
        superagent.get(url).set(headers).buffer().parse(binaryParser).end(function (err, res) { //获取姓名
            if (res && res.body) {
                let $ = parseHtml(res.body);
                console.log('获取网页了');
                that._info.allDegreeInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                callback && callback(null,'',next);
            } else {
                if (time < 2) {
                    that.getDefaultScoreInit(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    },
    getDefaultScoreEnd: function (time, callback, next) { // 获取所有成绩结束
        time++;
        let that = this;
        let url = 'http://' + this._info.initUrl + '/(' + this._info.middleUrl + ')/xscjcx.aspx?xh=' + this._info.loginInfo.TextBox1 + '&xm=' + this._info.name + '&gnmkdm=N121605';
        url = urlParse(url);
        let headers = this._info.headers;
        headers.Referer = url;
        var _info = {
            __VIEWSTATE: this._info.allDegreeInfo.__VIEWSTATE,
            __EVENTARGUMENT: '',
            __EVENTTARGET: '',
            hidLanguage: '',
            ddlXN: '',
            ddlXQ: '',
            ddl_kcxz: '',
            btn_zcj: iconv.encode('历年成绩', 'gbk').toString('binary')
        };
        superagent
            .post(url)
            .set(headers)
            .send(_info)
            .type('form')
            .timeout(5000)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) { //获取姓名
                if (res) {
                    let $ = parseHtml(res.body);
                    var tmpArr = [];
                    $('.datelist tr').not('.datelisthead').each(function (e) {
                        tmpArr.push({
                            name: $(this).find('td').eq(3).text(),
                            score: $(this).find('td').eq(6).text(),
                            jd: $(this).find('td').eq(7).text(),
                        });
                    });
                    that._info.scoreArr = tmpArr;
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        that.getDefaultScoreEnd(time, callback, next);
                    } else {
                        next('error');
                    }
                }
            })
    },
    //获取具体课程表
    getSpecificSchedule: function (time, callback, next, req) {
        time++;
        let that = this;
        let url = 'http://' + this._info.initUrl + '/(' + this._info.middleUrl + ')/xskbcx.aspx?xh=' + this._info.loginInfo.TextBox1 + '&xm=' + this._info.name + '&gnmkdm=N121603';
        url = urlParse(url);
        let _scheduleInfo = this._info.scheduleInfo;
        _scheduleInfo.xnd = req.body.year; //学年
        _scheduleInfo.xqd = req.body.termSelected;//学期
        let headers = this._info.headers;
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
                    let $ = parseHtml(res.body);
                    let table = $('#Table1').html();
                    table = table.replace(/(width|align)=".*?"/g, '');
                    that._info['scheduleResult']['tableHtml'] = table; //当前学年课表html
                    callback && callback(null, '', next);
                } else {
                    if (time < 2) {
                        that.getSpecificSchedule(time, callback, next, req)
                    } else {
                        next(error);
                    }
                }
            })
    },
    //获取具体学分
    // getSpecificScore: function (time, callback, next, req) {
    //     time++;
    //     //var _params = req.session.info; //从session获取登录信息
    //     var _self = this,
    //         url = 'http://' + self._info.initUrl + '/(' + self._info.middleUrl + ')/xskbcx.aspx?xh=' + self._info.loginInfo.TextBox1 + '&xm=' + self._info.name + '&gnmkdm=N121603';
    //     url = urlParse(url);
    //     var _scheduleInfo = self._info.scheduleInfo;
    //     _scheduleInfo.xnd = req.body.year; //学年
    //     _scheduleInfo.xqd = req.body.termSelected;//学期
    //     var headers = self._info.headers;
    //     headers.Referer = url;
    //     superagent.post(url)
    //         .set(headers)
    //         .send(_scheduleInfo)
    //         .type('form')
    //         .timeout(5000)
    //         .buffer()
    //         .parse(binaryParser)
    //         .end(function (err, res) {
    //             if (res) {
    //                 var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
    //                 let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
    //                 var table = $('#Table1').html();
    //                 table = table.replace(/(width|align)=".*?"/g, '');
    //                 store['scheduleResult']['tableHtml'] = table; //当前学年课表html
    //                 callback && callback(null, '', next);
    //             } else {
    //                 if (time < 2) {
    //                     _self.getSpecificSchedule(time, callback, next, req)
    //                 } else {
    //                     next('error');
    //                 }
    //             }
    //         })
    // },
    //获取所有学位课----进入初始页面
    getAllDegreeInitial: function (time, callback, next) {
        time++;
        let that = this;
        var   url = 'http://' + this._info.initUrl + '/(' + this._info.middleUrl + ')/pyjh.aspx?xh=' + this._info.loginInfo.TextBox1 + '&xm=' + this._info.name + '&gnmkdm=N121607';
        url = urlParse(url);
        let headers = this._info.headers;
        headers.Referer = this._info.redirectUrl;
        superagent
            .get(url)
            .set(headers)
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) {
            if (res) {
                let $ = parseHtml(res.body);
                that._info.allDegreeInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                console.log('教学计划页面进入成功');
                callback && callback(null, '', next);
            } else {
                if (time < 3) {
                    that.getAllDegreeInitial(time, callback, next);
                } else {
                    next('error');
                }
            }
        })
    },
    getAllDegreeResult: function (time, req, callback, next) {
        time++;
        let that = this;
        let url = 'http://' + this._info.initUrl + '/(' + this._info.middleUrl + ')/pyjh.aspx?xh=' + this._info.loginInfo.TextBox1 + '&xm=' + this._info.name + '&gnmkdm=N121607';
        url = urlParse(url);
        let headers = this._info.headers;
        headers.Referer = url;
        superagent.post(url)
            .set(headers)
            .send(this._info.allDegreeInfo)
            .type('form')
            .buffer()
            .parse(binaryParser)
            .end(function (err, res) {
                if (res) {
                    let $ = parseHtml(res.body);
                    var number = $('.datelist tr:last-child a').siblings().text(); //当前页数
                    var maxPage = $('.datelist tr:last-child a:last-child').text() || -1;
                    var tmpId,tmpName,tmpScore;
                    $('#DBGrid tr').not('.datelisthead').each(function (e) {
                        if(!$(this).attr('nowrap')) {
                            tmpId = $(this).find('td').eq(0).find('font').text() || $(this).find('td').eq(0).text();
                            tmpName = $(this).find('td').eq(1).find('font').text() || $(this).find('td').eq(1).text();
                            tmpScore = $(this).find('td').eq(2).find('font').text() || $(this).find('td').eq(2).text();
                        }
                        if ($(this).find('td:last-child font').text() == '是') {
                            that._info.courseTempArr.push([tmpId,tmpName,tmpScore,1])
                        }else {
                            that._info.courseTempArr.push([tmpId,tmpName,tmpScore,0])
                        }
                    });
                    if (number < maxPage) { //
                        that._info.allDegreeInfo.__VIEWSTATE = $('input[name=__VIEWSTATE]').val(); //记录当前隐藏域信息
                        that._info.allDegreeInfo.__EVENTTARGET = 'DBGrid:_ctl24:_ctl' + number;
                        console.log(req.body.token);
                        event.emit('finished',{progress: number*15+'%',token:req.body.token});
                        that.getAllDegreeResult(0, req, res,next);
                    } else {
                        console.log(that._info.courseTempArr);
                        //计算学位课总分
                        var _score = 0;
                        var _list = '';
                        that._info.courseTempArr.forEach(function (item) {
                            if(item[3]==1) {
                                _score = tools.numAdd(item[2],_score);
                                _list += item[0] + ',';
                            }
                        });
                        _list = _list.substr(0,_list.lastIndexOf(','));
                        sqlAction.insert('UPDATE class_info SET degree_score = ?,degree_list = ? WHERE class_number='+ that._info.loginInfo.TextBox1,[ _score,_list],function (err, vals, fields) {}); //更新学位课总分


                        sqlAction.insert('INSERT IGNORE INTO degree_info(course_id,course_name,course_score,is_degree) VALUES ?',[that._info.courseTempArr],function (err, vals, fields) {});
                        event.emit('finished',{progress:'100%',token:req.body.token});
                        console.log('执行数据库操作');
                    }

                } else {
                    if (time < 3) {
                        that.getAllDegreeResult(time, req, callback, next);
                    }
                }
            })
    },



    /**
     * 登录处理
     * @param req
     * @param cb
     * @param next
     */
    doLogin: function (req, cb, next) { //登录
        let that = this;
        if (req.body.type == '2') {
            console.log('判断进入');
            that.fetchDefaultSchedule(req, cb, next);
        } else {
            // _self.actions.fetchAllScore(req, cb, next);
            that.fetchSpecificScore(req, cb, next);
            // cb && cb();
        }
    },
    /**
     * 获取默认课程表
     * @param req
     * @param cb
     * @param next
     */
    fetchDefaultSchedule: function (req, cb, next) {
        let that = this;
        async.auto({
            init: function (callback) { //return true 自动执行下一步
                that._info.loginInfo.TextBox1 = req.body.class_number;
                that._info.loginInfo.TextBox2 = req.body.class_passwd;
                that.init(0, callback, next); //请求接口
                console.log('进入');
            },
            login: ['init', function (results, callback) {
                that.login(0, callback, next);
            }],
            getName: ['login', function (results, callback) {
                that.loginFinish(0, callback, next);
            }],
            getDefaultSchedule: ['getName', function (results, callback) {
                that.getDefaultSchedule(0, callback, next);
            }],
            checkExist: ['getDefaultSchedule',function (results, callback) {
                haveExited(req.body.class_number,that.fetchAllScore,req, cb, next,callback); //查询表中是否存在
            }],
            cb: ['checkExist', function (results, callback) {
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
        let that = this;
        async.auto({
            init: function (callback) {
                that._info.loginInfo.TextBox1 = req.body.class_number;
                that._info.loginInfo.TextBox2 = req.body.class_passwd;
                that.init(0, callback, next); //请求接口
            },
            login: ['init', function (results, callback) {
                that.login(0, callback, next);
            }],
            getName: ['login', function (results, callback) {
                that.loginFinish(0, callback, next);
            }],
            getDefaultSchedule: ['getName', function (results, callback) {
                that.getDefaultSchedule(0, callback, next);
            }],
            search: ['getDefaultSchedule', function (results, callback) {
                that.getSpecificSchedule(0, callback, next, req);
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
     * 查询具体成绩
     * @param req
     * @param cb
     * @param next
     */
    fetchSpecificScore: function (req, cb, next) {
        let that= this;
        if (req.body.type || req.body.type == "1") { //触发查询所有学位课
            async.auto({
                init: function (callback) {
                    that._info.loginInfo.TextBox1 = req.body.class_number;
                    that._info.loginInfo.TextBox2 = req.body.class_passwd;
                    that.init(0, callback, next); //请求接口
                },
                login: ['init', function (results, callback) {
                    that.login(0, callback, next);
                }],
                getName: ['login', function (results, callback) {
                    that.loginFinish(0, callback, next);
                }],
                getDefaultScore: ['getName', function (results, callback) {
                    that.getDefaultScoreInit(0, callback, next);
                }],
                getDefaultScoreEnd: ['getDefaultScore', function (results, callback) {
                    that.getDefaultScoreEnd(0, callback, next);
                }],
                cb: ['getDefaultScoreEnd', function (results, callback) {
                    cb && cb();
                    console.log('获取所有成绩');
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
        let that = this;
        async.auto({
            init: function (callback) {
                that._info.loginInfo.TextBox1 = req.body.class_number;
                that._info.loginInfo.TextBox2 = req.body.class_passwd;
                that.init(0, callback, next); //请求接口
            },
            login: ['init', function (results, callback) {
                that.login(0, callback, next);
            }],
            getName: ['login', function (results, callback) {
                that.loginFinish(0, callback, next);
            }],
            getAllDegreeInitial: ['getName', function (results, callback) {
                that.getAllDegreeInitial(0, callback, next);
            }],
            getAllDegreeResult: ['getAllDegreeInitial', function (results, callback) {
                that.getAllDegreeResult(0, req, callback, next);
                // callback && callback();
            }],
            cb: ['getAllDegreeResult', function (results, callback) {
                // cb && cb();
                console.log('获取所有学位课');
            }]
        }, function (err, results) {
            console.log('获取所有学位课')
            console.log('err = ', err);
            console.log('results = ', results);
        });
    }
};

module.exports = Spider;

