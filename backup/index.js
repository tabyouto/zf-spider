'use strict';

var superagent = require('superagent'),  //
    events = require('events'),
    emitter = new events.EventEmitter(),
    cheerio = require('cheerio'),    //转成jquery
    iconv = require("iconv-lite"),  //编码转换
    fs = require('fs'),
    path = require('path'),
    async = require('async'), //处理异步回调
    http = require('http'),
    server = http.createServer(), //创建server
    querystring = require("querystring"),
    url = require('url'),
    query = require("./mysql.js"); //mysql 配置文件
require('superagent-retry')(superagent);



let interfaceObj = {}; //抓取过程中存储变量用于接口返回

var time = 0;

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
    init: function (callback) {
        var that = this,
            url = 'http://' + that.initUrl;
        superagent.get(url).end(function (err, res) {
            time++;
            if(res!==undefined) {
                var tmp = res.redirects[0].match(/\([^\)]+\)/g)[0].substr(1);
                that.middleUrl = tmp.substr(0, tmp.length - 1); //截取中间url
                that.postUrl = 'http://' + that.initUrl + '/(' + that.middleUrl + ')/default2.aspx';
                let $ = cheerio.load(res.text);
                that.loginInfo.__VIEWSTATE = $('[name=__VIEWSTATE]').val() //获取viewState
                console.log('----初始化获得middleUrl----',that.loginInfo.__VIEWSTATE);
                callback && callback(null, '');
            }else {
                time%2 == 0 ? that.init(callback) : console.log('失败');
            }
        })
    },

    login: function (callback) {
        var that = this;
        superagent.post(that.postUrl)
            .set(that.headers)
            .send(that.loginInfo)
            .type('form')
            .redirects(0)
            .timeout(3000)
            .end(function (err, res) {
                time++;
                console.log(time);
                if(res!==undefined && res.headers.location) {
                    that.redirectUrl = 'http://' + that.initUrl + res.headers.location;  //get 302 url
                    console.log('----跳转url----' + that.redirectUrl);
                    callback && callback(null, '');
                }else {
                    time%2 == 0 ? that.login(callback) : console.log('login 失败');
                }
            })
    },
    getName: function (callback) { //抓取首页获得姓名
        var that = this;
        superagent.get(that.redirectUrl).buffer().parse(that.binaryParser).end(function (err, res) { //获取姓名
            //if(res!==undefined) {
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text);
                var name = $('#xhxm').text();
                that.name = name.split(' ')[2].slice(0, -2); //获取姓名
                console.log(that.name);
                callback && callback(null, '');
            //}else {
            //    that.getName(callback);
            //}
        })
    },
    getSchedule: function (callback) { //
        var that = this;
        var url = 'http://' + this.initUrl + '/(' + this.middleUrl + ')/xskbcx.aspx?xh=' + this.loginInfo.TextBox1 + '&xm=' + this.name + '&gnmkdm=N121603';
        url = this.urlParse(url);
        var headers = this.headers;
        headers.Referer = this.redirectUrl;
        superagent.get(url).set(headers).buffer().parse(this.binaryParser).end(function (err, res) { //获取姓名
            if(res!==undefined) {
                console.log('*********************************************************')
                var text = iconv.decode(res.body, 'GBK'); //编码成正确的gbk
                let $ = cheerio.load(text, {decodeEntities: false});  //***身默认是转实体的
                var table = $('#Table1').html();
                table = table.replace(/(width|align)=".*?"/g, '');
                interfaceObj['yearOptions'] = []; //学年下拉框
                interfaceObj['tableHtml'] = table; //当前学年课表html
                $('#xnd option').map(function(){
                    interfaceObj['yearOptions'].push({
                        text: $(this).val(),
                        value: $(this).val()
                    });
                });
                callback && callback(null, '');
            }else {
                console.log('执行第二遍');
                that.getSchedule();
            }


        })
    },
    switchType: function (type,callback) {
        switch (type) {
            case 'getSchedule':
                this[type](callback);
                break;

        }
    }
};


let action = {
    doLogin: function(params,cb) {
        async.auto({
            initSearch: function (callback) {
                haveExited(params.class_number, callback); //查询表中是否存在
            },
            init: ['initSearch', function (results, callback) { //return true 自动执行下一步
                info.loginInfo.TextBox1 = params.class_number;
                info.loginInfo.TextBox2 = params.class_passwd;
                info.init(callback); //请求接口
            }],
            login: ['init', function (results, callback) {
                info.login(callback);
            }],
            getName: ['login', function (results, callback) {
                info.getName(callback);
            }],
            switchType: ['getName', function (results, callback) {
                info.switchType('getSchedule',callback);
            }],
            cb: ['switchType',function(results,callback) {
                cb && cb();
            }]
        }, function (err, results) {
            console.log('err = ', err);
            console.log('results = ', results);
        });
    }
}


// info.init();

// async.auto({
//     init: function(callback) {
//         info.init(callback); //请求接口
//     },
//     login: ['init',function(results,callback) {
//         info.login(callback);
//     }],
//     getName: ['login',function(results,callback) {
//         info.getName(callback);
//     }],
//     switchType: ['getName',function(results,callback) {
//         info.switchType('getSchedule');
//     }]
// },function(err, results) {
//     console.log('err = ', err);
//     console.log('results = ', results);
// })

//###########################################################
var requestFunction = function (req, res) {
    req.setEncoding('utf-8');
    var postData = '';
    req.addListener("data", function (postDataChunk) {
        postData += postDataChunk;
    });
    req.addListener("end", function () {
        console.log('数据接收完毕');
        var params = querystring.parse(postData);
        if(params.debug) {
            showResult(res,'200','',{'test': 'test'},'success',1);
        }
        //var _tmpLength = 0;
        //for (var i in params) {
        //    _tmpLength++;
        //}
        //if (_tmpLength != 2) {
        //    showResult(res); //返回异常
        //}else {
        //
        //}
        switch (url.parse(req.url,true).path) {
            case '/search/login':
                    async.auto({
                        start: function (callback) {
                            action.doLogin(params,callback);
                        },
                        finish: ['start', function (results, callback) { //return true 自动执行下一步
                            showResult(res,200,'',{
                                yearOptions: interfaceObj.yearOptions,
                                tableHtml: interfaceObj.tableHtml
                            },'success',1);
                            console.log('finish');
                        }]
                    });

                break;
        }

    });
}
server.on('request', requestFunction);
server.listen(9000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:9000/');

//##########################################################################

/**
 * 接口定制抛出异常
 * res 上下文
 * code 状态码
 * contentType 返回类型
 * data 返回内容
 * msg 返回消息
 */
function showResult(res,code,contentType,data,msg,ret) {
    var _code = !arguments[1] ? '500' : arguments[1];
    var _contentType = !arguments[2] ? 'text/html;charset=UTF-8' : arguments[2];
    var _data = !arguments[3] ? null : arguments[3];
    var _msg = !arguments[4] ? 'error' : arguments[4];
    var _ret = !arguments[5] ? '1111' : arguments[5];
    res.writeHead(_code, {
        "Content-Type": _contentType
    });
    var data = {
        "ret": _ret,
        "msg": _msg,
        "data": _data
    };
    res.end(JSON.stringify(data));
}

/**
 * 查询学号是否存在
 * @param xh 学号
 * @param passwd 密码
 */
function haveExited(xh, callback) {
    query("select count(class_number) from class_info where class_number = ?", [xh], function (err, vals, fields) {
        if (vals[0]['count(class_number)'] > 0) {
            callback && callback(null, '');
            return true;
        }
        callback && callback(null, '');
        return false;
    });
}
